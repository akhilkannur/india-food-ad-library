import { getApprovedAd } from "@/lib/data";

const MEDIA_HOSTS = ["fbcdn.net", "fbsbx.com", "cdninstagram.com", "facebook.com"];
const MAX_MEDIA_BYTES = 50 * 1024 * 1024;
const MEDIA_TIMEOUT_MS = 15_000;

function isTrustedMediaUrl(value: string) {
  try {
    const url = new URL(value);
    const hostname = url.hostname.toLowerCase();
    return url.protocol === "https:" && MEDIA_HOSTS.some((host) => hostname === host || hostname.endsWith(`.${host}`));
  } catch {
    return false;
  }
}

function extensionFor(contentType: string, format: string) {
  if (contentType.includes("mp4")) return "mp4";
  if (contentType.includes("webm")) return "webm";
  if (contentType.includes("png")) return "png";
  if (contentType.includes("webp")) return "webp";
  if (contentType.includes("gif")) return "gif";
  return /video/i.test(format) ? "mp4" : "jpg";
}

function safeFilename(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 64) || "ad-creative";
}

function responseFitsLimit(response: Response) {
  const contentLength = Number(response.headers.get("content-length"));
  return !Number.isFinite(contentLength) || contentLength <= MAX_MEDIA_BYTES;
}

function limitedBody(body: ReadableStream<Uint8Array>) {
  let bytesRead = 0;
  return body.pipeThrough(new TransformStream<Uint8Array, Uint8Array>({
    transform(chunk, controller) {
      bytesRead += chunk.byteLength;
      if (bytesRead > MAX_MEDIA_BYTES) {
        controller.error(new Error("Media response exceeds the download limit."));
        return;
      }
      controller.enqueue(chunk);
    },
  }));
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ad = await getApprovedAd(id);
  if (!ad) return new Response("Ad not found.", { status: 404 });

  const candidates = [...new Set([ad.creative_url, ad.thumbnail_url].filter((url): url is string => Boolean(url)))];
  for (const mediaUrl of candidates) {
    if (!isTrustedMediaUrl(mediaUrl)) continue;
    const signal = typeof AbortSignal !== "undefined" && AbortSignal.timeout
      ? AbortSignal.timeout(MEDIA_TIMEOUT_MS)
      : undefined;
    let response: Response;
    try {
      response = await fetch(mediaUrl, {
        headers: {
          Referer: "https://www.facebook.com/",
          "User-Agent": "Mozilla/5.0 (compatible; IndiaFoodAdLibrary/1.0)",
        },
        cache: "no-store",
        ...(signal ? { signal } : {}),
      });
    } catch {
      continue;
    }
    if (!response.ok || !response.body || !responseFitsLimit(response)) continue;

    const contentType = response.headers.get("content-type")?.split(";")[0] || "application/octet-stream";
    const extension = extensionFor(contentType, ad.format);
    const filename = `${safeFilename(ad.brand.name)}-${safeFilename(ad.source_ad_id || ad.id)}.${extension}`;
    const headers = new Headers({
      "Cache-Control": "private, no-store",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Type": contentType,
      "X-Content-Type-Options": "nosniff",
    });
    const contentLength = response.headers.get("content-length");
    if (contentLength) headers.set("Content-Length", contentLength);
    return new Response(limitedBody(response.body), { status: 200, headers });
  }

  return new Response("This creative is no longer available from its original source.", { status: 410 });
}
