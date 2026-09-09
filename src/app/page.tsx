import { LibraryExplorer } from "@/components/library-explorer";
import { isDemoMode } from "@/lib/config";
import { getApprovedAds, getApprovedAdsPage } from "@/lib/data";
import { getCuratedCollections } from "@/lib/collections";

export const dynamic = "force-dynamic";

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
