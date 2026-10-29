export const SITE_URL = (
  process.env["NEXT_PUBLIC_SITE_URL"] || "https://adlibrary.store"
).replace(/\/$/, "");

/** Absolute URL helper — resolves a path against SITE_URL. */
export function siteUrl(path: string) {
  return `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

export const SITE_NAME = "F&B Ad Library";

export const SITE_DEFAULT_TITLE = "Best Facebook Ad Examples — Indian Food & Beverage Meta Ads Swipe File";

export const SITE_DEFAULT_DESCRIPTION =
  "A swipe file of 1,000+ top-performing Facebook ad examples and Meta creatives from Indian food & beverage brands. Compare hooks, video formats, UGC, and ad copy for DTC teams. Updated weekly.";
