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
    title: `${definition.name} — India Food Ad Library`,
    description: `Browse ${definition.name.toLowerCase()} advertising creative from Indian food and beverage brands.`,
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
      pageTitle={definition.name}
    />
  );
}
