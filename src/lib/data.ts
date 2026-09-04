import { unstable_cache } from "next/cache";
import { demoAds, demoBrands } from "@/lib/demo-data";
import { hasDatabase } from "@/lib/config";
import type { Ad, AdStatus, Brand } from "@/lib/types";

export type AdPage = {
  ads: Ad[];
  total: number;
};

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

async function supabaseFetchPage<T>(path: string, offset: number, limit: number): Promise<{ rows: T; total: number }> {
  const baseUrl = process.env["NEXT_PUBLIC_SUPABASE_URL"];
  const serviceKey = process.env["SUPABASE_SERVICE_ROLE_KEY"];
  if (!baseUrl || !serviceKey) throw new Error("Supabase is not configured.");

  const response = await fetch(`${baseUrl}/rest/v1/${path}`, {
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
      Prefer: "count=exact, return=representation",
      Range: `${offset}-${offset + limit - 1}`,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`Database request failed (${response.status}): ${details}`);
  }

  const rows = await response.json() as T;
  const contentRange = response.headers.get("content-range");
  const parsedTotal = Number(contentRange?.split("/")[1]);
  const total = Number.isFinite(parsedTotal) ? parsedTotal : Array.isArray(rows) ? rows.length : 0;
  return { rows, total };
}

const getCachedApprovedAds = unstable_cache(
  () => supabaseFetch<Ad[]>(
    "ads?select=*,brand:brands(*)&order=submitted_at.desc&status=eq.approved",
  ),
  ["approved-ads"],
  { revalidate: 300 },
);

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
  if (!hasDatabase) return demoAds.filter((ad) => ad.status === "approved");

  try {
    return await getCachedApprovedAds();
  } catch (error) {
    // A source outage should not take the public catalogue offline. Moderation
    // routes still fail loudly so ingestion/configuration problems are visible.
    console.error("Approved ad query failed", error);
    return [];
  }
}

export async function getApprovedAdsPage({ limit = 36, offset = 0 }: { limit?: number; offset?: number } = {}): Promise<AdPage> {
  const safeLimit = Math.min(Math.max(limit, 1), 60);
  const safeOffset = Math.max(offset, 0);

  if (!hasDatabase) {
    const approvedAds = demoAds.filter((ad) => ad.status === "approved");
    return {
      ads: approvedAds.slice(safeOffset, safeOffset + safeLimit),
      total: approvedAds.length,
    };
  }

  try {
    const { rows, total } = await supabaseFetchPage<Ad[]>(
      "ads?select=*,brand:brands(*)&order=submitted_at.desc,id.asc&status=eq.approved",
      safeOffset,
      safeLimit,
    );
    return { ads: rows, total };
  } catch (error) {
    console.error("Approved ad page query failed", error);
    return { ads: [], total: 0 };
  }
}

export async function getBrands(): Promise<Brand[]> {
  if (!hasDatabase) return demoBrands;
  return supabaseFetch<Brand[]>("brands?select=*&order=name.asc");
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
