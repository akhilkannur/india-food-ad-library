import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LibraryExplorer } from "@/components/library-explorer";
import { isDemoMode } from "@/lib/config";
import { getApprovedAds } from "@/lib/data";

export const dynamic = "force-dynamic";

async function getBrandAds(slug: string) {
  const ads = await getApprovedAds();
  return ads.filter((ad) => ad.brand.slug === slug);
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const ads = await getBrandAds((await params).slug);
  const brand = ads[0]?.brand;
  if (!brand) return { title: "Brand not found" };

  return {
    title: `${brand.name} Meta Ads & Creatives — Inspiration, Hooks & Formats`,
    description: `Steal inspiration from ${ads.length} ${brand.name} Meta ad creatives — hooks, formats, angles and languages Indian DTC & food brand teams can reuse.`,
    alternates: { canonical: `/brands/${brand.slug}` },
    openGraph: {
      title: `${brand.name} Meta Ads & Creatives — Inspiration, Hooks & Formats | F&B Ad Library`,
      description: `Browse ${ads.length} ${brand.name} food & beverage ad creatives for hooks, formats and campaign ideas.`,
      url: `/brands/${brand.slug}`,
    },
  };
}

export default async function BrandPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const ads = await getBrandAds((await params).slug);
  if (!ads.length) notFound();

  const styles = Array.from(new Set(ads.map((ad) => ad.creative_style).filter(Boolean))).slice(0, 3);

  return (
    <LibraryExplorer
      ads={ads}
      demoMode={isDemoMode}
      showCollections={false}
      pageTitle={`${ads[0].brand.name} ads`}
      pageDescription={`${ads.length} Meta creatives from ${ads[0].brand.name} — ${styles.length ? `featuring ${styles.join(", ")} formats` : "across formats"} — for DTC & food brand teams looking for hooks, angles and inspiration.`}
      backLabel="All ads"
    />
  );
}
