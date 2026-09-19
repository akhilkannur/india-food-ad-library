import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/auth";
import { createAd } from "@/lib/data";

export async function POST(request: Request) {
  if (!(await isAdminAuthenticated())) {
    return new NextResponse("Authentication required.", { status: 401 });
  }

  try {
    const input: unknown = await request.json();
    if (!input || Array.isArray(input) || typeof input !== "object") {
      return new NextResponse("Ad data must be an object.", { status: 400 });
    }
    const ad = await createAd(input as Record<string, unknown>);
    return NextResponse.json(ad, { status: 201 });
  } catch (error) {
    if (error instanceof SyntaxError) return new NextResponse("Ad data must be valid JSON.", { status: 400 });
    const message = error instanceof Error ? error.message : "The ad could not be created.";
    return new NextResponse(message, { status: 500 });
  }
}
