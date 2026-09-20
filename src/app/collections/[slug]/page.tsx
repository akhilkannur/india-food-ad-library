import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LibraryExplorer } from "@/components/library-explorer";
import { isDemoMode } from "@/lib/config";
import { getCollectionAds, getCollectionDefinition } from "@/lib/collections";
import { getApprovedAds } from "@/lib/data";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const ads = await getApprovedAds();
  const definition = getCollectionDefinition(slug, ads);
  if (!definition) return { title: "Collection not found" };
  return {
    title: `${definition.name} Food Ads — Creative Format Inspiration for DTC Teams`,
    description: `Steal inspiration from ${definition.name.toLowerCase()} Meta ad creatives from Indian food & beverage brands — hooks, angles and examples brand teams can reuse.`,
    alternates: { canonical: `/collections/${slug}` },
    openGraph: {
      title: `${definition.name} Food Ads — Creative Format Inspiration | F&B Ad Library`,
      description: `Browse ${definition.name.toLowerCase()} advertising creative from Indian food & beverage brands for your next campaign.`,
      url: `/collections/${slug}`,
    },
  };
}

export default async function CollectionPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const ads = await getApprovedAds();
  const definition = getCollectionDefinition(slug, ads);
  if (!definition) notFound();

  const collectionAds = getCollectionAds(ads, definition);
  return (
    <LibraryExplorer
      ads={collectionAds}
      demoMode={isDemoMode}
      showCollections={false}
      pageTitle={`${definition.name} ads`}
      pageDescription={`${collectionAds.length} ${definition.name.toLowerCase()} creatives from Indian food & beverage brands — compare hooks, angles and execution styles before your next brief.`}
    />
  );
}
