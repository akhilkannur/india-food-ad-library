import { LibraryExplorer } from "@/components/library-explorer";
import { isDemoMode } from "@/lib/config";
import { getApprovedAds } from "@/lib/data";

export default async function HomePage() {
  const ads = await getApprovedAds();
  return <LibraryExplorer ads={ads} demoMode={isDemoMode} />;
}
