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

  await applyStripeFee(order.id);
}

export async function paySeller(shipmentId: string) {
  const db = supabaseAdmin();
  const { data: shipment, error } = await db.from("shipments").select("id,seller_id,seller_key,proceeds_pence,stripe_fee_pence,received_at,transfer_id,order_id").eq("id", shipmentId).maybeSingle();
  if (error || !shipment) throw new Error(error?.message || "Shipment not found.");
  if (!shipment.received_at || shipment.transfer_id || shipment.seller_key === "shop") return;
  await applyStripeFee(shipment.order_id);

  const { data: current, error: reloadError } = await db.from("shipments").select("id,seller_id,seller_key,proceeds_pence,stripe_fee_pence,transfer_id").eq("id", shipmentId).maybeSingle();
  if (reloadError || !current) throw new Error(reloadError?.message || "Shipment not found.");
  if (current.transfer_id || current.seller_key === "shop") return;
  if (current.proceeds_pence <= 0) {
    if ((current.stripe_fee_pence ?? 0) > 0) {
      await db.from("shipments").update({ payout_error: "The card processing fee used this payout." }).eq("id", current.id);
    }
    return;
  }

  const { data: account } = await db.from("seller_payout_accounts").select("stripe_account_id").eq("user_id", current.seller_id).maybeSingle();
  if (!account) {
    await db.from("shipments").update({ payout_error: "Connect a Stripe payout account to receive this sale." }).eq("id", current.id);
    return;
  }

  const { data: order } = await db.from("orders").select("charge_id").eq("id", shipment.order_id).maybeSingle();
  if (!order?.charge_id) throw new Error("The card payment is not ready to transfer yet.");

  const transfer = await stripeClient().transfers.create({
    amount: current.proceeds_pence,
    currency: "gbp",
    destination: account.stripe_account_id,
    source_transaction: order.charge_id,
    metadata: { shipment_id: current.id }
  }, { idempotencyKey: `shipment_${current.id}` });

  await db.from("shipments").update({ transfer_id: transfer.id, payout_error: null }).eq("id", current.id);
}

function splitPence(total: number, weights: number[]) {
  const sum = weights.reduce((totalWeight, weight) => totalWeight + weight, 0);
  if (sum <= 0 || total <= 0) return weights.map(() => 0);
  const exact = weights.map((weight) => (total * weight) / sum);
  const shares = exact.map((value) => Math.floor(value));
  let left = total - shares.reduce((totalShare, share) => totalShare + share, 0);
  const remainders = exact.map((value, index) => ({ index, fraction: value - Math.floor(value) }));
  remainders.sort((leftShare, rightShare) => rightShare.fraction - leftShare.fraction);
  for (const remainder of remainders) {
    if (left <= 0) break;
    shares[remainder.index] += 1;
    left -= 1;
  }
  return shares;
}

async function applyStripeFee(orderId: string) {
  const db = supabaseAdmin();
  const { data: order, error } = await db.from("orders").select("id,charge_id,stripe_fee_pence,total_pence").eq("id", orderId).maybeSingle();
  if (error) {
    if (/stripe_fee_pence/.test(error.message)) return;
    throw new Error(error.message);
  }
  if (!order?.charge_id) return;

  let fee = order.stripe_fee_pence;
  if (fee == null) {
    const charge = await stripeClient().charges.retrieve(order.charge_id, { expand: ["balance_transaction"] });
    const balance = charge.balance_transaction;
    if (!balance || typeof balance === "string") return;
    fee = balance.fee;
    const { data: saved } = await db.from("orders").update({ stripe_fee_pence: fee }).eq("id", order.id).is("stripe_fee_pence", null).select("stripe_fee_pence").maybeSingle();
    if (!saved) {
      const { data: existing } = await db.from("orders").select("stripe_fee_pence").eq("id", order.id).maybeSingle();
      fee = existing?.stripe_fee_pence ?? fee;
    }
  }
  if (fee == null) return;

  const { data: shipments, error: shipmentError } = await db.from("shipments").select("id,proceeds_pence,commission_pence,stripe_fee_pence").eq("order_id", order.id);
  if (shipmentError) {
    if (/stripe_fee_pence/.test(shipmentError.message)) return;
    throw new Error(shipmentError.message);
  }
  const pending = (shipments ?? []).filter((shipment) => shipment.stripe_fee_pence == null);
  if (!pending.length) return;

  const weights = (shipments ?? []).map((shipment) => shipment.proceeds_pence + shipment.commission_pence);
  const shares = splitPence(fee, weights);
  for (const [index, shipment] of (shipments ?? []).entries()) {
    if (shipment.stripe_fee_pence != null) continue;
    const share = Math.min(shares[index] ?? 0, shipment.proceeds_pence);
    await db.from("shipments").update({
      stripe_fee_pence: share,
      proceeds_pence: shipment.proceeds_pence - share
    }).eq("id", shipment.id).is("stripe_fee_pence", null);
  }
}
