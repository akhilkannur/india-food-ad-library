import type { Ad } from "@/lib/types";

export type CollectionDefinition = {
  slug: string;
  name: string;
  match: (ad: Ad) => boolean;
};

function normalizeCategory(value: string | null | undefined) {
  return value?.trim().toLocaleLowerCase() ?? "";
}

export function slugifyCollectionName(value: string) {
  return value
    .trim()
    .toLocaleLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/** Build collections from the reviewed category field, not inferred copy keywords. */
export function getCollectionDefinitions(ads: Ad[]): CollectionDefinition[] {
  const categories = new Map<string, { name: string; count: number }>();

  ads.forEach((ad) => {
    const name = ad.category?.trim();
    if (!name) return;
    const key = normalizeCategory(name);
    const existing = categories.get(key);
    if (existing) existing.count += 1;
    else categories.set(key, { name, count: 1 });
  });

  return Array.from(categories.entries())
    .sort(([, left], [, right]) => right.count - left.count || left.name.localeCompare(right.name))
    .map(([key, { name }]) => ({
      slug: slugifyCollectionName(name),
      name,
      match: (ad: Ad) => normalizeCategory(ad.category) === key,
    }));
}

export function diversifyByBrand(items: Ad[]) {
  const queues = new Map<string, Ad[]>();
  const brandOrder: string[] = [];

  items.forEach((ad) => {
    const key = ad.brand.id;
    if (!queues.has(key)) {
      queues.set(key, []);
      brandOrder.push(key);
    }
    queues.get(key)!.push(ad);
  });

  const result: Ad[] = [];
  while (brandOrder.some((key) => queues.get(key)!.length)) {
    brandOrder.forEach((key) => {
      const ad = queues.get(key)!.shift();
      if (ad) result.push(ad);
    });
  }
  return result;
}

export function getCollectionAds(ads: Ad[], definition: CollectionDefinition) {
  return diversifyByBrand(ads.filter(definition.match));
}

export function getCollectionDefinition(slug: string, ads: Ad[]) {
  return getCollectionDefinitions(ads).find((definition) => definition.slug === slug);
}
