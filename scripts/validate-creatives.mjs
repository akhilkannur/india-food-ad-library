// Local alternative to the worker validation job. CI uses POST /validate on the
// scraper worker instead, so no extra GitHub secrets are needed. This script is
// for local runs with .env.local and only checks stored CDN URLs.
import { setTimeout as sleep } from "node:timers/promises";
import { creativeUrlStatus, previewUrlForValidation } from "../scraper-worker/src/creative-validation.js";

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

// Page through approved ads (PostgREST default caps at 1000 rows).
const ads = [];
const PAGE = 500;
for (let offset = 0; ; offset += PAGE) {
  const rows = await supabaseGet(
    `ads?status=eq.approved&select=id,source_ad_id,format,creative_url,thumbnail_url&order=updated_at.asc&limit=${PAGE}&offset=${offset}`,
  );
  ads.push(...rows);
  if (rows.length < PAGE || ads.length >= LIMIT) break;
}
const scope = ads.slice(0, LIMIT);
console.log(`Checking ${scope.length} approved ad(s)${DRY_RUN ? " (dry run)" : ""}...`);

const broken = [];
const unresolved = [];
await runPool(scope, async (ad) => {
  const status = await creativeUrlStatus(previewUrlForValidation(ad), { timeoutMs: TIMEOUT_MS });
  if (status === "dead") broken.push(ad);
  if (status === "unresolved") unresolved.push(ad);
  return status;
});

console.log(`Alive: ${scope.length - broken.length - unresolved.length}; broken: ${broken.length}; unresolved: ${unresolved.length}.`);

if (!broken.length) {
  console.log("Nothing to purge.");
  if (unresolved.length) process.exitCode = 1;
  process.exit();
}

if (DRY_RUN) {
  for (const ad of broken.slice(0, 20)) {
    console.log(`would purge: ${ad.id} (source_ad_id=${ad.source_ad_id || "n/a"})`);
  }
  if (broken.length > 20) console.log(`...and ${broken.length - 20} more`);
  if (unresolved.length) process.exitCode = 1;
  process.exit();
}

let purged = 0;
for (const ad of broken) {
  const response = await fetch(`${baseUrl}/rest/v1/ads?id=eq.${encodeURIComponent(ad.id)}`, {
    method: "DELETE",
    headers: { ...dbHeaders, Prefer: "return=minimal" },
  });
  if (!response.ok) {
    console.error(`Failed to purge ${ad.id}: ${response.status} ${(await response.text()).slice(0, 200)}`);
    continue;
  }
  purged += 1;
}

console.log(`Purged ${purged}/${broken.length} ad(s) with dead previews.`);
if (unresolved.length || purged !== broken.length) process.exitCode = 1;
