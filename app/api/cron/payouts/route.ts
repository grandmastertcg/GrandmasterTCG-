import { NextRequest, NextResponse } from "next/server";
import { releaseDuePayouts } from "@/lib/fulfillment";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const bearer = secret && request.headers.get("authorization") === `Bearer ${secret}`;
  const scheduled = request.headers.get("x-vercel-cron") === "1";
  if (!bearer && !scheduled) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  await releaseDuePayouts();
  return NextResponse.json({ ok: true });
}
