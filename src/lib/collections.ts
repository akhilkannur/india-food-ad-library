import type { Ad } from "@/lib/types";

export type CollectionDefinition = {
  slug: string;
  name: string;
  field: "category" | "creative_style" | "selling_angle" | "language";
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

const COLLECTION_FIELDS: Array<{
  field: CollectionDefinition["field"];
  label: (value: string) => string;
}> = [
  { field: "category", label: (value) => value },
  { field: "creative_style", label: (value) => `${value} creative` },
  { field: "selling_angle", label: (value) => `${value} ads` },
  { field: "language", label: (value) => `${value} ads` },
];

/** Build collections only from the four controlled classification fields. */
export function getCollectionDefinitions(ads: Ad[]): CollectionDefinition[] {
  const collections = new Map<string, { field: CollectionDefinition["field"]; name: string; count: number; value: string }>();

  ads.forEach((ad) => {
    COLLECTION_FIELDS.forEach(({ field, label }) => {
      const value = ad[field]?.trim();
      if (!value) return;
      const key = `${field}:${normalizeCategory(value)}`;
      const existing = collections.get(key);
      if (existing) existing.count += 1;
      else collections.set(key, { field, name: label(value), count: 1, value });
    });
  });

  return Array.from(collections.entries())
    .sort(([, left], [, right]) => right.count - left.count || left.name.localeCompare(right.name))
    .map(([, { field, name, value }]) => ({
      slug: slugifyCollectionName(`${field}-${value}`),
      name,
      field,
      match: (ad: Ad) => normalizeCategory(ad[field]) === normalizeCategory(value),
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
