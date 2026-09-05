import { NextResponse } from "next/server";
import { getApprovedAdsPage } from "@/lib/data";

function boundedInteger(value: string | null, fallback: number, min: number, max: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) ? Math.min(Math.max(parsed, min), max) : fallback;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const limit = boundedInteger(url.searchParams.get("limit"), 36, 1, 60);
  const offset = boundedInteger(url.searchParams.get("offset"), 0, 0, 100_000);
  const page = await getApprovedAdsPage({
    limit,
    offset,
    diverse: url.searchParams.get("diversity") === "variety",
  });

  return NextResponse.json({
    ads: page.ads,
    total: page.total,
    hasMore: offset + page.ads.length < page.total,
  });
}
