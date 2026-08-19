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
  const productShotCount = new Map<string, number>();
  return ads.filter((ad) => {
    const key = creativeKey(ad);
    if (seen.has(key)) return false;
    seen.add(key);

    // Meta commonly creates a separate ad ID for every minor variation of a
    // product packshot. Keep a small representative set in the public gallery;
    // moderation still receives every underlying record.
    const style = (ad as { creative_style?: string | null }).creative_style?.toLowerCase();
    const brand = ad.brand_id || "unknown";
    const isProductImage = ad.format?.toLowerCase() === "image" &&
      (style === "product shot" || style === "product-shot");
    if (isProductImage) {
      const count = productShotCount.get(brand) || 0;
      if (count >= 2) return false;
      productShotCount.set(brand, count + 1);
    }
    return true;
  });
}
