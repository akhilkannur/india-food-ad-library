import { notFound } from "next/navigation";
import { BrandPageView } from "@/components/brand-page-view";
import { getBrandBySlug, getAdsByBrand } from "@/lib/data";
import { isDemoMode } from "@/lib/config";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const brand = await getBrandBySlug(slug);
  if (!brand) return { title: "Brand not found" };
  return {
    title: `${brand.name} — India Food Ad Library`,
    description: `Ad creatives and creative analysis for ${brand.name}.`,
  };
}

export default async function BrandPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const brand = await getBrandBySlug(slug);
  if (!brand) notFound();

  const resolved = brand as NonNullable<typeof brand>;
  const ads = await getAdsByBrand(resolved.id);

  return <BrandPageView brand={resolved} ads={ads} demoMode={isDemoMode} />;
}
