import type { MetadataRoute } from "next";
import { getApprovedAds } from "@/lib/data";
import { getLandingDefinitions } from "@/lib/collections";
import { MIN_INDEXABLE_BRAND_ADS, summarizeAds } from "@/lib/seo";
import { SITE_URL } from "@/lib/site";
import { isPreviewUnavailable } from "@/lib/media";

export const dynamic = "force-dynamic";

function latest(dates: Array<string | null | undefined>, fallback: Date) {
  const times = dates.map((date) => (date ? new Date(date).getTime() : NaN)).filter(Number.isFinite);
  return times.length ? new Date(Math.max(...times)) : fallback;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const ads = await getApprovedAds().catch(() => []);
  const home: MetadataRoute.Sitemap = [
    {
      url: `${SITE_URL}/`,
      lastModified: latest(ads.map((ad) => ad.approved_at || ad.submitted_at), now),
      changeFrequency: "daily",
      priority: 1,
    },
  ];
  if (!ads.length) return home;

  // Only list pages that resolve and are indexable: brands without approved
  // ads 404, and thin brand pages carry noindex.
  const brands = summarizeAds(ads).brands.filter((brand) => brand.count >= MIN_INDEXABLE_BRAND_ADS);

  // Only index ads whose creative is still available — dead-creative pages
  // carry noindex so there's no point listing them in the sitemap.
  const indexableAds = ads.filter((ad) => !isPreviewUnavailable(ad));

  return [
    ...home,
    ...getLandingDefinitions(ads).map((definition) => ({
      url: `${SITE_URL}/collections/${definition.slug}`,
      lastModified: latest(ads.filter(definition.match).map((ad) => ad.approved_at || ad.submitted_at), now),
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })),
    ...brands.map((brand) => ({
      url: `${SITE_URL}/brands/${brand.slug}`,
      lastModified: latest(
        ads.filter((ad) => ad.brand.slug === brand.slug).map((ad) => ad.approved_at || ad.submitted_at),
        now,
      ),
      changeFrequency: "weekly" as const,
      priority: 0.7,
    })),
    ...indexableAds.map((ad) => ({
      url: `${SITE_URL}/ads/${ad.id}`,
      lastModified: new Date(ad.last_seen_at || ad.approved_at || ad.submitted_at),
      changeFrequency: "monthly" as const,
      priority: 0.5,
    })),
  ];
}
