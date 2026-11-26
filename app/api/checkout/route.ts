import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { stripeClient } from "@/lib/stripe";
import { userFromRequest } from "@/lib/require-user";
import { commissionOnSale } from "@/lib/commission";
import { createPendingOrder, sellerKey } from "@/lib/fulfillment";
import { parcelQuote, postageSize, type ParcelCard } from "@/lib/shipping";
import { saleCondition } from "@/lib/catalog";

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
    const buyer = await userFromRequest(req);
    if (!buyer?.email) {
      return NextResponse.json({ error: "Sign in before you check out." }, { status: 401 });
    }
    const db = supabaseAdmin();
    const loaded = await db.from("products")
      .select("id,name,condition,price_pence,stock,active,seller_id,seller_name,postage_size").in("id", ids);
    const fallback = loaded.error && /postage_size/.test(loaded.error.message)
      ? await db.from("products").select("id,name,condition,price_pence,stock,active,seller_id,seller_name").in("id", ids)
      : null;
    const source = fallback ?? loaded;
    if (source.error || !source.data) throw source.error || new Error("Products unavailable");
    const products: Array<{ id: string; name: string; condition: string; price_pence: number; stock: number; active: boolean; seller_id: string | null; seller_name: string | null; postage_size: string | null }> = source.data.map((product) => ({
      id: product.id,
      name: product.name,
      condition: product.condition,
      price_pence: product.price_pence,
      stock: product.stock,
      active: product.active,
      seller_id: product.seller_id,
      seller_name: product.seller_name,
      postage_size: "postage_size" in product && typeof product.postage_size === "string" ? product.postage_size : null
    }));
    if (products.some((product) => product.seller_id === buyer.id)) {
      return NextResponse.json({ error: "You cannot buy a card you listed." }, { status: 400 });
    }
    const cardItems = body.items.map((item: { product_id?: string; quantity?: number }) => {
      const p = products.find(x => x.id === item.product_id);
      const qty = Number(item.quantity);
      if (!p || !p.active || !Number.isInteger(qty) || qty < 1 || qty > p.stock) throw new Error("A card is no longer available in that quantity.");
      return { price_data: { currency: "gbp", product_data: { name: `${p.name} (${p.condition})` }, unit_amount: p.price_pence }, quantity: qty, sellerKey: sellerKey(p.seller_id), sellerName: p.seller_name || "GrandmasterTCG", postageSize: postageSize(p.postage_size).id, graded: saleCondition(p.condition) == null };
    });
    const postageGroups = new Map<string, { sellerName: string; cards: ParcelCard[] }>();
    for (const item of cardItems) {
      const current = postageGroups.get(item.sellerKey) ?? { sellerName: item.sellerName, cards: [] as ParcelCard[] };
      current.cards.push({ postageSize: item.postageSize, quantity: item.quantity, unitPricePence: item.price_data.unit_amount, graded: item.graded });
      postageGroups.set(item.sellerKey, current);
    }
    const postageItems = [...postageGroups.values()].map((group) => {
      const quote = parcelQuote(group.cards);
      const service = quote.insured ? "Special Delivery" : "tracked postage";
      return {
        price_data: { currency: "gbp", product_data: { name: `UK ${service} from ${group.sellerName} (${quote.label})` }, unit_amount: quote.pence },
        quantity: 1
      };
    });
    const line_items = [
      ...cardItems.map((item: { price_data: { currency: string; product_data: { name: string }; unit_amount: number }; quantity: number }) => ({ price_data: item.price_data, quantity: item.quantity })),
      ...postageItems
    ];
    const commissionPence = body.items.reduce((sum: number, item: { product_id?: string; quantity?: number }) => {
      const p = products.find(x => x.id === item.product_id);
      return sum + (p ? commissionOnSale(p.price_pence) * Number(item.quantity) : 0);
    }, 0);
    const salePence = cardItems.reduce((sum: number, item: { price_data: { unit_amount: number }; quantity: number }) => sum + item.price_data.unit_amount * item.quantity, 0);
    const postagePence = postageItems.reduce((sum, item) => sum + item.price_data.unit_amount, 0);
    const stripe = stripeClient();
    const base = process.env.NEXT_PUBLIC_SITE_URL;
    if (!base) throw new Error("Site URL is not configured.");
    const session = await stripe.checkout.sessions.create({
      mode: "payment", line_items,
      customer_email: buyer.email,
      payment_intent_data: { receipt_email: buyer.email },
      success_url: `${base}/account?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${base}/?checkout=cancelled`,
      billing_address_collection: "required",
      shipping_address_collection: { allowed_countries: ["GB"] },
      metadata: {
        product_ids: ids.join(","),
        buyer_id: buyer.id,
        commission_pence: String(commissionPence),
        seller_proceeds_pence: String(salePence - commissionPence + postagePence)
      }
    });
    const quantities = body.items.map((item: { product_id?: string; quantity?: number }) => ({
      product_id: String(item.product_id),
      quantity: Number(item.quantity)
    }));
    await createPendingOrder({
      sessionId: session.id,
      buyerId: buyer.id,
      email: buyer.email,
      products,
      items: quantities,
      commissionPence,
      totalPence: salePence + postagePence
    });
    return NextResponse.json({ url: session.url });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unable to start checkout.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
