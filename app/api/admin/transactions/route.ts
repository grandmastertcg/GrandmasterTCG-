import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { stripeClient } from "@/lib/stripe";

export async function GET(request: NextRequest) {
  const header = request.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    return NextResponse.json({ error: "Server configuration missing." }, { status: 500 });
  }

  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false }
  });

  const token = header.slice(7);
  const { data: userData, error: userError } = await supabase.auth.getUser(token);
  if (userError || !userData.user) {
    return NextResponse.json({ error: "Invalid login session." }, { status: 401 });
  }

  const { data: admin, error: adminError } = await supabase
    .from("admin_users")
    .select("user_id")
    .eq("user_id", userData.user.id)
    .maybeSingle();

  if (adminError) {
    return NextResponse.json({ error: "Admin verification failed." }, { status: 500 });
  }
  if (!admin) {
    return NextResponse.json({ error: "Administrator access required." }, { status: 403 });
  }

  try {
    const stripe = stripeClient();
    const sessions = await stripe.checkout.sessions.list({
      limit: 50,
      status: "complete",
      expand: ["data.line_items"]
    });

    const transactions = sessions.data
      .filter((session) => session.payment_status === "paid")
      .map((session) => {
        const address = session.shipping_details?.address ?? session.customer_details?.address;
        const place = [address?.city, address?.postal_code].filter(Boolean).join(" ");
        return {
          id: session.id,
          created: new Date(session.created * 1000).toISOString(),
          email: session.customer_details?.email ?? session.customer_email,
          name: session.shipping_details?.name ?? session.customer_details?.name ?? null,
          place,
          amountPence: session.amount_total ?? 0,
          commissionPence: penceFrom(session.metadata?.commission_pence),
          currency: session.currency ?? "gbp",
          items: (session.line_items?.data ?? []).map((item) => ({
            name: item.description || "Card",
            quantity: item.quantity ?? 1
          }))
        };
      });

    return NextResponse.json({ transactions });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Transactions could not be loaded.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

function penceFrom(value: string | undefined) {
  return value != null && /^\d+$/.test(value) ? Number(value) : null;
}
