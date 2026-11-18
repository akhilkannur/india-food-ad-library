import "server-only";
import { cache } from "react";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { diversifyByBrandAndMedia } from "@/lib/collections";
import { isFoodCreative } from "@/lib/curation";
import { demoAds, demoBrands } from "@/lib/demo-data";
import { hasDatabase } from "@/lib/config";
import { isPreviewUnavailable } from "@/lib/media";
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

const CATALOGUE_PATH = "ads?select=*,brand:brands(*)&order=submitted_at.desc,id.asc&status=eq.approved";
const CATALOGUE_PAGE_SIZE = 500;

async function fetchApprovedCatalogue(): Promise<Ad[]> {
  // First page tells us the total; fetch the rest in parallel rather than serially.
  const first = await supabaseFetchPage<Ad[]>(CATALOGUE_PATH, 0, CATALOGUE_PAGE_SIZE);
  const offsets: number[] = [];
  for (let offset = first.rows.length; offset < first.total; offset += CATALOGUE_PAGE_SIZE) offsets.push(offset);
  const rest = await Promise.all(
    offsets.map((offset) => supabaseFetchPage<Ad[]>(CATALOGUE_PATH, offset, CATALOGUE_PAGE_SIZE)),
  );
  const ads = [first, ...rest].flatMap((page) => page.rows);
  return sortAdsByAvailability(ads.filter(isFoodCreative));
}

/**
 * Sort approved ads so that expired/unavailable creatives sink below live ones,
 * while preserving the source ordering (newest submitted first) within each group.
 */
export function sortAdsByAvailability<T extends Ad>(ads: T[]) {
  return [...ads].sort((left, right) => {
    const leftUnavailable = isPreviewUnavailable(left) ? 1 : 0;
    const rightUnavailable = isPreviewUnavailable(right) ? 1 : 0;
    if (leftUnavailable !== rightUnavailable) return leftUnavailable - rightUnavailable;
    return new Date(right.submitted_at).getTime() - new Date(left.submitted_at).getTime();
  });
}

export async function getAds(status?: AdStatus): Promise<Ad[]> {
  if (!hasDatabase) {
    return status ? demoAds.filter((ad) => ad.status === status) : demoAds;
  }

  const statusFilter = status ? `&status=eq.${status}` : "";
  const rows = await supabaseFetch<Ad[]>(
    `ads?select=*,brand:brands(*)&order=submitted_at.desc${statusFilter}`,
  );
  return sortAdsByAvailability(rows);
}

// Catalogue caching, two layers, stale-while-revalidate:
//  1. per-isolate memory (instant, lost when the isolate is recycled)
//  2. Cloudflare's per-datacenter Cache API (survives cold starts, no bindings)
// A copy older than FRESH_MS is still served immediately while a background
// refresh runs, so visitors almost never wait on Supabase (~1.8MB, seconds).
type CachedCatalogue = { ads: Ad[]; fetchedAt: number };

const FRESH_MS = 5 * 60 * 1000;
const EDGE_MAX_AGE_SECONDS = 24 * 60 * 60;
const EDGE_CACHE_KEY = "https://catalogue-cache.adlibrary.internal/approved-food-ads-v3";

let memoryAds: CachedCatalogue | null = null;
let pendingAds: Promise<Ad[]> | null = null;
let refreshing: Promise<unknown> | null = null;

const isFresh = (entry: CachedCatalogue) => Date.now() - entry.fetchedAt < FRESH_MS;

function edgeCache(): Cache | null {
  const storage = (globalThis as { caches?: { default?: Cache } }).caches;
  return storage?.default ?? null;
}

/** Keep work alive after the response is sent (Workers waitUntil), when available. */
function runInBackground(task: Promise<unknown>) {
  const guarded = task.catch((error) => console.error("Background catalogue task failed", error));
  try {
    getCloudflareContext().ctx.waitUntil(guarded);
  } catch {
    // Outside a Workers request (local dev/build): just let it run.
  }
}

async function readEdgeCatalogue(): Promise<CachedCatalogue | null> {
  const cache = edgeCache();
  if (!cache) return null;
  try {
    const response = await cache.match(EDGE_CACHE_KEY);
    return response ? (await response.json()) as CachedCatalogue : null;
  } catch (error) {
    console.error("Edge catalogue read failed", error);
    return null;
  }
}

async function writeEdgeCatalogue(entry: CachedCatalogue) {
  const cache = edgeCache();
  if (!cache) return;
  await cache.put(EDGE_CACHE_KEY, new Response(JSON.stringify(entry), {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": `public, max-age=${EDGE_MAX_AGE_SECONDS}`,
    },
  }));
}

async function fetchAndStoreCatalogue(): Promise<CachedCatalogue> {
  const entry = { ads: await fetchApprovedCatalogue(), fetchedAt: Date.now() };
  memoryAds = entry;
  runInBackground(writeEdgeCatalogue(entry));
  return entry;
}

function refreshInBackground() {
  if (refreshing) return;
  refreshing = fetchAndStoreCatalogue().finally(() => {
    refreshing = null;
  });
  runInBackground(refreshing);
}

async function getMemoizedApprovedAds(): Promise<Ad[]> {
  if (memoryAds) {
    if (!isFresh(memoryAds)) refreshInBackground();
    return memoryAds.ads;
  }

  pendingAds ??= (async () => {
    const edge = await readEdgeCatalogue();
    if (edge?.ads?.length) {
      memoryAds = edge;
      if (!isFresh(edge)) refreshInBackground();
      return edge.ads;
    }
    return (await fetchAndStoreCatalogue()).ads;
  })().finally(() => {
    pendingAds = null;
  });
  return pendingAds;
}

/** Drop cached catalogue copies after a moderation change (this datacenter only). */
async function invalidateCatalogue() {
  memoryAds = null;
  try {
    await edgeCache()?.delete(EDGE_CACHE_KEY);
  } catch (error) {
    console.error("Edge catalogue invalidation failed", error);
  }
}

export async function getApprovedAds(): Promise<Ad[]> {
  if (!hasDatabase) return sortAdsByAvailability(demoAds.filter((ad) => ad.status === "approved" && isFoodCreative(ad)));

  try {
    return await getMemoizedApprovedAds();
  } catch (error) {
    // A source outage should not take the public catalogue offline. Moderation
    // routes still fail loudly so ingestion/configuration problems are visible.
    console.error("Approved ad query failed", error);
    return [];
  }
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// cache() dedupes the lookup between generateMetadata and the page render.
export const getApprovedAd = cache(async (id: string): Promise<Ad | null> => {
  if (!hasDatabase) {
    return demoAds.find((ad) => ad.id === id && ad.status === "approved") || null;
  }

  // ads.id is a uuid column: anything else makes Postgres error (500) instead of 404.
  if (!UUID_PATTERN.test(id)) return null;

  // Serve from the warm per-isolate catalogue when we have it.
  const warm = memoryAds?.ads.find((ad) => ad.id === id);
  if (warm) return warm;

  const rows = await supabaseFetch<Ad[]>(
    `ads?select=*,brand:brands(*)&id=eq.${encodeURIComponent(id)}&status=eq.approved&limit=1`,
  );
  return rows[0] || null;
});

export async function getApprovedAdsPage({
  limit = 36,
  offset = 0,
  diverse = false,
}: { limit?: number; offset?: number; diverse?: boolean } = {}): Promise<AdPage> {
  const safeLimit = Math.min(Math.max(limit, 1), 60);
  const safeOffset = Math.max(offset, 0);

  const approvedAds = await getApprovedAds();

  let ordered: Ad[];
  if (diverse) {
    const available = approvedAds.filter((ad) => !isPreviewUnavailable(ad));
    const unavailable = approvedAds.filter(isPreviewUnavailable);
    ordered = [...diversifyByBrandAndMedia(available), ...unavailable];
  } else {
    ordered = approvedAds;
  }
  return { ads: ordered.slice(safeOffset, safeOffset + safeLimit), total: ordered.length };
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
  await invalidateCatalogue();
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
