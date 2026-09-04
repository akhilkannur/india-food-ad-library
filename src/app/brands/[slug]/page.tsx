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
    title: `${brand.name} ads — India Food Ad Library`,
    description: `Browse advertising creative from ${brand.name}.`,
  };
}

export default async function BrandPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const ads = await getBrandAds((await params).slug);
  if (!ads.length) notFound();

  return (
    <LibraryExplorer
      ads={ads}
      demoMode={isDemoMode}
      showCollections={false}
      pageTitle={ads[0].brand.name}
      backLabel="All ads"
    />
  );
}
