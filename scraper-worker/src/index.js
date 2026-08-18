import { launch } from "@cloudflare/playwright";
import { BRANDS } from "./brands.js";

const MAX_ADS_PER_BRAND = 16;
const MAX_MANUAL_BRANDS = 4;

function normalize(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function pageMatchesBrand(pageName, brand) {
  const page = normalize(pageName);
  return page && brand.aliases.some((alias) => {
    const candidate = normalize(alias);
    return candidate.length >= 4 && (page.includes(candidate) || candidate.includes(page));
  });
}

function languageFor(text) {
  if (/[ऀ-ॿ]/.test(text)) return "Hindi";
  if (/\b(kya|hai|hain|ka|ki|ke|se|aur|nahi|ab|apna|swad|swaad)\b/i.test(text)) return "Hinglish";
  return "English";
}

function hookFor(text) {
  if (/\b(save|off|discount|deal|offer|free|rs\.?\s?\d|% off)\b|₹/i.test(text)) return "Offer-led";
  if (/\b(how to|ways|tips|recipe|did you know)\b/i.test(text)) return "Education";
  if (/\b(why|problem|tired of|struggling|instead of)\b/i.test(text)) return "Problem / solution";
  if (/\b(review|customer|loved by|testimonial|people love)\b/i.test(text)) return "Social proof";
  return "Product-first";
}

function parseStartedAt(value) {
  const match = value?.match(/^Started running on (\d{1,2} [A-Z][a-z]{2} \d{4})/);
  if (!match) return null;
  const parsed = Date.parse(`${match[1]} 00:00:00 UTC`);
  return Number.isNaN(parsed) ? null : new Date(parsed).toISOString();
}

function targetUrl(brand) {
  const target = new URL("https://www.facebook.com/ads/library/");
  target.searchParams.set("active_status", "active");
  target.searchParams.set("ad_type", "all");
  target.searchParams.set("country", "IN");
  target.searchParams.set("media_type", "all");
  target.searchParams.set("q", brand.query);
  target.searchParams.set("search_type", "keyword_unordered");
  return target.toString();
}

async function extractPage(page, brand) {
  await page.goto(targetUrl(brand), { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.waitForTimeout(9_000);
  for (let round = 0; round < 2; round += 1) {
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(1_500);
  }

  const records = await page.evaluate((limit) => {
    const output = [];
    const seen = new Set();
    const idPattern = /Library ID:\s*(\d{5,})/i;
    const ctaPattern = /^(Shop now|Order now|Learn more|Buy now|Sign up|Get offer|Send message|Download|Install now)$/i;
    const noisePattern = /^(Active|Inactive|Platforms|See ad details|Open Drop-down|EU transparency|This ad has multiple versions|This ad has multiple versions of text)$/i;

    for (const node of document.querySelectorAll("div")) {
      if (output.length >= limit) break;
      const ownText = node.textContent?.trim() || "";
      const match = ownText.match(idPattern);
      if (!match || ownText.length > 180 || seen.has(match[1])) continue;

      let card = node;
      while (card.parentElement) {
        const parentText = card.parentElement.innerText || "";
        const idCount = (parentText.match(/Library ID:/gi) || []).length;
        if (idCount !== 1 || parentText.length > 12_000) break;
        card = card.parentElement;
      }

      const lines = (card.innerText || "")
        .split("\n")
        .map((line) => line.replace(/\s+/g, " ").trim())
        .filter(Boolean);
      const sponsoredIndex = lines.findIndex((line) => /^Sponsored$/i.test(line));
      if (sponsoredIndex < 1) continue;
      const pageName = lines[sponsoredIndex - 1];
      const cta = lines.find((line) => ctaPattern.test(line)) || null;
      const contentLines = lines.slice(sponsoredIndex + 1).filter((line) =>
        !idPattern.test(line)
        && !/^Started running on /i.test(line)
        && !noisePattern.test(line)
        && !ctaPattern.test(line)
        && !/^https?:\/\//i.test(line)
        && !/^[A-Z0-9.-]+\.(COM|IN|CO|NET|ORG)/.test(line)
        && !/^\d+:\d+ \/ \d+:\d+$/.test(line)
        && line !== pageName
      );
      const body = [...contentLines].sort((left, right) => right.length - left.length)[0] || null;
      const headline = contentLines.find((line) => line !== body && line.length >= 5 && line.length <= 120) || null;
      const images = [...card.querySelectorAll("img")]
        .map((image) => ({
          src: image.currentSrc || image.src,
          area: (image.naturalWidth || image.width || 0) * (image.naturalHeight || image.height || 0),
        }))
        .filter((image) => /^https?:\/\//.test(image.src))
        .sort((left, right) => right.area - left.area);
      const videoElement = card.querySelector("video");
      const video = videoElement?.currentSrc
        || videoElement?.src
        || card.querySelector("video source")?.src
        || null;
      const poster = videoElement?.poster || null;

      seen.add(match[1]);
      output.push({
        id: match[1],
        page_name: pageName,
        body,
        headline,
        cta,
        started: lines.find((line) => /^Started running on /i.test(line)) || null,
        image: poster || images[0]?.src || null,
        video,
      });
    }
    return output;
  }, MAX_ADS_PER_BRAND * 3);

  return records.filter((record) => pageMatchesBrand(record.page_name, brand)).slice(0, MAX_ADS_PER_BRAND);
}

function toAd(record, brand, timestamp) {
  const text = [record.headline, record.body].filter(Boolean).join(" ");
  const creative = record.video || record.image;
  return {
    platform: "meta",
    source_ad_id: record.id,
    source_url: `https://www.facebook.com/ads/library/?id=${record.id}`,
    headline: record.headline?.slice(0, 300) || null,
    body_copy: record.body?.slice(0, 1600) || null,
    cta: record.cta?.slice(0, 120) || null,
    format: record.video ? "Video" : record.image ? "Image" : "Unknown",
    language: languageFor(text),
    category: brand.category,
    hook: hookFor(text),
    funnel_stage: /shop now|buy now|order now|get offer/i.test(record.cta || "") ? "Conversion" : "Consideration",
    creative_url: creative,
    thumbnail_url: record.image,
    creative_theme: "auto-imported",
    started_at: parseStartedAt(record.started),
    last_seen_at: timestamp,
  };
}

async function supabase(env, path, options = {}) {
  const response = await fetch(`${env.SUPABASE_URL.replace(/\/$/, "")}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
  if (!response.ok) throw new Error(`Supabase ${response.status}: ${(await response.text()).slice(0, 500)}`);
  const body = await response.text();
  return body ? JSON.parse(body) : null;
}

async function queueAds(env, discoveries) {
  const recordsFound = discoveries.reduce((total, item) => total + item.records.length, 0);
  if (!recordsFound) return 0;
  const configuredBrands = [...new Map(discoveries.filter((item) => item.records.length).map(({ brand }) => [brand.slug, brand])).values()];
  const brandRows = await supabase(env, "brands?on_conflict=slug&select=id,slug", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=representation" },
    body: JSON.stringify(configuredBrands.map(({ name, slug, category }) => ({ name, slug, category }))),
  });
  const brandIds = new Map(brandRows.map((row) => [row.slug, row.id]));
  const timestamp = new Date().toISOString();
  const rows = discoveries.flatMap(({ brand, records }) => records.map((record) => ({
    ...toAd(record, brand, timestamp),
    brand_id: brandIds.get(brand.slug),
  })));
  const inserted = await supabase(env, "ads?on_conflict=platform,source_ad_id&select=id", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=representation" },
    body: JSON.stringify(rows),
  });
  return inserted.length;
}

async function run(env, selectedBrands) {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) throw new Error("Supabase secrets are missing");
  const browser = await launch(env.BROWSER, { keep_alive: 600_000 });
  const discoveries = [];
  const failures = [];
  try {
    const context = await browser.newContext({
      locale: "en-IN",
      timezoneId: "Asia/Kolkata",
      viewport: { width: 1440, height: 1100 },
    });
    const page = await context.newPage();
    for (const brand of selectedBrands) {
      try {
        const records = await extractPage(page, brand);
        discoveries.push({ brand, records });
      } catch (error) {
        failures.push({ brand: brand.slug, error: error instanceof Error ? error.message : String(error) });
      }
    }
  } finally {
    await browser.close();
  }
  const discovered = discoveries.reduce((total, item) => total + item.records.length, 0);
  const queued = await queueAds(env, discoveries);
  return {
    ok: failures.length === 0,
    brands: selectedBrands.length,
    discovered,
    queued,
    results: discoveries.map(({ brand, records }) => ({ brand: brand.slug, found: records.length })),
    failures,
  };
}

function authorized(request, env) {
  return env.RUN_TOKEN && request.headers.get("Authorization") === `Bearer ${env.RUN_TOKEN}`;
}

function boundedInteger(value, fallback, minimum, maximum) {
  if (value === null || value === "") return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.min(Math.max(Math.trunc(parsed), minimum), maximum) : fallback;
}

const worker = {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === "GET" && url.pathname === "/health") {
      return Response.json({ ok: true, service: "india-food-ad-scraper", brands: BRANDS.length });
    }
    if (request.method !== "POST" || url.pathname !== "/run") return new Response("Not found", { status: 404 });
    if (!authorized(request, env)) return new Response("Unauthorized", { status: 401 });

    const slug = url.searchParams.get("brand");
    const limit = boundedInteger(url.searchParams.get("limit"), MAX_MANUAL_BRANDS, 1, MAX_MANUAL_BRANDS);
    const offset = boundedInteger(url.searchParams.get("offset"), 0, 0, Math.max(BRANDS.length - 1, 0));
    const selected = slug
      ? BRANDS.filter((brand) => brand.slug === slug)
      : BRANDS.slice(offset, offset + limit);
    if (!selected.length) return Response.json({ error: "Unknown brand" }, { status: 400 });

    try {
      return Response.json(await run(env, selected));
    } catch (error) {
      return Response.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
    }
  },

  async scheduled(controller, env, ctx) {
    const batchCount = Math.ceil(BRANDS.length / MAX_MANUAL_BRANDS);
    const scheduledDay = Math.floor(controller.scheduledTime / 86_400_000);
    const batchOffset = (scheduledDay % batchCount) * MAX_MANUAL_BRANDS;
    ctx.waitUntil(run(env, BRANDS.slice(batchOffset, batchOffset + MAX_MANUAL_BRANDS)));
  },
};

export default worker;
