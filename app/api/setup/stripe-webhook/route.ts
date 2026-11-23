import { NextRequest, NextResponse } from "next/server";
import { stripeClient } from "@/lib/stripe";

const WEBHOOK_URL = "https://grandmastertcg.co.uk/api/stripe/webhook";

export async function POST(request: NextRequest) {
  const token = process.env.SETUP_TOKEN;
  if (!token || request.headers.get("x-setup-token") !== token) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const stripe = stripeClient();
  const existing = await stripe.webhookEndpoints.list({ limit: 100 });
  const match = existing.data.find((endpoint) => endpoint.url === WEBHOOK_URL);
  if (match) await stripe.webhookEndpoints.del(match.id);

  const endpoint = await stripe.webhookEndpoints.create({
    url: WEBHOOK_URL,
    enabled_events: ["checkout.session.completed"],
    description: "GrandmasterTCG paid checkout"
  });

  let connect = "enabled";
  try {
    await stripe.accounts.list({ limit: 1 });
  } catch (error) {
    connect = error instanceof Error ? error.message : "Connect is not available.";
  }

  return NextResponse.json({
    created: true,
    id: endpoint.id,
    secret: endpoint.secret,
    connect
  });
}
