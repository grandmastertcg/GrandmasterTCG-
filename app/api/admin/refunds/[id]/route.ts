import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { userFromRequest } from "@/lib/require-user";
import { paySeller, refundShipment, releaseHold } from "@/lib/fulfillment";

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const user = await userFromRequest(request);
  if (!user) return NextResponse.json({ error: "Please sign in as the shop." }, { status: 401 });
  const { data: admin } = await supabaseAdmin().from("admin_users").select("user_id").eq("user_id", user.id).maybeSingle();
  if (!admin) return NextResponse.json({ error: "Please sign in as the shop." }, { status: 403 });

  const { id } = await context.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "Unknown parcel." }, { status: 400 });
  const body = await request.json();
  const action = String(body.action ?? "");

  try {
    if (action === "refund") {
      await refundShipment(id);
      return NextResponse.json({ ok: true, message: "The buyer has been refunded. The seller will not be paid for this parcel." });
    }
    if (action === "release") {
      await releaseHold(id);
      await paySeller(id);
      return NextResponse.json({ ok: true, message: "The request is closed. The seller is paid an hour after the buyer confirms, or 2 days after the courier shows the parcel delivered." });
    }
    return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "That refund could not be completed.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
