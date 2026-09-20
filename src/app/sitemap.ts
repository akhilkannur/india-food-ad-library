import type { MetadataRoute } from "next";
import { getApprovedAds, getBrands } from "@/lib/data";
import { getCollectionDefinitions } from "@/lib/collections";

export const dynamic = "force-dynamic";

const MAX_AD_URLS = 500;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const home: MetadataRoute.Sitemap = [
    {
      url: "/",
      lastModified: now,
      changeFrequency: "daily",
      priority: 1,
    },
  ];

  try {
    const [ads, brands] = await Promise.all([getApprovedAds(), getBrands().catch(() => [])]);
    if (!ads.length) return home;

    const collections = getCollectionDefinitions(ads);

    const brandSlugs = new Set(brands.map((brand) => brand.slug));
    ads.forEach((ad) => {
      if (ad.brand?.slug) brandSlugs.add(ad.brand.slug);
    });

    return [
      ...home,
      ...Array.from(brandSlugs).map((slug) => ({
        url: `/brands/${slug}`,
        lastModified: now,
        changeFrequency: "weekly" as const,
        priority: 0.7,
      })),
      ...collections.map((collection) => ({
        url: `/collections/${collection.slug}`,
        lastModified: now,
        changeFrequency: "weekly" as const,
        priority: 0.7,
      })),
      ...ads.slice(0, MAX_AD_URLS).map((ad) => ({
        url: `/ads/${ad.id}`,
        lastModified: ad.last_seen_at ? new Date(ad.last_seen_at) : now,
        changeFrequency: "monthly" as const,
        priority: 0.6,
      })),
    ];
  } catch {
    return home;
  }
}
