import { LibraryExplorer } from "@/components/library-explorer";
import { isDemoMode } from "@/lib/config";
import { getApprovedAdsPage, getBrands } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [{ ads, total }, brands] = await Promise.all([
    getApprovedAdsPage({ diverse: true }),
    getBrands(),
  ]);
  return <LibraryExplorer ads={ads} initialTotal={total} initialBrandTotal={brands.length} demoMode={isDemoMode} />;
}
