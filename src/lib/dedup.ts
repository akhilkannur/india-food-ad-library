/** Deterministic creative grouping; no AI or API calls. */
export function creativeKey(ad: {
  brand_id?: string | null;
  format?: string | null;
  creative_url?: string | null;
  thumbnail_url?: string | null;
  headline?: string | null;
  body_copy?: string | null;
}) {
  const asset = ad.creative_url || ad.thumbnail_url;
  if (asset) {
    try {
      const url = new URL(asset);
      return `${ad.brand_id || ""}|${ad.format || ""}|asset:${url.origin}${url.pathname}`.toLowerCase();
    } catch {
      return `${ad.brand_id || ""}|${ad.format || ""}|asset:${asset.split("?")[0]}`.toLowerCase();
    }
  }
  const text = [ad.headline, ad.body_copy].filter(Boolean).join(" ")
    .toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  return `${ad.brand_id || ""}|${ad.format || ""}|text:${text}`;
}

export function dedupeCreatives<T extends Parameters<typeof creativeKey>[0]>(ads: T[]) {
  const seen = new Set<string>();
  return ads.filter((ad) => {
    const key = creativeKey(ad);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
