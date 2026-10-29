export const SITE_URL = (
  process.env["NEXT_PUBLIC_SITE_URL"] || "https://adlibrary.store"
).replace(/\/$/, "");

/** Absolute URL helper — resolves a path against SITE_URL. */
export function siteUrl(path: string) {
  return `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

export const SITE_NAME = "F&B Ad Library";

export const SITE_DEFAULT_TITLE = "F&B Ad Library — Indian Food & Beverage Ad Inspiration for DTC Teams";

export const SITE_DEFAULT_DESCRIPTION =
  "A swipe file of 1,000+ Indian food & beverage Meta ads — hooks, formats, UGC, product demos and recipe creatives DTC and brand teams can steal inspiration from. Updated weekly.";
