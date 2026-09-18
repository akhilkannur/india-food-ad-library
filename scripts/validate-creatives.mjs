// Nightly hygiene (local alternative): soft-flag approved ads whose creative no
// longer loads so they sink to the bottom of listings. CI uses POST /validate on
// the scraper worker instead, so no extra GitHub secrets are needed. This
// script is for local runs with .env.local. Only hits the CDN URLs stored on the
// ad (fbcdn etc). Never touches the Meta Ads Library search, so no scraping
// load and no browser/AI cost.
import { setTimeout as sleep } from "node:timers/promises";

const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DRY_RUN = ["1", "true"].includes(String(process.env.DRY_RUN || "").toLowerCase());
const LIMIT = process.env.LIMIT ? Math.max(1, Number(process.env.LIMIT)) : 5000;
const CONCURRENCY = Math.min(10, Math.max(1, Number(process.env.CONCURRENCY || "5")));
const TIMEOUT_MS = Math.min(30000, Math.max(5000, Number(process.env.TIMEOUT_MS || "15000")));

if (!baseUrl || !serviceKey) {
  throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
}

const dbHeaders = {
  apikey: serviceKey,
  Authorization: `Bearer ${serviceKey}`,
  "Content-Type": "application/json",
};

async function supabaseGet(path) {
  const response = await fetch(`${baseUrl}/rest/v1/${path}`, { headers: dbHeaders });
  if (!response.ok) throw new Error(`Supabase GET failed (${response.status}): ${(await response.text()).slice(0, 300)}`);
  return response.json();
}

async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { ...options, signal: controller.signal, redirect: "follow" });
  } finally {
    clearTimeout(timer);
  }
}

// A creative counts as alive if the CDN returns 2xx/3xx for HEAD, or for a
// 1-byte range GET (some CDNs reject HEAD with 403/405 while GET works).
async function urlAlive(url) {
  if (!url || !/^https:\/\//i.test(url)) return false;
  const headers = {
    Referer: "https://www.facebook.com/",
    "User-Agent": "IndiaFoodAdLibrary/1.0 (creative-health-check)",
  };
  try {
    const head = await fetchWithTimeout(url, { method: "HEAD", headers });
    if (head.ok) return true;
    // Fall through to range GET on 400/403/405; treat 5xx/network as retryable once.
    if (![400, 401, 403, 405, 429, 500, 502, 503].includes(head.status)) return false;
  } catch {
    // HEAD failed (timeout/abort) — try range GET below.
  }
  try {
    const get = await fetchWithTimeout(url, { headers: { ...headers, Range: "bytes=0-0" } });
    // 206 = partial content, 200 = full (server ignored Range) — both mean alive.
    return get.ok;
  } catch {
    return false;
  }
}

async function adAlive(ad) {
  if (await urlAlive(ad.creative_url)) return true;
  if (await urlAlive(ad.thumbnail_url)) return true;
  return false;
}

async function runPool(items, worker) {
  const results = new Array(items.length);
  let cursor = 0;
  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, items.length) }, async () => {
      while (cursor < items.length) {
        const index = cursor;
        cursor += 1;
        results[index] = await worker(items[index], index);
        // Small gap so we don't burst the CDN.
        await sleep(100);
      }
    }),
  );
  return results;
}

// Page through approved ads (PostgREST default caps at 1000 rows). Skip ads
// already soft-flagged so the nightly run only re-checks candidates.
const FLAG_NOTE = "Auto-hidden: creative no longer loads from its original source";
const ads = [];
const PAGE = 500;
for (let offset = 0; ; offset += PAGE) {
  const rows = await supabaseGet(
    `ads?status=eq.approved&select=id,source_ad_id,creative_url,thumbnail_url&reviewer_notes=not.like.${encodeURIComponent(FLAG_NOTE)}&order=updated_at.asc&limit=${PAGE}&offset=${offset}`,
  );
  ads.push(...rows);
  if (rows.length < PAGE || ads.length >= LIMIT) break;
}
const scope = ads.slice(0, LIMIT);
console.log(`Checking ${scope.length} approved ad(s)${DRY_RUN ? " (dry run)" : ""}...`);

const broken = [];
await runPool(scope, async (ad) => {
  const alive = await adAlive(ad);
  if (!alive) broken.push(ad);
  return alive;
});

console.log(`Alive: ${scope.length - broken.length}; broken: ${broken.length}.`);

if (!broken.length) {
  console.log("Nothing to flag.");
  process.exit(0);
}

if (DRY_RUN) {
  for (const ad of broken.slice(0, 20)) {
    console.log(`would soft-flag: ${ad.id} (source_ad_id=${ad.source_ad_id || "n/a"})`);
  }
  if (broken.length > 20) console.log(`...and ${broken.length - 20} more`);
  process.exit(0);
}

const now = new Date().toISOString();
let flagged = 0;
for (const ad of broken) {
  const response = await fetch(`${baseUrl}/rest/v1/ads?id=eq.${encodeURIComponent(ad.id)}`, {
    method: "PATCH",
    headers: { ...dbHeaders, Prefer: "return=minimal" },
    body: JSON.stringify({
      // Soft-hide: keep status=approved so the ad stays in the catalogue but is
      // ranked last via isPreviewUnavailable + shown with an "Expired" badge.
      reviewer_notes: FLAG_NOTE,
      reviewed_at: now,
      updated_at: now,
    }),
  });
  if (!response.ok) {
    console.error(`Failed to flag ${ad.id}: ${response.status} ${(await response.text()).slice(0, 200)}`);
    continue;
  }
  flagged += 1;
}

console.log(`Soft-flagged ${flagged}/${broken.length} ad(s) with dead previews (kept approved, ranked last).`);
