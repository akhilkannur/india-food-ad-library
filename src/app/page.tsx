import type { Metadata } from "next";
import { LibraryExplorer } from "@/components/library-explorer";
import { isDemoMode } from "@/lib/config";
import { getApprovedAds, getApprovedAdsPage } from "@/lib/data";
import { getCuratedCollections } from "@/lib/collections";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Indian Food & Beverage Ad Inspiration — 1,000+ Meta Creatives",
  description:
    "Browse 1,000+ Indian food & beverage Meta ads by brand, format, hook and angle. A swipe file of product demos, UGC, recipe creatives and offers for DTC & brand teams.",
  alternates: { canonical: "/" },
};

export default async function HomePage() {
  const [{ ads, total }, allAds] = await Promise.all([
    getApprovedAdsPage({ diverse: true }),
    getApprovedAds(),
  ]);
  const initialCollections = getCuratedCollections(allAds);
  return (
    <LibraryExplorer ads={ads} initialTotal={total} initialCollections={initialCollections} demoMode={isDemoMode} />
  );
}
