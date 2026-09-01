import { LibraryExplorer } from "@/components/library-explorer";
import { isDemoMode } from "@/lib/config";
import { getApprovedAds } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const ads = await getApprovedAds();
  return <LibraryExplorer ads={ads} demoMode={isDemoMode} />;
}
