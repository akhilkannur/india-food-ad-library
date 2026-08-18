import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/auth";
import { createAd } from "@/lib/data";

export async function POST(request: Request) {
  if (!(await isAdminAuthenticated())) {
    return new NextResponse("Authentication required.", { status: 401 });
  }

  try {
    const ad = await createAd(await request.json());
    return NextResponse.json(ad, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "The ad could not be created.";
    return new NextResponse(message, { status: 500 });
  }
}
