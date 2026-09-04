import { LibraryExplorer } from "@/components/library-explorer";
import { isDemoMode } from "@/lib/config";
import { getApprovedAdsPage } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const { ads, total } = await getApprovedAdsPage();
  return <LibraryExplorer ads={ads} initialTotal={total} demoMode={isDemoMode} />;
}
