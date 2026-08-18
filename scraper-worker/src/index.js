import { launch } from "@cloudflare/playwright";
import { BRANDS } from "./brands.js";

const MAX_ADS_PER_BRAND = 16;
const MAX_MANUAL_BRANDS = 4;
const GEMINI_MODEL = "gemini-3.1-flash-lite";
const GEMINI_VIDEO_SECONDS = 20;

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

const classificationSchema = {
  type: "OBJECT",
  properties: {
    creative_style: {
      type: "STRING",
      enum: ["Product demo", "Recipe/how-to", "UGC", "Testimonial", "Product shot", "Lifestyle", "Offer"],
    },
    selling_angle: {
      type: "STRING",
      enum: ["Taste/craving", "Health", "Convenience", "Value", "Ingredients", "Tradition/emotion", "Social proof"],
    },
  },
  required: ["creative_style", "selling_angle"],
};

async function geminiFileUpload(env, bytes, mimeType, displayName) {
  const base = "https://generativelanguage.googleapis.com";
  const query = `?key=${encodeURIComponent(env.GEMINI_API_KEY)}`;
  const start = await fetch(`${base}/upload/v1beta/files${query}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Upload-Protocol": "resumable",
      "X-Goog-Upload-Command": "start",
      "X-Goog-Upload-Header-Content-Length": String(bytes.byteLength),
      "X-Goog-Upload-Header-Content-Type": mimeType,
    },
    body: JSON.stringify({ file: { displayName } }),
  });
  if (!start.ok) throw new Error(`Gemini upload start failed (${start.status})`);
  const uploadUrl = start.headers.get("x-goog-upload-url");
  if (!uploadUrl) throw new Error("Gemini did not return an upload URL");
  const uploaded = await fetch(uploadUrl, {
    method: "POST",
    headers: {
      "Content-Type": mimeType,
      "X-Goog-Upload-Offset": "0",
      "X-Goog-Upload-Command": "upload, finalize",
    },
    body: bytes,
  });
  if (!uploaded.ok) throw new Error(`Gemini video upload failed (${uploaded.status})`);
  let file = (await uploaded.json()).file;
  for (let attempt = 0; file?.state === "PROCESSING" && attempt < 30; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 1_500));
    const status = await fetch(`${base}/v1beta/${file.name}${query}`);
    if (!status.ok) throw new Error(`Gemini file status failed (${status.status})`);
    file = await status.json();
  }
  if (file?.state !== "ACTIVE") throw new Error(`Gemini video is ${file?.state || "unavailable"}`);
  return file;
}

async function classifyWithGemini(env, ad) {
  if (!env.GEMINI_API_KEY || !ad.creative_url || !["Image", "Video"].includes(ad.format)) return null;
  const mediaResponse = await fetch(ad.creative_url, {
    headers: { Referer: "https://www.facebook.com/", "User-Agent": "IndiaFoodAdLibrary/1.0" },
  });
  if (!mediaResponse.ok) throw new Error(`Creative download failed (${mediaResponse.status})`);
  const mimeType = mediaResponse.headers.get("content-type")?.split(";")[0]
    || (ad.format === "Video" ? "video/mp4" : "image/jpeg");
  const bytes = await mediaResponse.arrayBuffer();
  const base = "https://generativelanguage.googleapis.com";
  const query = `?key=${encodeURIComponent(env.GEMINI_API_KEY)}`;
  let uploadedFile = null;
  try {
    let mediaPart;
    if (ad.format === "Video") {
      uploadedFile = await geminiFileUpload(env, bytes, mimeType, `ad-${ad.source_ad_id || ad.id}`);
      mediaPart = {
        fileData: { mimeType: uploadedFile.mimeType, fileUri: uploadedFile.uri },
        videoMetadata: { startOffset: "0s", endOffset: `${GEMINI_VIDEO_SECONDS}s`, fps: 1 },
        mediaResolution: { level: "MEDIA_RESOLUTION_LOW" },
      };
    } else {
      mediaPart = {
        inlineData: { mimeType, data: "" },
        mediaResolution: { level: "MEDIA_RESOLUTION_LOW" },
      };
      let binary = "";
      for (const byte of new Uint8Array(bytes)) binary += String.fromCharCode(byte);
      mediaPart.inlineData.data = btoa(binary);
    }
    const prompt = `Classify this Indian food ad for a creative library. Use the actual creative and the copy as context. Return JSON only.\nBrand: ${ad.brand_name || "Unknown"}\nCategory: ${ad.category || "Unknown"}\nHeadline: ${ad.headline || "None"}\nCopy: ${ad.body_copy || "None"}`;
    const requestBody = {
      contents: [{ role: "user", parts: [{ text: prompt }, mediaPart] }],
      generationConfig: { temperature: 0, maxOutputTokens: 120, responseMimeType: "application/json", responseSchema: classificationSchema },
    };
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const response = await fetch(`${base}/v1beta/models/${GEMINI_MODEL}:generateContent${query}`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(requestBody),
      });
      const payload = await response.json();
      if (response.ok) {
        const text = payload.candidates?.[0]?.content?.parts?.map((part) => part.text || "").join("") || "{}";
        const result = JSON.parse(text);
        return { creative_style: result.creative_style || null, selling_angle: result.selling_angle || null };
      }
      if (![429, 500, 502, 503].includes(response.status) || attempt === 2) {
        throw new Error(payload?.error?.message || `Gemini request failed (${response.status})`);
      }
      await new Promise((resolve) => setTimeout(resolve, 1_000 * (attempt + 1)));
    }
  } finally {
    if (uploadedFile?.name) await fetch(`${base}/v1beta/${uploadedFile.name}${query}`, { method: "DELETE" });
  }
  return null;
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
  const sourceIds = discoveries.flatMap(({ records }) => records.map((record) => record.id));
  const existingRows = sourceIds.length
    ? await supabase(env, `ads?source_ad_id=in.(${sourceIds.join(",")})&select=source_ad_id,creative_style,selling_angle`)
    : [];
  const existing = new Map(existingRows.map((row) => [row.source_ad_id, row]));
  const timestamp = new Date().toISOString();
  const rows = [];
  for (const { brand, records } of discoveries) {
    for (const record of records) {
      const ad = toAd(record, brand, timestamp);
      const prior = existing.get(record.id);
      let labels = prior || {};
      if ((!prior || (!prior.creative_style && !prior.selling_angle)) && env.GEMINI_API_KEY) {
        try {
          labels = await classifyWithGemini(env, { ...ad, brand_name: brand.name });
        } catch (error) {
          console.log(JSON.stringify({ event: "gemini_classification_failed", source_ad_id: record.id, error: error instanceof Error ? error.message : String(error) }));
        }
      }
      rows.push({ ...ad, ...labels, brand_id: brandIds.get(brand.slug) });
    }
  }
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
