import type { Ad } from "./types";

export type MediaFilter = "all" | "video" | "image";

export function isVideoCreative(ad: Pick<Ad, "format" | "creative_url">) {
  return /video/i.test(ad.format) || /\.(mp4|webm|mov)(?:\?|$)/i.test(ad.creative_url || "");
}

/**
 * An ad is considered to have an unavailable preview when its creative asset
 * can no longer be served from its original Meta CDN location (signed URLs
 * expire after ~30 days). The nightly validation worker purges these records
 * from the catalogue, but while an ad is still `approved` it may already be
 * dead on the CDN — the client also signals this via `onUnavailable`.
 */
export function isPreviewUnavailable(ad: Pick<Ad, "status" | "reviewer_notes" | "creative_url" | "thumbnail_url">) {
  if (ad.status !== "approved") return true;
  if (!ad.creative_url && !ad.thumbnail_url) return true;
  return /Auto-hidden:\s*creative no longer loads from its original source/i.test(ad.reviewer_notes || "");
}
