import type { Metadata } from "next";
import { LibraryExplorer } from "@/components/library-explorer";
import { isDemoMode } from "@/lib/config";
import { getApprovedAds, getApprovedAdsPage } from "@/lib/data";
import { getCuratedCollections } from "@/lib/collections";
import { SeoLinks } from "@/components/seo-links";
import { browseGroups } from "@/lib/seo";
import { SITE_URL } from "@/lib/site";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Best Facebook Ad Examples — 1,000+ Indian Food & Beverage Creatives",
  description:
    "Browse 1,000+ top-performing Facebook ad examples and Meta creatives from Indian food & beverage brands. A swipe file of hooks, video formats, UGC, and ad copy for DTC teams.",
  alternates: { canonical: "/" },
  openGraph: {
    images: [{ url: `${SITE_URL}/og-image.png`, width: 1200, height: 630, alt: "Best Facebook Ad Examples — Indian Food & Beverage Ad Library" }],
  },
};

const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "What is the F&B Ad Library?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "A curated swipe file of 1,000+ Indian food and beverage Meta (Facebook & Instagram) ads, organised by brand, creative format, hook and selling angle. Updated weekly.",
      },
    },
    {
      "@type": "Question",
      name: "Who is this ad library for?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "DTC brand founders, performance marketers and creative teams in the Indian food and beverage space who need inspiration for their Meta ad campaigns.",
      },
    },
    {
      "@type": "Question",
      name: "What types of ads are in the library?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "The library includes product demos, UGC (user-generated content), recipe creatives, offer/discount ads, testimonial ads, and brand storytelling — across image and video formats.",
      },
    },
    {
      "@type": "Question",
      name: "Is the ad library free to use?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes — sign in with Google to unlock full access to every creative in the library at no cost.",
      },
    },
    {
      "@type": "Question",
      name: "How often is the library updated?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "New ads are scraped and reviewed weekly, so the library stays current with what Indian F&B brands are actively running.",
      },
    },
  ],
};

export default async function HomePage() {
  const [{ ads, total }, allAds] = await Promise.all([
    getApprovedAdsPage({ diverse: true }),
    getApprovedAds(),
  ]);
  const initialCollections = getCuratedCollections(allAds);
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />
      <LibraryExplorer
        ads={ads}
        initialTotal={total}
        initialCollections={initialCollections}
        demoMode={isDemoMode}
        seoContent={<SeoLinks heading="Browse Indian food & beverage ads" groups={browseGroups(allAds)} />}
      />
    </>
  );
}
