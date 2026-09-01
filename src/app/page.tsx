import { BrandDirectory } from "@/components/brand-directory";
import { getApprovedAds, getBrands } from "@/lib/data";
import { isDemoMode } from "@/lib/config";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [ads, brands] = await Promise.all([getApprovedAds(), getBrands()]);

  const brandsWithCount = brands.map((brand) => ({
    ...brand,
    adCount: ads.filter((ad) => ad.brand_id === brand.id).length,
  }));

  return (
    <BrandDirectory
      brands={brandsWithCount}
      ads={ads}
      demoMode={isDemoMode}
    />
  );
}
