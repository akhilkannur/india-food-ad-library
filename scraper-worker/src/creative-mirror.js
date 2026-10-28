// Meta CDN creative URLs are signed and expire within ~1-2 weeks, after which
// the nightly validator used to delete the ad. Copying each creative into
// Supabase Storage (public bucket) keeps approved ads permanently viewable.

export const MIRROR_BUCKET = "creatives";
// Workers Free allows 50 subrequests per invocation. Each ad costs at most
// five (two downloads, two uploads, one PATCH) plus four per batch overhead.
export const MAX_MIRROR_BATCH = 8;
// Supabase Free includes 1 GB of storage. Posters and images are small and
// always fit; videos are only copied while the bucket stays under the
// video budget, otherwise the ad falls back to its stored poster image.
export const STORAGE_BUDGET_BYTES = 900 * 1024 * 1024;
export const VIDEO_BUDGET_BYTES = 650 * 1024 * 1024;
export const MAX_VIDEO_BYTES = 8 * 1024 * 1024;
export const VIDEO_SOURCE_ONLY_NOTE = "[video-source-only]";

const DEAD_STATUSES = new Set([400, 401, 403, 404, 410]);
const USAGE_PATH = "_meta/usage.json";

function baseUrl(env) {
  return env.SUPABASE_URL.replace(/\/$/, "");
}

export function mirroredUrlPrefix(supabaseUrl) {
  return `${supabaseUrl.replace(/\/$/, "")}/storage/v1/object/public/${MIRROR_BUCKET}/`;
}

export function isMirroredUrl(url, supabaseUrl) {
  return Boolean(url && supabaseUrl && url.startsWith(mirroredUrlPrefix(supabaseUrl)));
}

export function isSourceUrl(url) {
  return Boolean(url && /^https:\/\/[^/]*(fbcdn\.net|fbsbx\.com|cdninstagram\.com)\//i.test(url));
}

export function extensionFor(contentType, url) {
  const type = (contentType || "").split(";")[0].trim().toLowerCase();
  const byType = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif",
    "video/mp4": "mp4",
    "video/webm": "webm",
    "video/quicktime": "mov",
  };
  if (byType[type]) return byType[type];
  const match = /\.(jpe?g|png|webp|gif|mp4|webm|mov)(?:\?|$)/i.exec(url || "");
  if (match) return match[1].toLowerCase().replace("jpeg", "jpg");
  return type.startsWith("video/") ? "mp4" : "jpg";
}

/** Keep stored copies when a scrape refresh brings back fresh source URLs. */
export function preserveMirroredUrls(row, prior, supabaseUrl) {
  if (!prior) return row;
  const preserved = { ...row };
  if (isMirroredUrl(prior.thumbnail_url, supabaseUrl)) preserved.thumbnail_url = prior.thumbnail_url;
  if (isMirroredUrl(prior.creative_url, supabaseUrl)) preserved.creative_url = prior.creative_url;
  // A video that only kept its poster must not be revived with a source URL
  // that will expire again; the poster is the durable preview.
  else if (prior.creative_url === null && isMirroredUrl(prior.thumbnail_url, supabaseUrl)) preserved.creative_url = null;
  return preserved;
}

/**
 * Decide what a single ad still needs copied. Pure so the planner is testable.
 * Returns null when nothing remains to mirror.
 */
export function planMirror(ad) {
  const video = /video/i.test(ad.format || "");
  const posterSource = isSourceUrl(ad.thumbnail_url) ? ad.thumbnail_url : null;
  const creativeSource = isSourceUrl(ad.creative_url) ? ad.creative_url : null;
  const skipVideo = video && (ad.reviewer_notes || "").includes(VIDEO_SOURCE_ONLY_NOTE);
  const plan = {
    poster: posterSource,
    creative: creativeSource && !(video && skipVideo) ? creativeSource : null,
    // Image ads usually carry the same URL in both fields; copy it once.
    sharedImage: !video && Boolean(posterSource) && posterSource === creativeSource,
    video,
  };
  if (plan.sharedImage) plan.creative = null;
  if (!plan.poster && !plan.creative) return null;
  return plan;
}

async function storageRequest(env, path, init = {}) {
  return fetch(`${baseUrl(env)}/storage/v1/${path}`, {
    ...init,
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      ...(init.headers || {}),
    },
  });
}

async function ensureBucket(env) {
  const response = await storageRequest(env, "bucket", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id: MIRROR_BUCKET, name: MIRROR_BUCKET, public: true }),
  });
  if (response.ok) return;
  const text = await response.text();
  // An existing bucket reports a duplicate error; anything else is real.
  if (!/already exists|duplicate/i.test(text)) throw new Error(`Storage bucket ${response.status}: ${text.slice(0, 300)}`);
}

async function readUsage(env) {
  const response = await storageRequest(env, `object/${MIRROR_BUCKET}/${USAGE_PATH}`);
  if (!response.ok) {
    await response.body?.cancel();
    return 0;
  }
  const usage = await response.json().catch(() => ({}));
  return Number.isFinite(usage.bytes) ? usage.bytes : 0;
}

async function writeUsage(env, bytes) {
  const response = await storageRequest(env, `object/${MIRROR_BUCKET}/${USAGE_PATH}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-upsert": "true" },
    body: JSON.stringify({ bytes, updated_at: new Date().toISOString() }),
  });
  if (!response.ok) throw new Error(`Storage usage ${response.status}: ${(await response.text()).slice(0, 300)}`);
}

/** Download one source asset and store it. Returns { url, bytes } or a status. */
async function copyAsset(env, sourceUrl, objectBase, maxBytes) {
  let source;
  try {
    source = await fetch(sourceUrl, {
      headers: {
        Referer: "https://www.facebook.com/",
        "User-Agent": "IndiaFoodAdLibrary/1.0 (creative-mirror)",
      },
      redirect: "follow",
    });
  } catch {
    return { status: "unresolved" };
  }
  if (!source.ok) {
    await source.body?.cancel();
    return { status: DEAD_STATUSES.has(source.status) ? "dead" : "unresolved" };
  }
  const declared = Number(source.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > maxBytes) {
    await source.body?.cancel();
    return { status: "too_large" };
  }
  const bytes = new Uint8Array(await source.arrayBuffer());
  if (bytes.byteLength > maxBytes) return { status: "too_large" };

  const contentType = source.headers.get("content-type") || "application/octet-stream";
  const objectPath = `${objectBase}.${extensionFor(contentType, sourceUrl)}`;
  const upload = await storageRequest(env, `object/${MIRROR_BUCKET}/${objectPath}`, {
    method: "POST",
    headers: { "Content-Type": contentType, "x-upsert": "true", "Cache-Control": "max-age=31536000" },
    body: bytes,
  });
  if (!upload.ok) throw new Error(`Storage upload ${upload.status}: ${(await upload.text()).slice(0, 300)}`);
  return { status: "stored", url: `${mirroredUrlPrefix(env.SUPABASE_URL)}${objectPath}`, bytes: bytes.byteLength };
}

export async function mirrorCreatives(env, supabase, limit) {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) throw new Error("Supabase secrets are missing");
  const batch = Math.min(Math.max(limit, 1), MAX_MIRROR_BATCH);

  // Least recently touched first. Every processed ad gets a fresh updated_at,
  // so an ad whose source is unreachable rotates behind the rest of the queue.
  const sourceFilter = "or=(thumbnail_url.like.*fbcdn.net*,creative_url.like.*fbcdn.net*)";
  const candidates = await supabase(
    env,
    `ads?status=eq.approved&${sourceFilter}&select=id,format,creative_url,thumbnail_url,reviewer_notes&order=updated_at.asc.nullsfirst,id.asc&limit=${batch * 4}`,
  );
  const work = candidates
    .map((ad) => ({ ad, plan: planMirror(ad) }))
    .filter((item) => item.plan)
    .slice(0, batch);
  if (!work.length) return { ok: true, processed: 0, stored: 0, remaining: 0, results: [] };

  await ensureBucket(env);
  let usage = await readUsage(env);
  const startingUsage = usage;
  const results = [];

  for (const { ad, plan } of work) {
    const patch = {};
    const outcome = { id: ad.id };

    if (plan.poster && usage < STORAGE_BUDGET_BYTES) {
      const poster = await copyAsset(env, plan.poster, `${ad.id}/${plan.video ? "poster" : "image"}`, 15 * 1024 * 1024);
      outcome.poster = poster.status;
      if (poster.status === "stored") {
        usage += poster.bytes;
        patch.thumbnail_url = poster.url;
        if (plan.sharedImage) patch.creative_url = poster.url;
      }
    }

    if (plan.creative) {
      const videoAllowed = !plan.video || usage < VIDEO_BUDGET_BYTES;
      const creative = videoAllowed && usage < STORAGE_BUDGET_BYTES
        ? await copyAsset(env, plan.creative, `${ad.id}/creative`, plan.video ? MAX_VIDEO_BYTES : 15 * 1024 * 1024)
        : { status: "over_budget" };
      outcome.creative = creative.status;
      if (creative.status === "stored") {
        usage += creative.bytes;
        patch.creative_url = creative.url;
      } else if (plan.video && ["too_large", "over_budget"].includes(creative.status)) {
        // Keep the source video while it lasts, but stop retrying the copy.
        patch.reviewer_notes = `${ad.reviewer_notes || ""} ${VIDEO_SOURCE_ONLY_NOTE}`.trim();
      } else if (plan.video && creative.status === "dead" && (patch.thumbnail_url || isMirroredUrl(ad.thumbnail_url, env.SUPABASE_URL))) {
        // The video already expired: show the durable poster instead.
        patch.creative_url = null;
      }
    }

    await supabase(env, `ads?id=eq.${encodeURIComponent(ad.id)}`, {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ ...patch, updated_at: new Date().toISOString() }),
    });
    results.push(outcome);
  }

  if (usage !== startingUsage) await writeUsage(env, usage);

  const stored = results.filter((item) => item.poster === "stored" || item.creative === "stored").length;
  return {
    ok: true,
    processed: results.length,
    stored,
    storage_bytes: usage,
    over_budget: usage >= STORAGE_BUDGET_BYTES,
    // A full batch means more ads are probably waiting.
    remaining: candidates.length > work.length || work.length === batch ? 1 : 0,
    results,
  };
}
