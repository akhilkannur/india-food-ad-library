import type { Ad } from "@/lib/types";

export type CollectionDefinition = {
  slug: string;
  name: string;
  field: "creative_style";
  match: (ad: Ad) => boolean;
};

function normalizeCollectionValue(value: string | null | undefined) {
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
  { field: "creative_style", label: (value) => value },
];

const MAX_COLLECTIONS = 6;
const MIN_COLLECTION_SIZE = 3;

function getCollectionCandidates(ads: Ad[]): CollectionDefinition[] {
  const collections = new Map<string, { name: string; count: number; value: string }>();

  ads.forEach((ad) => {
    COLLECTION_FIELDS.forEach(({ field, label }) => {
      const value = ad[field]?.trim();
      if (!value) return;
      const key = normalizeCollectionValue(value);
      const existing = collections.get(key);
      if (existing) existing.count += 1;
      else collections.set(key, { name: label(value), count: 1, value });
    });
  });

  return Array.from(collections.values())
    .filter((collection) => collection.count >= MIN_COLLECTION_SIZE)
    .sort((left, right) => right.count - left.count || left.name.localeCompare(right.name))
    .map(({ name, value }) => ({
      slug: slugifyCollectionName(`creative-style-${value}`),
      name,
      field: "creative_style" as const,
      match: (ad: Ad) => normalizeCollectionValue(ad.creative_style) === normalizeCollectionValue(value),
    }));
}

/** Build a short, classified-ad-format list for the homepage. */
export function getCollectionDefinitions(ads: Ad[]): CollectionDefinition[] {
  return getCollectionCandidates(ads).slice(0, MAX_COLLECTIONS);
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
  const seenCreatives = new Set<string>();
  const distinctAds = ads.filter(definition.match).filter((ad) => {
    // Prefer the visible thumbnail: video ads can have different source URLs
    // while still resolving to the same poster image.
    const source = ad.thumbnail_url || ad.creative_url;
    const key = source ? source.split("?")[0].split("#")[0] : `ad:${ad.id}`;
    if (seenCreatives.has(key)) return false;
    seenCreatives.add(key);
    return true;
  });
  return diversifyByBrand(distinctAds);
}

export function getCollectionDefinition(slug: string, ads: Ad[]) {
  const candidates = getCollectionCandidates(ads);
  const definition = candidates.find((candidate) => candidate.slug === slug);
  return definition && getCollectionAds(ads, definition).length >= 2 ? definition : undefined;
}
