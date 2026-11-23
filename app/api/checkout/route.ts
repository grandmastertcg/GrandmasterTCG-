import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { stripeClient } from "@/lib/stripe";
import { userFromRequest } from "@/lib/require-user";
import { commissionOnSale } from "@/lib/commission";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (!Array.isArray(body.items) || body.items.length < 1 || body.items.length > 50) {
      return NextResponse.json({ error: "Your basket is empty or invalid." }, { status: 400 });
    }
    const ids = body.items.map((x: any) => String(x.product_id));
    if (ids.some((id: string) => !/^[0-9a-f-]{36}$/i.test(id))) {
      return NextResponse.json({ error: "Sample listings cannot be purchased. Add real products in the database first." }, { status: 400 });
    }
    const db = supabaseAdmin();
    const { data: products, error } = await db.from("products")
      .select("id,name,price_pence,stock,active").in("id", ids);
    if (error || !products) throw error || new Error("Products unavailable");
    const line_items = body.items.map((item: { product_id?: string; quantity?: number }) => {
      const p = products.find(x => x.id === item.product_id);
      const qty = Number(item.quantity);
      if (!p || !p.active || !Number.isInteger(qty) || qty < 1 || qty > p.stock) throw new Error("A card is no longer available in that quantity.");
      return { price_data: { currency: "gbp", product_data: { name: p.name }, unit_amount: p.price_pence }, quantity: qty };
    });
    const commissionPence = body.items.reduce((sum: number, item: { product_id?: string; quantity?: number }) => {
      const p = products.find(x => x.id === item.product_id);
      return sum + (p ? commissionOnSale(p.price_pence) * Number(item.quantity) : 0);
    }, 0);
    const salePence = line_items.reduce((sum: number, item: { price_data: { unit_amount: number }; quantity: number }) => sum + item.price_data.unit_amount * item.quantity, 0);
    const buyer = await userFromRequest(req);
    if (!buyer?.email) {
      return NextResponse.json({ error: "Sign in before you check out." }, { status: 401 });
    }
    const stripe = stripeClient();
    const base = process.env.NEXT_PUBLIC_SITE_URL;
    if (!base) throw new Error("Site URL is not configured.");
    const session = await stripe.checkout.sessions.create({
      mode: "payment", line_items,
      customer_email: buyer.email,
      success_url: `${base}/?checkout=success`,
      cancel_url: `${base}/?checkout=cancelled`,
      billing_address_collection: "required",
      shipping_address_collection: { allowed_countries: ["GB"] },
      metadata: {
        product_ids: ids.join(","),
        buyer_id: buyer.id,
        commission_pence: String(commissionPence),
        seller_proceeds_pence: String(salePence - commissionPence)
      }
    });
    return NextResponse.json({ url: session.url });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unable to start checkout.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
