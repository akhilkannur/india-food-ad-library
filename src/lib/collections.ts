import type { Ad } from "@/lib/types";

export type CollectionDefinition = {
  slug: string;
  name: string;
  match: (ad: Ad) => boolean;
};

export const collectionDefinitions: CollectionDefinition[] = [
  {
    slug: "ingredient-led",
    name: "Ingredient-led",
    match: (ad) => /ingredient/i.test(`${ad.hook} ${ad.selling_angle} ${ad.headline}`),
  },
  {
    slug: "founder-led-stories",
    name: "Founder-led stories",
    match: (ad) => /founder|origin|story/i.test(`${ad.format} ${ad.hook} ${ad.selling_angle}`),
  },
  {
    slug: "offers-and-bundles",
    name: "Offers & bundles",
    match: (ad) => /offer|discount|value|bundle/i.test(`${ad.format} ${ad.selling_angle} ${ad.offer} ${ad.headline}`),
  },
  {
    slug: "hindi-and-hinglish",
    name: "Hindi & Hinglish",
    match: (ad) => /hindi|hinglish/i.test(ad.language || ""),
  },
];

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

export function getCollectionDefinition(slug: string) {
  return collectionDefinitions.find((definition) => definition.slug === slug);
}
