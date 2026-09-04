import { launch } from "@cloudflare/playwright";
import { BRANDS } from "./brands.js";
import { selectDiverseCandidates } from "./diversity.js";

const GEMINI_MODEL = "gemini-3.1-flash-lite";
const GEMINI_VIDEO_SECONDS = 20;
const WORKERS_AI_MODEL = "@cf/meta/llama-3.2-11b-vision-instruct";
const MAX_AI_CLASSIFICATIONS_PER_RUN = 12;
const SCHEDULED_BATCH_SIZE = 24;
const WEEKLY_CRONS = ["30 0 * * SUN", "0 1 * * SUN", "30 1 * * SUN", "0 2 * * SUN", "30 2 * * SUN"];

const RUN_MODES = {
  backfill: { rawAds: 80, selectedAds: 60, scrollRounds: 10, maxBrands: 12, concurrency: 2 },
  refresh: { rawAds: 40, selectedAds: 20, scrollRounds: 5, maxBrands: 24, concurrency: 3 },
};

const HIGH_VOLUME_BRANDS = new Set([
  "amul", "haldirams", "bikaji", "paper-boat", "epigamia", "the-whole-truth", "yoga-bar", "slurrp-farm",
  "country-delight", "licious", "freshtohome", "wellbeing-nutrition", "oziva", "britannia", "parle-products",
  "maggi", "sunfeast", "lays-india", "kurkure", "cadbury-dairy-milk", "coca-cola-india", "pepsi-india",
  "mother-dairy", "mccain-india", "pintola", "aashirvaad", "tata-tea", "nescafe-india",
]);

function limitsForBrand(mode, brand) {
  const base = RUN_MODES[mode];
  if (HIGH_VOLUME_BRANDS.has(brand.slug)) return base;
  return {
    ...base,
    rawAds: Math.ceil(base.rawAds * 0.7),
    selectedAds: Math.ceil(base.selectedAds * 0.7),
  };
}

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

function creativeStyleFor(record) {
  const text = [record.headline, record.body].filter(Boolean).join(" ");
  if (/\b(recipe|ingredients|how to|steps|method|make at home)\b/i.test(text)) return "Recipe/how-to";
  if (/\b(my review|i tried|taste test|unboxing|pov|day in my life)\b/i.test(text)) return "UGC";
  if (/\b(customer|testimonial|review|people love|rated)\b/i.test(text)) return "Testimonial";
  if (/\b(save|discount|offer|deal|free|% off)\b|₹/i.test(text)) return "Offer";
  if (/\b(family|friends|morning|evening|workout|lunch|party|festival)\b/i.test(text)) return "Lifestyle";
  return record.video ? "Product demo" : "Product shot";
}

function sellingAngleFor(text) {
  if (/\b(protein|healthy|health|nutrition|calorie|sugar free|gluten free|organic)\b/i.test(text)) return "Health";
  if (/\b(quick|easy|instant|ready|minutes|on the go|convenient)\b/i.test(text)) return "Convenience";
  if (/\b(save|discount|offer|deal|free|value|% off)\b|₹/i.test(text)) return "Value";
  if (/\b(ingredient|natural|clean label|no preservative|whole grain)\b/i.test(text)) return "Ingredients";
  if (/\b(tradition|traditional|homemade|ghar|maa|nostalgia|heritage)\b/i.test(text)) return "Tradition/emotion";
  if (/\b(review|rated|loved by|customer|testimonial)\b/i.test(text)) return "Social proof";
  return "Taste/craving";
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

async function extractPage(page, brand, limits) {
  await page.goto(targetUrl(brand), { waitUntil: "domcontentloaded", timeout: 60_000 });
  try {
    await page.waitForFunction(() => document.body?.innerText.includes("Library ID:"), null, { timeout: 12_000 });
  } catch {
    await page.waitForTimeout(2_500);
  }

  let previousCount = 0;
  let stagnantRounds = 0;
  for (let round = 0; round < limits.scrollRounds; round += 1) {
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(1_200);
    const count = await page.evaluate(() => (document.body?.innerText.match(/Library ID:/g) || []).length);
    stagnantRounds = count <= previousCount ? stagnantRounds + 1 : 0;
    previousCount = count;
    if (count >= limits.rawAds * 2 || stagnantRounds >= 2) break;
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
  }, limits.rawAds * 3);

  return records.filter((record) => pageMatchesBrand(record.page_name, brand)).slice(0, limits.rawAds);
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
    creative_style: creativeStyleFor(record),
    selling_angle: sellingAngleFor(text),
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

function chunks(items, size) {
  const output = [];
  for (let index = 0; index < items.length; index += size) output.push(items.slice(index, index + size));
  return output;
}

async function existingAdsForSourceIds(env, sourceIds) {
  const rows = [];
  for (const group of chunks([...new Set(sourceIds)], 150)) {
    if (!group.length) continue;
    rows.push(...await supabase(
      env,
      `ads?source_ad_id=in.(${group.join(",")})&select=brand_id,source_ad_id,creative_style,selling_angle`,
    ));
  }
  return rows;
}

async function inventoryForBrandIds(env, brandIds) {
  const rows = [];
  for (const group of chunks([...new Set(brandIds)], 20)) {
    if (!group.length) continue;
    rows.push(...await supabase(
      env,
      `ads?brand_id=in.(${group.join(",")})&select=brand_id,source_ad_id,format,hook,creative_style,selling_angle,headline,body_copy,creative_url,thumbnail_url&limit=5000`,
    ));
  }
  return rows;
}

async function upsertAds(env, rows) {
  for (const group of chunks(rows, 150)) {
    await supabase(env, "ads?on_conflict=platform,source_ad_id", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify(group),
    });
  }
}

function base64FromBytes(bytes) {
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  }
  return btoa(binary);
}

function parseClassificationJson(value) {
  if (value && typeof value === "object" && value.response && typeof value.response === "object") return value.response;
  const text = typeof value === "string" ? value : value?.response;
  if (!text) throw new Error("Workers AI returned no classification response");
  const clean = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
  const start = clean.indexOf("{");
  const end = clean.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("Workers AI returned invalid classification JSON");
  return JSON.parse(clean.slice(start, end + 1));
}

function pilotMediaFor(ad) {
  const isVideo = /video/i.test(ad.format || "");
  if (isVideo) return ad.thumbnail_url ? { url: ad.thumbnail_url, source: "video-thumbnail" } : null;
  const url = ad.creative_url || ad.thumbnail_url;
  return url ? { url, source: ad.creative_url ? "image" : "thumbnail" } : null;
}

async function classifyWithWorkersAI(env, ad) {
  if (!env.AI) throw new Error("Workers AI binding is missing");
  const media = pilotMediaFor(ad);
  if (!media) throw new Error("No usable image or video thumbnail");

  const mediaResponse = await fetch(media.url, {
    headers: { Referer: "https://www.facebook.com/", "User-Agent": "IndiaFoodAdLibrary/1.0" },
  });
  if (!mediaResponse.ok) throw new Error(`Creative download failed (${mediaResponse.status})`);
  const mimeType = mediaResponse.headers.get("content-type")?.split(";")[0] || "image/jpeg";
  const bytes = new Uint8Array(await mediaResponse.arrayBuffer());
  if (bytes.byteLength > 8 * 1024 * 1024) throw new Error("Creative is larger than the pilot limit");

  const prompt = `Classify this Indian food advertisement for a creative research library. Use the image and copy together. Return JSON only with exactly these keys: creative_style, selling_angle, hook, funnel_stage, language, offer_present. Use these values only.
creative_style: Product demo, Recipe/how-to, UGC, Testimonial, Product shot, Lifestyle, Offer
selling_angle: Taste/craving, Health, Convenience, Value, Ingredients, Tradition/emotion, Social proof
hook: Offer-led, Education, Problem / solution, Social proof, Product-first
funnel_stage: Awareness, Consideration, Conversion
language: English, Hindi, Hinglish, Other
offer_present: true or false
Brand: ${ad.brand?.name || "Unknown"}
Product category: ${ad.category || "Unknown"}
Headline: ${ad.headline || "None"}
Copy: ${ad.body_copy || "None"}`;

  const result = await env.AI.run(WORKERS_AI_MODEL, {
    messages: [
      { role: "system", content: "You are a precise advertising analyst. Do not invent details that are not visible or stated." },
      { role: "user", content: prompt },
    ],
    image: `data:${mimeType};base64,${base64FromBytes(bytes)}`,
    response_format: {
      type: "json_schema",
      json_schema: {
        type: "object",
        properties: {
          creative_style: { type: "string" },
          selling_angle: { type: "string" },
          hook: { type: "string" },
          funnel_stage: { type: "string" },
          language: { type: "string" },
          offer_present: { type: "boolean" },
        },
        required: ["creative_style", "selling_angle", "hook", "funnel_stage", "language", "offer_present"],
      },
    },
    max_tokens: 160,
    temperature: 0,
  });
  const labels = parseClassificationJson(result);
  return {
    labels: {
      creative_style: labels.creative_style || null,
      selling_angle: labels.selling_angle || null,
      hook: labels.hook || null,
      funnel_stage: labels.funnel_stage || null,
      language: labels.language || null,
      offer_present: typeof labels.offer_present === "boolean" ? labels.offer_present : null,
    },
    media_source: media.source,
    usage: result.usage || null,
  };
}

async function pilotClassify(env, limit) {
  const rows = await supabase(
    env,
    "ads?status=eq.approved&select=id,source_ad_id,format,language,category,headline,body_copy,creative_url,thumbnail_url,brand:brands(name)&order=submitted_at.desc&limit=50",
  );
  const imageAds = rows.filter((ad) => !/video/i.test(ad.format || "") && pilotMediaFor(ad)).slice(0, Math.ceil(limit * 0.6));
  const videoAds = rows.filter((ad) => /video/i.test(ad.format || "") && pilotMediaFor(ad)).slice(0, Math.floor(limit * 0.4));
  const selected = [...imageAds, ...videoAds];
  for (const ad of rows) {
    if (selected.length >= limit) break;
    if (!selected.includes(ad) && pilotMediaFor(ad)) selected.push(ad);
  }

  const results = [];
  for (const ad of selected.slice(0, limit)) {
    try {
      const classification = await classifyWithWorkersAI(env, ad);
      results.push({
        id: ad.id,
        source_ad_id: ad.source_ad_id,
        brand: ad.brand?.name || "Unknown",
        format: ad.format,
        labels: classification.labels,
        media_source: classification.media_source,
        usage: classification.usage,
      });
    } catch (error) {
      results.push({
        id: ad.id,
        source_ad_id: ad.source_ad_id,
        brand: ad.brand?.name || "Unknown",
        format: ad.format,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
  return {
    ok: results.length > 0 && results.every((item) => !item.error),
    model: WORKERS_AI_MODEL,
    requested: limit,
    attempted: results.length,
    classified: results.filter((item) => !item.error).length,
    writes: 0,
    results,
  };
}

async function publishPendingAds(env) {
  const now = new Date().toISOString();
  const rows = await supabase(
    env,
    "ads?status=eq.pending&source_ad_id=not.is.null&creative_url=not.is.null&select=id",
    {
      method: "PATCH",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({
        status: "approved",
        approved_at: now,
        reviewed_at: now,
        reviewer_notes: "Bulk approved after automated Meta source and media validation",
        updated_at: now,
      }),
    },
  );
  return rows.length;
}

function balancedCandidateSample(groups, limit) {
  const eligible = groups.map((group) => group.candidates.filter((ad) =>
    ad.creative_url && ad.format === "Image"
  ));
  const selected = [];
  let depth = 0;

  while (selected.length < limit) {
    const available = eligible
      .map((candidates) => candidates[depth])
      .filter(Boolean);
    if (!available.length) break;

    const remaining = limit - selected.length;
    if (available.length <= remaining) selected.push(...available);
    else {
      for (let index = 0; index < remaining; index += 1) {
        selected.push(available[Math.floor(index * available.length / remaining)]);
      }
    }
    depth += 1;
  }

  return selected;
}

async function queueAds(env, discoveries, options) {
  const recordsFound = discoveries.reduce((total, item) => total + item.records.length, 0);
  if (!recordsFound) {
    return {
      queued: 0,
      refreshed: 0,
      skippedSimilar: 0,
      skippedCluster: 0,
      skippedCapacity: 0,
      classificationAttempts: 0,
      classified: 0,
      results: [],
    };
  }

  const configuredBrands = [...new Map(discoveries.map(({ brand }) => [brand.slug, brand])).values()];
  const brandRows = await supabase(env, "brands?on_conflict=slug&select=id,slug", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=representation" },
    body: JSON.stringify(configuredBrands.map(({ name, slug, category }) => ({ name, slug, category }))),
  });
  const brandIds = new Map(brandRows.map((row) => [row.slug, row.id]));
  const brandNamesById = new Map(configuredBrands.map((brand) => [brandIds.get(brand.slug), brand.name]));
  const sourceIds = discoveries.flatMap(({ records }) => records.map((record) => record.id));
  const existingRows = await existingAdsForSourceIds(env, sourceIds);
  const existingBySource = new Map(existingRows.map((row) => [row.source_ad_id, row]));
  const inventoryRows = await inventoryForBrandIds(env, [...brandIds.values()]);
  const inventoryByBrand = new Map();
  for (const row of inventoryRows) {
    const current = inventoryByBrand.get(row.brand_id) || [];
    current.push(row);
    inventoryByBrand.set(row.brand_id, current);
  }

  const timestamp = new Date().toISOString();
  const refreshRows = [];
  const newRows = [];
  const results = [];
  const candidateGroups = [];
  let skippedSimilar = 0;
  let skippedCluster = 0;
  let skippedCapacity = 0;

  for (const { brand, records, limits } of discoveries) {
    const brandId = brandIds.get(brand.slug);
    const candidates = [];
    let refreshed = 0;
    for (const record of records) {
      const ad = { ...toAd(record, brand, timestamp), brand_id: brandId };
      const prior = existingBySource.get(record.id);
      if (prior) {
        refreshRows.push({
          ...ad,
          creative_style: prior.creative_style || ad.creative_style,
          selling_angle: prior.selling_angle || ad.selling_angle,
        });
        refreshed += 1;
      } else {
        candidates.push(ad);
      }
    }

    const deduplicated = selectDiverseCandidates(candidates, inventoryByBrand.get(brandId) || [], {
      maxSelected: candidates.length,
    });
    candidateGroups.push({
      brand,
      brandId,
      limits,
      found: records.length,
      candidateCount: candidates.length,
      candidates: deduplicated.selected,
      refreshed,
      skippedSimilar: deduplicated.skippedSimilar,
    });
    skippedSimilar += deduplicated.skippedSimilar;
  }

  let classificationAttempts = 0;
  let classified = 0;
  const aiLimit = Math.min(options.aiLimit || 0, MAX_AI_CLASSIFICATIONS_PER_RUN);
  const aiCandidates = env.GEMINI_API_KEY ? balancedCandidateSample(candidateGroups, aiLimit) : [];
  for (const ad of aiCandidates) {
    classificationAttempts += 1;
    try {
      const labels = await classifyWithGemini(env, { ...ad, brand_name: brandNamesById.get(ad.brand_id) });
      if (labels) {
        Object.assign(ad, labels);
        classified += 1;
      }
    } catch (error) {
      console.log(JSON.stringify({ event: "gemini_classification_failed", source_ad_id: ad.source_ad_id, error: error instanceof Error ? error.message : String(error) }));
    }
  }

  for (const group of candidateGroups) {
    const selection = selectDiverseCandidates(group.candidates, [], {
      maxSelected: group.limits.selectedAds,
    });
    newRows.push(...selection.selected);
    skippedCluster += selection.skippedCluster;
    skippedCapacity += selection.skippedCapacity;
    results.push({
      brand: group.brand.slug,
      found: group.found,
      new_candidates: group.candidateCount,
      queued: selection.selected.length,
      refreshed: group.refreshed,
      skipped_similar: group.skippedSimilar,
      skipped_cluster: selection.skippedCluster,
      skipped_capacity: selection.skippedCapacity,
    });
  }

  const rowsBySource = new Map([...refreshRows, ...newRows].map((row) => [row.source_ad_id, row]));
  await upsertAds(env, [...rowsBySource.values()]);
  return {
    queued: newRows.length,
    refreshed: refreshRows.length,
    skippedSimilar,
    skippedCluster,
    skippedCapacity,
    classificationAttempts,
    classified,
    results,
  };
}

async function run(env, selectedBrands, options) {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) throw new Error("Supabase secrets are missing");
  const startedAt = Date.now();
  const mode = options.mode;
  const config = RUN_MODES[mode];
  const browser = await launch(env.BROWSER, { keep_alive: 600_000 });
  const discoveries = new Array(selectedBrands.length);
  const failures = [];
  let cursor = 0;

  async function collect() {
    const context = await browser.newContext({
      locale: "en-IN",
      timezoneId: "Asia/Kolkata",
      viewport: { width: 1440, height: 1100 },
    });
    const page = await context.newPage();
    try {
      while (cursor < selectedBrands.length) {
        const index = cursor;
        cursor += 1;
        const brand = selectedBrands[index];
        const limits = limitsForBrand(mode, brand);
        try {
          const records = await extractPage(page, brand, limits);
          discoveries[index] = { brand, records, limits };
        } catch (error) {
          failures.push({ brand: brand.slug, error: error instanceof Error ? error.message : String(error) });
        }
      }
    } finally {
      await context.close();
    }
  }

  try {
    const concurrency = Math.min(config.concurrency, selectedBrands.length);
    await Promise.all(Array.from({ length: concurrency }, () => collect()));
  } finally {
    await browser.close();
  }

  const completedDiscoveries = discoveries.filter(Boolean);
  const discovered = completedDiscoveries.reduce((total, item) => total + item.records.length, 0);
  const queueReport = await queueAds(env, completedDiscoveries, options);
  const published = options.publishPending ? await publishPendingAds(env) : 0;
  return {
    ok: failures.length === 0,
    mode,
    brands: selectedBrands.length,
    discovered,
    ...queueReport,
    published,
    duration_ms: Date.now() - startedAt,
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
      return Response.json({
        ok: true,
        service: "india-food-ad-scraper",
        brands: BRANDS.length,
        modes: Object.keys(RUN_MODES),
        schedule: "weekly",
      });
    }
    if (request.method === "POST" && url.pathname === "/pilot") {
      if (!authorized(request, env)) return new Response("Unauthorized", { status: 401 });
      const limit = boundedInteger(url.searchParams.get("limit"), 10, 1, 10);
      try {
        return Response.json(await pilotClassify(env, limit));
      } catch (error) {
        return Response.json({ error: error instanceof Error ? error.message : String(error), writes: 0 }, { status: 500 });
      }
    }
    if (request.method !== "POST" || url.pathname !== "/run") return new Response("Not found", { status: 404 });
    if (!authorized(request, env)) return new Response("Unauthorized", { status: 401 });

    const mode = url.searchParams.get("mode") === "refresh" ? "refresh" : "backfill";
    const config = RUN_MODES[mode];
    const slug = url.searchParams.get("brand");
    const limit = boundedInteger(url.searchParams.get("limit"), config.maxBrands, 1, config.maxBrands);
    const offset = boundedInteger(url.searchParams.get("offset"), 0, 0, Math.max(BRANDS.length - 1, 0));
    const aiLimit = boundedInteger(url.searchParams.get("ai"), 0, 0, MAX_AI_CLASSIFICATIONS_PER_RUN);
    const publishPending = ["1", "true"].includes(url.searchParams.get("publish")?.toLowerCase());
    const selected = slug
      ? BRANDS.filter((brand) => brand.slug === slug)
      : BRANDS.slice(offset, offset + limit);
    if (!selected.length) return Response.json({ error: "Unknown brand" }, { status: 400 });

    try {
      return Response.json(await run(env, selected, { mode, aiLimit, publishPending }));
    } catch (error) {
      return Response.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
    }
  },

  async scheduled(controller, env, ctx) {
    const slot = Math.max(WEEKLY_CRONS.indexOf(controller.cron), 0);
    const offset = slot * SCHEDULED_BATCH_SIZE;
    const selected = BRANDS.slice(offset, offset + SCHEDULED_BATCH_SIZE);
    if (selected.length) ctx.waitUntil(run(env, selected, { mode: "refresh", aiLimit: 0 }));
  },
};

export default worker;
