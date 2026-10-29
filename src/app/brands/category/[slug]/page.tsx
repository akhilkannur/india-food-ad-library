import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LibraryExplorer } from "@/components/library-explorer";
import { SeoLinks } from "@/components/seo-links";
import { isDemoMode } from "@/lib/config";
import { getApprovedAds } from "@/lib/data";
import { brandCategoryCopy, browseGroups, MIN_INDEXABLE_BRAND_CATEGORY_ADS, summarizeAds } from "@/lib/seo";
import { slugifyBrandCategory, getBrandCategoryAds } from "@/lib/brand-categories";
import { SITE_NAME, SITE_URL } from "@/lib/site";

export const dynamic = "force-dynamic";

const OG_IMAGE = `${SITE_URL}/og-image.png`;

async function getCategoryData(slug: string) {
  const ads = await getApprovedAds();
  const categoryAds = getBrandCategoryAds(ads, slug);
  if (!categoryAds.length) return null;
  const categoryName = categoryAds[0].brand.category;
  return { ads, categoryAds, categoryName };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const data = await getCategoryData(slug);
  if (!data) return { title: "Category not found", robots: { index: false, follow: true } };

  const { categoryAds, categoryName } = data;
  if (categoryAds.length < MIN_INDEXABLE_BRAND_CATEGORY_ADS) {
    return { title: `${categoryName} Ads`, robots: { index: false, follow: true } };
  }

  const { title, description } = brandCategoryCopy(categoryName, categoryAds);
  return {
    title,
    description,
    alternates: { canonical: `/brands/category/${slug}` },
    openGraph: {
      title: `${title} | ${SITE_NAME}`,
      description,
      url: `/brands/category/${slug}`,
      images: [{ url: OG_IMAGE, width: 1200, height: 630, alt: title }],
    },
    twitter: {
      card: "summary_large_image",
      title: `${title} | ${SITE_NAME}`,
      description,
      images: [OG_IMAGE],
    },
  };
}

export default async function BrandCategoryPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const data = await getCategoryData(slug);
  if (!data) notFound();

  const { ads, categoryAds, categoryName } = data;
  if (categoryAds.length < MIN_INDEXABLE_BRAND_CATEGORY_ADS) notFound();

  const { title, intro } = brandCategoryCopy(categoryName, categoryAds);
  const summary = summarizeAds(categoryAds);

  // Top brands in this category with enough ads for their own page
  const brandLinks = summary.brands
    .filter((b) => b.count >= 3)
    .slice(0, 16)
    .map((b) => ({ href: `/brands/${b.slug}`, label: `${b.name} (${b.count})` }));

  // Sibling categories to cross-link
  const siblingLinks = browseGroups(ads)
    .find((g) => g.title === "By brand category")
    ?.links.filter((l) => l.href !== `/brands/category/${slug}`) ?? [];

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Ad library", item: SITE_URL },
      { "@type": "ListItem", position: 2, name: `${categoryName} ads`, item: `${SITE_URL}/brands/category/${slug}` },
    ],
  };

  const itemListJsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: title,
    description: intro,
    url: `${SITE_URL}/brands/category/${slug}`,
    mainEntity: {
      "@type": "ItemList",
      numberOfItems: categoryAds.length,
      itemListElement: categoryAds.slice(0, 30).map((ad, i) => ({
        "@type": "ListItem",
        position: i + 1,
        url: `${SITE_URL}/ads/${ad.id}`,
      })),
    },
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListJsonLd) }} />
      <LibraryExplorer
        ads={categoryAds}
        demoMode={isDemoMode}
        showCollections={false}
        pageTitle={`${categoryName} brand ads`}
        pageDescription={intro}
        intro={
          <SeoLinks
            groups={[
              { title: `Top ${categoryName.toLowerCase()} brands`, links: brandLinks },
              ...(siblingLinks.length ? [{ title: "Other brand categories", links: siblingLinks }] : []),
            ]}
          />
        }
        seoContent={<SeoLinks heading="Explore more food & beverage ads" groups={browseGroups(ads, { excludeCategorySlug: slug })} />}
        backLabel="All ads"
      />
    </>
  );
}
