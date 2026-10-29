import type { Ad } from "@/lib/types";

/** Minimum ads needed from a brand category to get an indexable hub page. */
export const MIN_BRAND_CATEGORY_ADS = 15;

/** Stable slug for a brand category name. */
export function slugifyBrandCategory(category: string): string {
  return category
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/** All ads whose brand belongs to the category identified by slug. */
export function getBrandCategoryAds(ads: Ad[], slug: string): Ad[] {
  return ads.filter((ad) => slugifyBrandCategory(ad.brand.category) === slug);
}

/** All brand-category hub definitions that meet the size threshold. */
export function getBrandCategoryDefinitions(ads: Ad[]): Array<{ slug: string; name: string; count: number }> {
  const counts = new Map<string, { name: string; count: number }>();
  ads.forEach((ad) => {
    const cat = ad.brand.category?.trim();
    if (!cat) return;
    const slug = slugifyBrandCategory(cat);
    const entry = counts.get(slug) ?? { name: cat, count: 0 };
    entry.count += 1;
    counts.set(slug, entry);
  });
  return Array.from(counts.entries())
    .map(([slug, { name, count }]) => ({ slug, name, count }))
    .filter(({ count }) => count >= MIN_BRAND_CATEGORY_ADS)
    .sort((a, b) => b.count - a.count);
}
