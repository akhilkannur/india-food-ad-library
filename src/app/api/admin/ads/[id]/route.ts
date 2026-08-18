import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/auth";
import { AD_STATUSES, type AdStatus } from "@/lib/types";
import { updateAdStatus } from "@/lib/data";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!(await isAdminAuthenticated())) {
    return new NextResponse("Authentication required.", { status: 401 });
  }

  const { id } = await context.params;
  const body = (await request.json()) as { status?: AdStatus; reviewerNotes?: string };
  if (!body.status || !AD_STATUSES.includes(body.status)) {
    return new NextResponse("Choose pending, approved or rejected.", { status: 400 });
  }

  try {
    const ad = await updateAdStatus(id, body.status, body.reviewerNotes);
    return NextResponse.json(ad);
  } catch (error) {
    const message = error instanceof Error ? error.message : "The ad could not be updated.";
    return new NextResponse(message, { status: 500 });
  }
}
