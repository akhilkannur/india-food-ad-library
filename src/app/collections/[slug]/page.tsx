import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LibraryExplorer } from "@/components/library-explorer";
import { SeoLinks } from "@/components/seo-links";
import { isDemoMode } from "@/lib/config";
import { getCollectionAds, getCollectionDefinition } from "@/lib/collections";
import { getApprovedAds } from "@/lib/data";
import { browseGroups, landingCopy } from "@/lib/seo";
import { SITE_NAME, SITE_URL } from "@/lib/site";

export const dynamic = "force-dynamic";

async function getCollection(slug: string) {
  const ads = await getApprovedAds();
  const definition = getCollectionDefinition(slug, ads);
  if (!definition) return null;
  const collectionAds = getCollectionAds(ads, definition);
  return { ads, definition, collectionAds, copy: landingCopy(definition, collectionAds) };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const collection = await getCollection(slug);
  if (!collection) return { title: "Collection not found", robots: { index: false, follow: true } };
  const { copy } = collection;
  return {
    title: copy.title,
    description: copy.description,
    alternates: { canonical: `/collections/${slug}` },
    openGraph: {
      title: `${copy.title} | ${SITE_NAME}`,
      description: copy.description,
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
  const collection = await getCollection(slug);
  if (!collection) notFound();

  const { ads, collectionAds, copy } = collection;
  const canonical = `${SITE_URL}/collections/${slug}`;
  const itemListJsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: copy.heading,
    description: copy.description,
    url: canonical,
    mainEntity: {
      "@type": "ItemList",
      numberOfItems: collectionAds.length,
      itemListElement: collectionAds.slice(0, 30).map((ad, index) => ({
        "@type": "ListItem",
        position: index + 1,
        url: `${SITE_URL}/ads/${ad.id}`,
      })),
    },
  };
  const brandLinks = copy.summary.brands.slice(0, 12).map((brand) => ({
    href: `/brands/${brand.slug}`,
    label: `${brand.name} (${brand.count})`,
  }));

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListJsonLd) }} />
      <LibraryExplorer
        ads={collectionAds}
        demoMode={isDemoMode}
        showCollections={false}
        pageTitle={copy.heading}
        pageDescription={copy.intro}
        intro={<SeoLinks groups={[{ title: "Brands in this collection", links: brandLinks }]} />}
        seoContent={<SeoLinks heading="Explore more food & beverage ads" groups={browseGroups(ads, { exclude: slug })} />}
      />
    </>
  );
}
