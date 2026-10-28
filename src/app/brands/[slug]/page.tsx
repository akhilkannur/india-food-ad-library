import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LibraryExplorer } from "@/components/library-explorer";
import { SeoLinks } from "@/components/seo-links";
import { isDemoMode } from "@/lib/config";
import { getApprovedAds } from "@/lib/data";
import { brandCopy, browseGroups, MIN_INDEXABLE_BRAND_ADS, summarizeAds } from "@/lib/seo";
import { SITE_NAME } from "@/lib/site";

export const dynamic = "force-dynamic";

async function getBrandAds(slug: string) {
  const ads = await getApprovedAds();
  return { ads, brandAds: ads.filter((ad) => ad.brand.slug === slug) };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { brandAds } = await getBrandAds((await params).slug);
  const brand = brandAds[0]?.brand;
  if (!brand) return { title: "Brand not found", robots: { index: false, follow: true } };

  const { description } = brandCopy(brandAds);
  const title = `${brand.name} Ads — ${brandAds.length} Meta Ad Examples & Creatives`;
  return {
    title,
    description,
    alternates: { canonical: `/brands/${brand.slug}` },
    // Very small brand pages are thin content; keep them crawlable but unindexed.
    ...(brandAds.length < MIN_INDEXABLE_BRAND_ADS ? { robots: { index: false, follow: true } } : {}),
    openGraph: {
      title: `${title} | ${SITE_NAME}`,
      description,
      url: `/brands/${brand.slug}`,
    },
  };
}

export default async function BrandPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { ads, brandAds } = await getBrandAds((await params).slug);
  if (!brandAds.length) notFound();

  const brand = brandAds[0].brand;
  const { intro } = brandCopy(brandAds);
  const peers = summarizeAds(ads.filter((ad) => ad.brand.category === brand.category && ad.brand.slug !== brand.slug))
    .brands.filter((peer) => peer.count >= MIN_INDEXABLE_BRAND_ADS)
    .slice(0, 10)
    .map((peer) => ({ href: `/brands/${peer.slug}`, label: `${peer.name} ads` }));

  return (
    <LibraryExplorer
      ads={brandAds}
      demoMode={isDemoMode}
      showCollections={false}
      pageTitle={`${brand.name} ads`}
      pageDescription={intro}
      intro={<SeoLinks groups={[{ title: `Other ${brand.category.toLowerCase()} brands`, links: peers }]} />}
      seoContent={<SeoLinks heading="Explore more food & beverage ads" groups={browseGroups(ads)} />}
      backLabel="All ads"
    />
  );
}
