import { demoAds, demoBrands } from "@/lib/demo-data";
import { hasDatabase } from "@/lib/config";
import type { Ad, AdStatus, Brand } from "@/lib/types";

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
