import { NextRequest, NextResponse } from "next/server";
import { stripeClient } from "@/lib/stripe";
import { finalizeCheckout } from "@/lib/fulfillment";

export async function POST(request: NextRequest) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const signature = request.headers.get("stripe-signature");
  if (!secret || !signature) {
    return NextResponse.json({ error: "Webhook is not configured." }, { status: 500 });
  }

  const payload = await request.text();
  let event;
  try {
    event = stripeClient().webhooks.constructEvent(payload, signature, secret);
  } catch {
    return NextResponse.json({ error: "Invalid webhook signature." }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    if (session.payment_status === "paid") {
      try {
        await finalizeCheckout(session.id);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Order could not be finalised.";
        return NextResponse.json({ error: message }, { status: 500 });
      }
    }
  }

  return NextResponse.json({ received: true });
}
