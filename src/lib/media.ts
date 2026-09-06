import type { Ad } from "./types";

export type MediaFilter = "all" | "video" | "image";

export function isVideoCreative(ad: Pick<Ad, "format" | "creative_url">) {
  return /video/i.test(ad.format) || /\.(mp4|webm|mov)(?:\?|$)/i.test(ad.creative_url || "");
}
