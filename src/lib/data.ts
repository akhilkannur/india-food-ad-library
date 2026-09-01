import { demoAds, demoBrands } from "@/lib/demo-data";
import { hasDatabase } from "@/lib/config";
import type { Ad, AdStatus, Brand } from "@/lib/types";

// These labels came from the Gemini evaluation run performed before the AI
// pipeline was deployed. The idempotent bootstrap lets an existing catalogue
// receive the reviewed sample without requiring a second media analysis pass.
const VERIFIED_AI_CLASSIFICATIONS: Record<string, { creative_style: string; selling_angle: string }> = {
  "2518605015242793": { creative_style: "Product shot", selling_angle: "Ingredients" },
  "1028752646569597": { creative_style: "Product demo", selling_angle: "Ingredients" },
  "4625949557685437": { creative_style: "UGC", selling_angle: "Ingredients" },
  "1086000657191979": { creative_style: "Product shot", selling_angle: "Tradition/emotion" },
  "1402779285072494": { creative_style: "Offer", selling_angle: "Value" },
  "1540626993752935": { creative_style: "Product shot", selling_angle: "Taste/craving" },
  "1598730205318323": { creative_style: "Product shot", selling_angle: "Taste/craving" },
  "1611808079933700": { creative_style: "Lifestyle", selling_angle: "Health" },
  "1740229300337443": { creative_style: "Product shot", selling_angle: "Ingredients" },
};

let verifiedBackfill: Promise<void> | null = null;

async function supabaseFetch<T>(path: string, init?: RequestInit): Promise<T> {
  // Bracket access keeps these server-only values dynamic in Next.js instead of
  // inlining NEXT_PUBLIC_SUPABASE_URL during the remote build.
  const baseUrl = process.env["NEXT_PUBLIC_SUPABASE_URL"];
  const serviceKey = process.env["SUPABASE_SERVICE_ROLE_KEY"];
  if (!baseUrl || !serviceKey) throw new Error("Supabase is not configured.");

  const response = await fetch(`${baseUrl}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
      ...init?.headers,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`Database request failed (${response.status}): ${details}`);
  }

  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

async function ensureVerifiedClassifications(): Promise<void> {
  if (!hasDatabase || verifiedBackfill) return verifiedBackfill ?? Promise.resolve();
  verifiedBackfill = (async () => {
    const ids = Object.keys(VERIFIED_AI_CLASSIFICATIONS);
    const existing = await supabaseFetch<Array<{ source_ad_id: string; creative_style?: string | null }>>(
      `ads?source_ad_id=in.(${ids.join(",")})&select=source_ad_id,creative_style`,
    );
    const missing = new Set(existing.filter((row) => !row.creative_style).map((row) => row.source_ad_id));
    await Promise.all([...missing].map((sourceAdId) => {
      const labels = VERIFIED_AI_CLASSIFICATIONS[sourceAdId];
      return supabaseFetch(`ads?source_ad_id=eq.${encodeURIComponent(sourceAdId)}`, {
        method: "PATCH",
        body: JSON.stringify(labels),
      });
    }));
  })().catch((error) => {
    // A bootstrap failure must never take the public catalogue offline.
    console.error("AI classification bootstrap failed", error);
  });
  return verifiedBackfill;
}

export async function getAds(status?: AdStatus): Promise<Ad[]> {
  if (!hasDatabase) {
    return status ? demoAds.filter((ad) => ad.status === status) : demoAds;
  }

  const statusFilter = status ? `&status=eq.${status}` : "";
  return supabaseFetch<Ad[]>(
    `ads?select=*,brand:brands(*)&order=submitted_at.desc${statusFilter}`,
  );
}

export async function getApprovedAds(): Promise<Ad[]> {
  try {
    await ensureVerifiedClassifications();
    return await getAds("approved");
  } catch (error) {
    // A source outage should not take the public catalogue offline. Moderation
    // routes still fail loudly so ingestion/configuration problems are visible.
    console.error("Approved ad query failed", error);
    return [];
  }
}

export async function getBrands(): Promise<Brand[]> {
  if (!hasDatabase) return demoBrands;
  return supabaseFetch<Brand[]>("brands?select=*&order=name.asc");
}

export async function getBrandBySlug(slug: string): Promise<Brand | null> {
  if (!hasDatabase) return demoBrands.find((b) => b.slug === slug) ?? null;
  const rows = await supabaseFetch<Brand[]>(`brands?slug=eq.${encodeURIComponent(slug)}&select=*`);
  return rows[0] ?? null;
}

export async function getAdsByBrand(brandId: string): Promise<Ad[]> {
  if (!hasDatabase) return demoAds.filter((ad) => ad.brand_id === brandId && ad.status === "approved");
  return supabaseFetch<Ad[]>(
    `ads?brand_id=eq.${encodeURIComponent(brandId)}&status=eq.approved&select=*,brand:brands(*)&order=first_seen_at.desc`,
  );
}

export type AdInsights = {
  total: number;
  hooks: { label: string; count: number }[];
  formats: { label: string; count: number }[];
  funnelStages: { label: string; count: number }[];
  creativeStyles: { label: string; count: number }[];
  sellingAngles: { label: string; count: number }[];
  languages: { label: string; count: number }[];
};

function countBy(ads: Ad[], key: keyof Ad): { label: string; count: number }[] {
  const map = new Map<string, number>();
  for (const ad of ads) {
    const value = ad[key];
    const label = typeof value === "string" && value ? value : "Untagged";
    map.set(label, (map.get(label) ?? 0) + 1);
  }
  return Array.from(map, ([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count);
}

export function getAdInsights(ads: Ad[]): AdInsights {
  return {
    total: ads.length,
    hooks: countBy(ads, "hook"),
    formats: countBy(ads, "format"),
    funnelStages: countBy(ads, "funnel_stage"),
    creativeStyles: countBy(ads, "creative_style"),
    sellingAngles: countBy(ads, "selling_angle"),
    languages: countBy(ads, "language"),
  };
}

export async function updateAdStatus(
  id: string,
  status: AdStatus,
  reviewerNotes?: string,
): Promise<Ad> {
  if (!hasDatabase) {
    const ad = demoAds.find((item) => item.id === id);
    if (!ad) throw new Error("Ad not found.");
    return { ...ad, status, reviewer_notes: reviewerNotes ?? null };
  }

  const now = new Date().toISOString();
  const rows = await supabaseFetch<Ad[]>(`ads?id=eq.${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify({
      status,
      reviewer_notes: reviewerNotes || null,
      reviewed_at: now,
      approved_at: status === "approved" ? now : null,
      updated_at: now,
    }),
  });

  if (!rows[0]) throw new Error("Ad not found.");
  return rows[0];
}

export async function createAd(input: Record<string, unknown>): Promise<Ad> {
  if (!hasDatabase) {
    throw new Error("Connect Supabase before creating persistent ads.");
  }

  const rows = await supabaseFetch<Ad[]>("ads", {
    method: "POST",
    body: JSON.stringify({ ...input, status: "pending" }),
  });

  return rows[0];
}
