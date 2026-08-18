#!/usr/bin/env node

import { writeFile } from "node:fs/promises";

const MODEL = "gemini-3.1-flash-lite";
const LIBRARY_URL = "https://india-food-ad-library.akhil-1000what.workers.dev/";
const API_ROOT = "https://generativelanguage.googleapis.com";
const VIDEO_SECONDS = 20;

const key = process.env.GEMINI_API_KEY || process.env.NANOBANANA_GEMINI_API_KEY;
if (!key) {
  throw new Error("Set GEMINI_API_KEY before running this test.");
}

const limitArg = process.argv.find((arg) => arg.startsWith("--limit="));
const reportArg = process.argv.find((arg) => arg.startsWith("--report="));
const limit = limitArg ? Number(limitArg.split("=")[1]) : 10;
const reportPath = reportArg?.slice("--report=".length) || "/tmp/gemini-ad-cost-test.json";

function extractApprovedAds(html) {
  let rsc = "";
  const scriptPattern = /self\.__next_f\.push\((\[.*?\])\)<\/script>/gs;

  for (const match of html.matchAll(scriptPattern)) {
    try {
      const chunk = JSON.parse(match[1]);
      if (typeof chunk[1] === "string") rsc += chunk[1];
    } catch {
      // Ignore non-data bootstrap chunks.
    }
  }

  const marker = '"ads":[';
  const markerIndex = rsc.indexOf(marker);
  if (markerIndex === -1) throw new Error("Could not find ads in the public page payload.");

  const start = markerIndex + marker.length - 1;
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = start; index < rsc.length; index += 1) {
    const char = rsc[index];
    if (inString) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === '"') inString = false;
      continue;
    }

    if (char === '"') inString = true;
    else if (char === "[") depth += 1;
    else if (char === "]") {
      depth -= 1;
      if (depth === 0) return JSON.parse(rsc.slice(start, index + 1));
    }
  }

  throw new Error("The ads payload was incomplete.");
}

function selectRepresentativeAds(ads, requestedLimit) {
  const candidates = ads.filter((ad) => ad.creative_url && ["Image", "Video"].includes(ad.format));
  const selected = [];
  const seen = new Set();

  // First pass: cover each brand/media pair before taking additional examples.
  for (const ad of candidates) {
    const pair = `${ad.brand?.slug || ad.brand_id}:${ad.format}`;
    if (!seen.has(pair)) {
      seen.add(pair);
      selected.push(ad);
    }
  }

  for (const ad of candidates) {
    if (!selected.includes(ad)) selected.push(ad);
  }

  return selected.slice(0, Math.min(requestedLimit, selected.length));
}

async function fetchMedia(url) {
  const response = await fetch(url, {
    headers: {
      Referer: "https://www.facebook.com/",
      "User-Agent": "Mozilla/5.0 (compatible; IndiaFoodAdLibraryCostTest/1.0)",
    },
  });
  if (!response.ok) throw new Error(`Media download failed (${response.status}).`);

  const contentType = response.headers.get("content-type")?.split(";")[0] || "application/octet-stream";
  return { bytes: Buffer.from(await response.arrayBuffer()), contentType };
}

async function uploadVideo(bytes, mimeType, displayName) {
  const startResponse = await fetch(`${API_ROOT}/upload/v1beta/files?key=${encodeURIComponent(key)}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Upload-Protocol": "resumable",
      "X-Goog-Upload-Command": "start",
      "X-Goog-Upload-Header-Content-Length": String(bytes.length),
      "X-Goog-Upload-Header-Content-Type": mimeType,
    },
    body: JSON.stringify({ file: { displayName } }),
  });
  if (!startResponse.ok) throw new Error(`File upload could not start (${startResponse.status}).`);

  const uploadUrl = startResponse.headers.get("x-goog-upload-url");
  if (!uploadUrl) throw new Error("Gemini did not return an upload URL.");

  const uploadResponse = await fetch(uploadUrl, {
    method: "POST",
    headers: {
      "Content-Type": mimeType,
      "X-Goog-Upload-Offset": "0",
      "X-Goog-Upload-Command": "upload, finalize",
    },
    body: bytes,
  });
  if (!uploadResponse.ok) throw new Error(`File upload failed (${uploadResponse.status}).`);

  let file = (await uploadResponse.json()).file;
  for (let attempt = 0; file?.state === "PROCESSING" && attempt < 30; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 2_000));
    const statusResponse = await fetch(`${API_ROOT}/v1beta/${file.name}?key=${encodeURIComponent(key)}`);
    if (!statusResponse.ok) throw new Error(`Could not read uploaded file status (${statusResponse.status}).`);
    file = await statusResponse.json();
  }

  if (file?.state !== "ACTIVE") throw new Error(`Uploaded video is ${file?.state || "unavailable"}.`);
  return file;
}

async function deleteUploadedFile(file) {
  if (!file?.name) return;
  await fetch(`${API_ROOT}/v1beta/${file.name}?key=${encodeURIComponent(key)}`, { method: "DELETE" });
}

function promptFor(ad) {
  return `Classify this Indian food advertisement for a searchable creative library.

Known metadata:
- Brand: ${ad.brand?.name || "Unknown"}
- Food category: ${ad.category || ad.brand?.category || "Unknown"}
- Headline: ${ad.headline || "None"}
- Ad copy: ${ad.body_copy || "None"}

Choose exactly one value for each taxonomy. Judge the actual creative, using the copy only as supporting context. Keep the rationale under 20 words.`;
}

const responseSchema = {
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
    food_occasion: {
      type: "STRING",
      enum: ["Breakfast", "Snacking", "Family meal", "Kids", "Fitness", "Festive", "Everyday", "Not specific"],
    },
    confidence: { type: "NUMBER", minimum: 0, maximum: 1 },
    rationale: { type: "STRING" },
  },
  required: ["creative_style", "selling_angle", "food_occasion", "confidence", "rationale"],
};

async function classify(ad) {
  const media = await fetchMedia(ad.creative_url);
  let uploadedFile;

  try {
    const mediaPart = ad.format === "Video"
      ? null
      : {
          inlineData: { mimeType: media.contentType, data: media.bytes.toString("base64") },
          mediaResolution: { level: "MEDIA_RESOLUTION_LOW" },
        };

    let finalMediaPart = mediaPart;
    if (ad.format === "Video") {
      uploadedFile = await uploadVideo(media.bytes, media.contentType, `ad-${ad.source_ad_id || ad.id}`);
      finalMediaPart = {
        fileData: { mimeType: uploadedFile.mimeType, fileUri: uploadedFile.uri },
        videoMetadata: { startOffset: "0s", endOffset: `${VIDEO_SECONDS}s`, fps: 1 },
        mediaResolution: { level: "MEDIA_RESOLUTION_LOW" },
      };
    }

    const response = await fetch(
      `${API_ROOT}/v1beta/models/${MODEL}:generateContent?key=${encodeURIComponent(key)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: promptFor(ad) }, finalMediaPart] }],
          generationConfig: {
            temperature: 0,
            maxOutputTokens: 220,
            responseMimeType: "application/json",
            responseSchema,
          },
        }),
      },
    );

    const payload = await response.json();
    if (!response.ok) throw new Error(payload?.error?.message || `Gemini request failed (${response.status}).`);

    const text = payload.candidates?.[0]?.content?.parts?.map((part) => part.text || "").join("") || "{}";
    return {
      result: JSON.parse(text),
      usage: payload.usageMetadata || {},
      downloaded_bytes: media.bytes.length,
    };
  } finally {
    await deleteUploadedFile(uploadedFile);
  }
}

function estimateListCost(usage) {
  const details = usage.promptTokensDetails || [];
  let input = 0;
  for (const detail of details) {
    const rate = detail.modality === "AUDIO" ? 0.5 : 0.25;
    input += ((detail.tokenCount || 0) / 1_000_000) * rate;
  }

  if (!details.length) input = ((usage.promptTokenCount || 0) / 1_000_000) * 0.25;
  const outputTokens = (usage.candidatesTokenCount || 0) + (usage.thoughtsTokenCount || 0);
  return input + (outputTokens / 1_000_000) * 1.5;
}

const pageResponse = await fetch(LIBRARY_URL);
if (!pageResponse.ok) throw new Error(`Library page failed (${pageResponse.status}).`);
const ads = extractApprovedAds(await pageResponse.text());
const selected = selectRepresentativeAds(ads, limit);
const results = [];

for (const [index, ad] of selected.entries()) {
  const label = `${ad.brand?.name || "Unknown"} / ${ad.format} / ${ad.source_ad_id || ad.id}`;
  process.stderr.write(`[${index + 1}/${selected.length}] ${label}\n`);
  try {
    const classified = await classify(ad);
    results.push({
      id: ad.id,
      source_ad_id: ad.source_ad_id,
      brand: ad.brand?.name,
      format: ad.format,
      ...classified,
      estimated_list_cost_usd: estimateListCost(classified.usage),
    });
  } catch (error) {
    results.push({
      id: ad.id,
      source_ad_id: ad.source_ad_id,
      brand: ad.brand?.name,
      format: ad.format,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

const successful = results.filter((item) => !item.error);
const sampleCost = successful.reduce((sum, item) => sum + item.estimated_list_cost_usd, 0);
const byFormat = Object.fromEntries(["Image", "Video"].map((format) => {
  const rows = successful.filter((item) => item.format === format);
  return [format, {
    count: rows.length,
    average_prompt_tokens: rows.length
      ? rows.reduce((sum, item) => sum + (item.usage.promptTokenCount || 0), 0) / rows.length
      : 0,
    average_cost_usd: rows.length
      ? rows.reduce((sum, item) => sum + item.estimated_list_cost_usd, 0) / rows.length
      : 0,
  }];
}));

const libraryCounts = {
  total: ads.length,
  images: ads.filter((ad) => ad.format === "Image").length,
  videos: ads.filter((ad) => ad.format === "Video").length,
};
const projectedLibraryCost =
  libraryCounts.images * byFormat.Image.average_cost_usd
  + libraryCounts.videos * byFormat.Video.average_cost_usd;

const report = {
  tested_at: new Date().toISOString(),
  model: MODEL,
  settings: { video_seconds: VIDEO_SECONDS, video_fps: 1, media_resolution: "low" },
  library_counts: libraryCounts,
  sample: {
    requested: selected.length,
    successful: successful.length,
    failed: results.length - successful.length,
    estimated_list_cost_usd: sampleCost,
  },
  averages: byFormat,
  projected_full_library_cost_usd: projectedLibraryCost,
  results,
};

await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify({ report: reportPath, ...report }, null, 2));
