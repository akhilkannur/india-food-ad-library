import { launch } from "@cloudflare/playwright";
import { BRANDS } from "./brands.js";
import { selectDiverseCandidates } from "./diversity.js";

const WORKERS_AI_MODEL = "@cf/meta/llama-3.2-11b-vision-instruct";
const MAX_WORKERS_AI_CLASSIFICATIONS_PER_RUN = 25;
const SCHEDULED_BATCH_SIZE = 24;
const WEEKLY_CRONS = [
  "30 0 * * SUN", "0 1 * * SUN", "30 1 * * SUN", "0 2 * * SUN",
  "30 2 * * SUN", "0 3 * * SUN", "30 3 * * SUN",
];

const CLASSIFICATION_OPTIONS = {
  category: [
    "Snacks", "Sweets & chocolate", "Beverages", "Dairy", "Spices & ingredients", "Staples",
    "Ready-to-eat & instant", "Ready-to-cook & frozen", "Health & nutrition", "Meat & seafood",
    "Fresh food", "Bakery", "Other",
  ],
  creative_style: ["Product shot", "Product demo", "Recipe/how-to", "UGC", "Testimonial", "Lifestyle", "Founder story"],
  selling_angle: ["Taste/craving", "Health", "Convenience", "Value", "Ingredients", "Tradition/emotion", "Social proof"],
  language: ["English", "Hindi", "Hinglish", "Other"],
};

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
      `ads?source_ad_id=in.(${group.join(",")})&select=brand_id,source_ad_id,category,language,creative_style,selling_angle`,
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

function validateWorkersLabels(labels) {
  if (!labels || typeof labels !== "object") throw new Error("Workers AI returned invalid classification JSON");
  const result = {
    product_category: labels.product_category || labels.category,
    creative_style: labels.creative_style,
    selling_angle: labels.selling_angle,
    language: labels.language,
  };
  const options = {
    product_category: CLASSIFICATION_OPTIONS.category,
    creative_style: CLASSIFICATION_OPTIONS.creative_style,
    selling_angle: CLASSIFICATION_OPTIONS.selling_angle,
    language: CLASSIFICATION_OPTIONS.language,
  };
  const valid = Object.entries(result).every(([field, value]) =>
    typeof value === "string" && options[field].includes(value),
  );
  if (!valid) throw new Error("Workers AI returned a missing or invalid single-label classification");
  return result;
}

function parseClassificationJson(value) {
  const direct = value && typeof value === "object" && value.product_category ? value : null;
  const nested = value && typeof value === "object" && value.response && typeof value.response === "object"
    ? value.response
    : null;
  const response = nested ?? value?.response ?? value?.result?.response ?? value?.result;
  if (direct) return validateWorkersLabels(direct);
  if (response && typeof response === "object") return validateWorkersLabels(response);
  const text = typeof value === "string" ? value : response;
  if (!text) throw new Error("Workers AI returned no classification response");
  const clean = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
  const start = clean.indexOf("{");
  const end = clean.lastIndexOf("}");
  if (start >= 0 && end > start) return validateWorkersLabels(JSON.parse(clean.slice(start, end + 1)));

  const normalized = clean.replace(/[*_]/g, "");
  const extract = (label) => {
    const match = normalized.match(new RegExp(`${label}\\s*:\\s*([^\\n]+)`, "i"));
    return match?.[1]?.trim() || "";
  };
  const choose = (label, options) => {
    const value = extract(label).toLocaleLowerCase();
    return options.find((option) => value.includes(option.toLocaleLowerCase())) || null;
  };
  return validateWorkersLabels({
    product_category: choose("Product Category", CLASSIFICATION_OPTIONS.category),
    creative_style: choose("Creative Style", CLASSIFICATION_OPTIONS.creative_style),
    selling_angle: choose("Selling Angle", CLASSIFICATION_OPTIONS.selling_angle),
    language: choose("Language", CLASSIFICATION_OPTIONS.language),
  });
}

async function getClassificationMedia(env, ad) {
  const isVideo = /video/i.test(ad.format || "");
  const headers = { Referer: "https://www.facebook.com/", "User-Agent": "IndiaFoodAdLibrary/1.0" };

  if (isVideo) {
    let videoFailure = null;
    if (ad.creative_url && env.MEDIA) {
      try {
        const videoResponse = await fetch(ad.creative_url, { headers });
        if (!videoResponse.ok || !videoResponse.body) throw new Error(`Video download failed (${videoResponse.status})`);
        const spritesheet = await env.MEDIA.input(videoResponse.body)
          .transform({ width: 720 })
          .output({ mode: "spritesheet", time: "0s", duration: "8s", imageCount: 4 })
          .response();
        if (!spritesheet.ok) throw new Error(`Video frame extraction failed (${spritesheet.status})`);
        return {
          bytes: new Uint8Array(await spritesheet.arrayBuffer()),
          mimeType: "image/jpeg",
          source: "video-frames-0-8s",
        };
      } catch (error) {
        videoFailure = error;
      }
    } else if (!env.MEDIA) {
      videoFailure = new Error("Cloudflare Media binding is missing for video frame extraction");
    }

    if (ad.thumbnail_url) {
      try {
        const imageResponse = await fetch(ad.thumbnail_url, { headers });
        if (!imageResponse.ok) throw new Error(`Thumbnail download failed (${imageResponse.status})`);
        const bytes = new Uint8Array(await imageResponse.arrayBuffer());
        if (bytes.byteLength > 8 * 1024 * 1024) throw new Error("Thumbnail is larger than the classification limit");
        return {
          bytes,
          mimeType: imageResponse.headers.get("content-type")?.split(";")[0] || "image/jpeg",
          source: "thumbnail-fallback",
        };
      } catch (error) {
        videoFailure = videoFailure || error;
      }
    }

    throw videoFailure || new Error("Video has no downloadable creative or thumbnail");
  }

  const url = ad.creative_url || ad.thumbnail_url;
  if (!url) throw new Error("No usable image creative");
  const imageResponse = await fetch(url, { headers });
  if (!imageResponse.ok) throw new Error(`Creative download failed (${imageResponse.status})`);
  const bytes = new Uint8Array(await imageResponse.arrayBuffer());
  if (bytes.byteLength > 8 * 1024 * 1024) throw new Error("Creative is larger than the classification limit");
  return {
    bytes,
    mimeType: imageResponse.headers.get("content-type")?.split(";")[0] || "image/jpeg",
    source: ad.creative_url ? "image" : "thumbnail",
  };
}

async function classifyWithWorkersAI(env, ad) {
  if (!env.AI) throw new Error("Workers AI binding is missing");
  const media = await getClassificationMedia(env, ad);

  const prompt = `Classify this Indian food advertisement for a creative research library. Use every visible video frame in the contact sheet and the ad copy together. Return JSON only with exactly these four keys. Choose exactly one value for every key. Never return multiple values, alternatives, comma-separated labels, explanations, Markdown, or prose.
product_category: Snacks, Sweets & chocolate, Beverages, Dairy, Spices & ingredients, Staples, Ready-to-eat & instant, Ready-to-cook & frozen, Health & nutrition, Meat & seafood, Fresh food, Bakery, Other
creative_style: Product shot, Product demo, Recipe/how-to, UGC, Testimonial, Lifestyle, Founder story
selling_angle: Taste/craving, Health, Convenience, Value, Ingredients, Tradition/emotion, Social proof
language: English, Hindi, Hinglish, Other
Brand: ${ad.brand?.name || "Unknown"}
Existing product category hint: ${ad.category || "Unknown"}
Headline: ${ad.headline || "None"}
Copy: ${ad.body_copy || "None"}`;

  const result = await env.AI.run(WORKERS_AI_MODEL, {
    messages: [
      { role: "system", content: "You are a precise advertising analyst. Do not invent details that are not visible or stated." },
      { role: "user", content: prompt },
    ],
    image: `data:${media.mimeType};base64,${base64FromBytes(media.bytes)}`,
    response_format: {
      type: "json_schema",
      json_schema: {
        type: "object",
        properties: {
          product_category: { type: "string", enum: CLASSIFICATION_OPTIONS.category },
          creative_style: { type: "string", enum: CLASSIFICATION_OPTIONS.creative_style },
          selling_angle: { type: "string", enum: CLASSIFICATION_OPTIONS.selling_angle },
          language: { type: "string", enum: CLASSIFICATION_OPTIONS.language },
        },
        required: ["product_category", "creative_style", "selling_angle", "language"],
      },
    },
    max_tokens: 160,
    temperature: 0,
  });
  let labels;
  try {
    labels = parseClassificationJson(result);
  } catch (error) {
    const response = typeof result?.response === "string" ? result.response.slice(0, 600) : null;
    throw new Error(`${error instanceof Error ? error.message : String(error)}${response ? `: ${response}` : ""}`);
  }
  return {
    labels: {
      category: labels.product_category,
      creative_style: labels.creative_style || null,
      selling_angle: labels.selling_angle || null,
      language: labels.language || null,
    },
    media_source: media.source,
    usage: result.usage || null,
  };
}

function hasClassificationMedia(ad) {
  return Boolean(ad.creative_url || ad.thumbnail_url);
}

async function classifyAds(env, limit, offset, write, status = "approved") {
  const statusFilter = ["pending", "approved"].includes(status) ? status : "approved";
  const missingClassification = "or=(category.is.null,creative_style.is.null,selling_angle.is.null,language.is.null)";
  const rows = await supabase(
    env,
    `ads?status=eq.${statusFilter}&${missingClassification}&select=id,source_ad_id,format,language,category,creative_style,selling_angle,headline,body_copy,creative_url,thumbnail_url,brand:brands(name)&order=submitted_at.desc,id.asc&offset=${offset}&limit=${limit}`,
  );
  const selected = rows.filter(hasClassificationMedia).slice(0, limit);

  const results = [];
  let writes = 0;
  for (const ad of selected.slice(0, limit)) {
    try {
      const classification = await classifyWithWorkersAI(env, ad);
      if (write) {
        await supabase(env, `ads?id=eq.${encodeURIComponent(ad.id)}`, {
          method: "PATCH",
          headers: { Prefer: "return=minimal" },
          body: JSON.stringify({
            category: classification.labels.category,
            creative_style: classification.labels.creative_style,
            selling_angle: classification.labels.selling_angle,
            language: classification.labels.language,
            updated_at: new Date().toISOString(),
          }),
        });
        writes += 1;
      }
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
    offset,
    writes,
    results,
  };
}

async function pilotClassify(env, limit, offset) {
  return classifyAds(env, limit, offset, false, "approved");
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

async function queueAds(env, discoveries) {
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
          category: prior.category || ad.category,
          language: prior.language || ad.language,
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
    classificationAttempts: 0,
    classified: 0,
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
  const queueReport = await queueAds(env, completedDiscoveries);
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
      const offset = boundedInteger(url.searchParams.get("offset"), 0, 0, 10_000);
      try {
        return Response.json(await pilotClassify(env, limit, offset));
      } catch (error) {
        return Response.json({ error: error instanceof Error ? error.message : String(error), writes: 0 }, { status: 500 });
      }
    }
    if (request.method === "POST" && url.pathname === "/classify") {
      if (!authorized(request, env)) return new Response("Unauthorized", { status: 401 });
      const limit = boundedInteger(url.searchParams.get("limit"), 10, 1, MAX_WORKERS_AI_CLASSIFICATIONS_PER_RUN);
      const offset = boundedInteger(url.searchParams.get("offset"), 0, 0, 10_000);
      const status = ["pending", "approved"].includes(url.searchParams.get("status"))
        ? url.searchParams.get("status")
        : "approved";
      try {
        return Response.json(await classifyAds(env, limit, offset, true, status));
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
    const publishPending = ["1", "true"].includes(url.searchParams.get("publish")?.toLowerCase());
    const selected = slug
      ? BRANDS.filter((brand) => brand.slug === slug)
      : BRANDS.slice(offset, offset + limit);
    if (!selected.length) return Response.json({ error: "Unknown brand" }, { status: 400 });

    try {
      return Response.json(await run(env, selected, { mode, publishPending }));
    } catch (error) {
      return Response.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
    }
  },

  async scheduled(controller, env, ctx) {
    const slot = Math.max(WEEKLY_CRONS.indexOf(controller.cron), 0);
    const offset = slot * SCHEDULED_BATCH_SIZE;
    const selected = BRANDS.slice(offset, offset + SCHEDULED_BATCH_SIZE);
    if (selected.length) ctx.waitUntil(run(env, selected, { mode: "refresh", publishPending: false }));
  },
};

export default worker;
