import { NextRequest, NextResponse } from "next/server";
import { userFromRequest } from "@/lib/require-user";
import { finalizeCheckout } from "@/lib/fulfillment";
import { supabaseAdmin } from "@/lib/supabase";

export async function POST(request: NextRequest) {
  const user = await userFromRequest(request);
  if (!user) return NextResponse.json({ error: "Please sign in." }, { status: 401 });

  const body = await request.json();
  const sessionId = String(body.sessionId ?? "");
  if (!sessionId.startsWith("cs_")) {
    return NextResponse.json({ error: "Unknown checkout." }, { status: 400 });
  }

  const { data: order } = await supabaseAdmin().from("orders").select("buyer_id").eq("stripe_session_id", sessionId).maybeSingle();
  if (order && order.buyer_id !== user.id) {
    return NextResponse.json({ error: "This checkout belongs to another account." }, { status: 403 });
  }

  try {
    await finalizeCheckout(sessionId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Checkout could not be confirmed.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
