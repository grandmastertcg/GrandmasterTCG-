import { commissionOnSale } from "@/lib/commission";
import { supabaseAdmin } from "@/lib/supabase";
import { stripeClient } from "@/lib/stripe";

export function sellerKey(sellerId: string | null | undefined) {
  return sellerId || "shop";
}

type CheckoutItem = { product_id: string; quantity: number };

type ProductRow = {
  id: string;
  name: string;
  price_pence: number;
  stock: number;
  seller_id: string | null;
  seller_name: string | null;
};

export async function createPendingOrder(input: {
  sessionId: string;
  buyerId: string;
  email: string | null;
  products: ProductRow[];
  items: CheckoutItem[];
  commissionPence: number;
  totalPence: number;
}) {
  const db = supabaseAdmin();
  const existing = await db.from("orders").select("id").eq("stripe_session_id", input.sessionId).maybeSingle();
  if (existing.data?.id) return existing.data.id;

  const { data: order, error } = await db.from("orders").insert({
    stripe_session_id: input.sessionId,
    customer_email: input.email,
    total_pence: input.totalPence,
    commission_pence: input.commissionPence,
    status: "pending",
    buyer_id: input.buyerId
  }).select("id").single();
  if (error || !order) throw new Error(error?.message || "Order could not be saved.");

  const lines = input.items.map((item) => {
    const product = input.products.find((row) => row.id === item.product_id);
    if (!product) throw new Error("A card in this basket no longer exists.");
    const commission = commissionOnSale(product.price_pence) * item.quantity;
    return {
      order_id: order.id,
      product_id: product.id,
      product_name: product.name,
      quantity: item.quantity,
      unit_price_pence: product.price_pence,
      seller_id: product.seller_id,
      seller_name: product.seller_name || "GrandmasterTCG",
      commission_pence: commission,
      lineTotal: product.price_pence * item.quantity
    };
  });

  const { error: itemError } = await db.from("order_items").insert(lines.map(({ lineTotal: _lineTotal, ...row }) => row));
  if (itemError) throw new Error(itemError.message);

  const groups = new Map<string, { sellerId: string | null; sellerName: string; proceeds: number; commission: number }>();
  for (const line of lines) {
    const key = sellerKey(line.seller_id);
    const current = groups.get(key) ?? { sellerId: line.seller_id, sellerName: line.seller_name, proceeds: 0, commission: 0 };
    current.proceeds += line.lineTotal - line.commission_pence;
    current.commission += line.commission_pence;
    groups.set(key, current);
  }

  const shipments = [...groups.entries()].map(([key, group]) => ({
    order_id: order.id,
    seller_key: key,
    seller_id: group.sellerId,
    seller_name: group.sellerName,
    proceeds_pence: group.proceeds,
    commission_pence: group.commission
  }));
  const { error: shipmentError } = await db.from("shipments").insert(shipments);
  if (shipmentError) throw new Error(shipmentError.message);
  return order.id;
}

export async function finalizeCheckout(sessionId: string) {
  const stripe = stripeClient();
  const session = await stripe.checkout.sessions.retrieve(sessionId);
  if (session.payment_status !== "paid") throw new Error("This payment is not complete.");

  const db = supabaseAdmin();
  const { data: order, error } = await db.from("orders").select("id,status,stock_adjusted").eq("stripe_session_id", sessionId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!order) throw new Error("This checkout has no order record.");

  let chargeId: string | null = null;
  if (typeof session.payment_intent === "string") {
    const intent = await stripe.paymentIntents.retrieve(session.payment_intent);
    chargeId = typeof intent.latest_charge === "string" ? intent.latest_charge : intent.latest_charge?.id ?? null;
  }

  const shipping = session.shipping_details;
  if (order.status !== "paid") {
    const { error: updateError } = await db.from("orders").update({
      status: "paid",
      charge_id: chargeId,
      customer_email: session.customer_details?.email ?? session.customer_email,
      shipping_name: shipping?.name ?? null,
      shipping_address: shipping?.address ?? null
    }).eq("id", order.id);
    if (updateError) throw new Error(updateError.message);
  } else if (chargeId) {
    await db.from("orders").update({ charge_id: chargeId }).eq("id", order.id).is("charge_id", null);
  }

  if (!order.stock_adjusted) {
    const { data: items } = await db.from("order_items").select("product_id,quantity").eq("order_id", order.id);
    for (const item of items ?? []) {
      if (!item.product_id) continue;
      const { data: product } = await db.from("products").select("stock").eq("id", item.product_id).maybeSingle();
      if (!product) continue;
      const stock = Math.max(0, product.stock - item.quantity);
      await db.from("products").update({ stock }).eq("id", item.product_id);
    }
    await db.from("orders").update({ stock_adjusted: true }).eq("id", order.id);
  }
}

export async function paySeller(shipmentId: string) {
  const db = supabaseAdmin();
  const { data: shipment, error } = await db.from("shipments").select("id,seller_id,seller_key,proceeds_pence,received_at,transfer_id,order_id").eq("id", shipmentId).maybeSingle();
  if (error || !shipment) throw new Error(error?.message || "Shipment not found.");
  if (!shipment.received_at || shipment.transfer_id || shipment.seller_key === "shop" || shipment.proceeds_pence <= 0) return;

  const { data: account } = await db.from("seller_payout_accounts").select("stripe_account_id").eq("user_id", shipment.seller_id).maybeSingle();
  if (!account) {
    await db.from("shipments").update({ payout_error: "Connect a Stripe payout account to receive this sale." }).eq("id", shipment.id);
    return;
  }

  const { data: order } = await db.from("orders").select("charge_id").eq("id", shipment.order_id).maybeSingle();
  if (!order?.charge_id) throw new Error("The card payment is not ready to transfer yet.");

  const transfer = await stripeClient().transfers.create({
    amount: shipment.proceeds_pence,
    currency: "gbp",
    destination: account.stripe_account_id,
    source_transaction: order.charge_id,
    metadata: { shipment_id: shipment.id }
  }, { idempotencyKey: `shipment_${shipment.id}` });

  await db.from("shipments").update({ transfer_id: transfer.id, payout_error: null }).eq("id", shipment.id);
}
