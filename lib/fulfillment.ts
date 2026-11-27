import { commissionOnBasket, splitCommission } from "@/lib/commission";
import { sendArrivalEmail, sendDeliveredEmail, sendPaidEmail, sendSaleEmails, sendUnpostedRefundEmail } from "@/lib/mail";
import { saleCondition } from "@/lib/catalog";
import { deliveryMoment, lookupTracking, parcelQuote } from "@/lib/shipping";
import { supabaseAdmin } from "@/lib/supabase";
import { stripeClient } from "@/lib/stripe";

export function sellerKey(sellerId: string | null | undefined) {
  return sellerId || "shop";
}

const INSPECTION_MS = 2 * 24 * 60 * 60 * 1000;
const POST_DEADLINE_MS = 5 * 24 * 60 * 60 * 1000;
const RECEIVE_UNDO_MS = 60 * 60 * 1000;
const STALL_ASK_MS = 7 * 24 * 60 * 60 * 1000;
const STALL_QUIET_MS = 2 * 24 * 60 * 60 * 1000;

type DueShipment = {
  id: string;
  received_at: string | null;
  delivered_at: string | null;
  refunded_at?: string | null;
  tracking_number?: string | null;
  shipped_at?: string | null;
  arrival_asked_at?: string | null;
};

function payoutDue(shipment: DueShipment) {
  if (shipment.refunded_at) return false;
  if (shipment.received_at) return Date.now() - new Date(shipment.received_at).getTime() >= RECEIVE_UNDO_MS;
  if (shipment.delivered_at) return Date.now() - new Date(shipment.delivered_at).getTime() >= INSPECTION_MS;
  if (shipment.tracking_number && shipment.arrival_asked_at) {
    return Date.now() - new Date(shipment.arrival_asked_at).getTime() >= STALL_QUIET_MS;
  }
  return false;
}

function holdMessage(kind: string | null) {
  if (kind === "refund") return "Payout is on hold because the buyer requested a refund.";
  if (kind === "unposted") return "Payout is on hold because this parcel was not posted within 5 days.";
  if (kind === "oversold") return "Payout is on hold because the card was no longer in stock when payment finished.";
  return "Payout is on hold because the buyer opened a dispute.";
}

type CheckoutItem = { product_id: string; quantity: number };

type ProductRow = {
  id: string;
  name: string;
  price_pence: number;
  stock: number;
  seller_id: string | null;
  seller_name: string | null;
  postage_size?: string | null;
  condition?: string | null;
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

  const lines = input.items.map((item) => {
    const product = input.products.find((row) => row.id === item.product_id);
    if (!product) throw new Error("A card in this basket no longer exists.");
    return {
      order_id: "",
      product_id: product.id,
      product_name: product.name,
      quantity: item.quantity,
      unit_price_pence: product.price_pence,
      seller_id: product.seller_id,
      seller_name: product.seller_name || "GrandmasterTCG",
      commission_pence: 0,
      lineTotal: product.price_pence * item.quantity
    };
  });
  const basketFee = commissionOnBasket(lines.reduce((sum, line) => sum + line.lineTotal, 0));
  splitCommission(basketFee, lines.map((line) => line.lineTotal)).forEach((share, index) => {
    lines[index].commission_pence = share;
  });

  const { data: order, error } = await db.from("orders").insert({
    stripe_session_id: input.sessionId,
    customer_email: input.email,
    total_pence: input.totalPence,
    commission_pence: basketFee,
    status: "pending",
    buyer_id: input.buyerId
  }).select("id").single();
  if (error || !order) throw new Error(error?.message || "Order could not be saved.");
  for (const line of lines) line.order_id = order.id;

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
  for (const [key, group] of groups) {
    const cards = lines
      .filter((line) => sellerKey(line.seller_id) === key)
      .map((line) => {
        const product = input.products.find((row) => row.id === line.product_id);
        return {
          postageSize: product?.postage_size,
          quantity: line.quantity,
          unitPricePence: line.unit_price_pence,
          graded: saleCondition(product?.condition) == null
        };
      });
    group.proceeds += parcelQuote(cards).pence;
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
  const { data: order, error } = await db.from("orders").select("id,status").eq("stripe_session_id", sessionId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!order) throw new Error("This checkout has no order record.");

  let chargeId: string | null = null;
  if (typeof session.payment_intent === "string") {
    const intent = await stripe.paymentIntents.retrieve(session.payment_intent);
    chargeId = typeof intent.latest_charge === "string" ? intent.latest_charge : intent.latest_charge?.id ?? null;
  }

  const shipping = session.shipping_details;
  const paidAt = new Date().toISOString();
  let justPaid = false;
  if (order.status !== "paid") {
    const { data: updated, error: updateError } = await db.from("orders").update({
      status: "paid",
      charge_id: chargeId,
      customer_email: session.customer_details?.email ?? session.customer_email,
      shipping_name: shipping?.name ?? null,
      shipping_address: shipping?.address ?? null,
      paid_at: paidAt
    }).eq("id", order.id).eq("status", "pending").select("id").maybeSingle();
    if (updateError && /paid_at/.test(updateError.message)) {
      const retry = await db.from("orders").update({
        status: "paid",
        charge_id: chargeId,
        customer_email: session.customer_details?.email ?? session.customer_email,
        shipping_name: shipping?.name ?? null,
        shipping_address: shipping?.address ?? null
      }).eq("id", order.id).eq("status", "pending").select("id").maybeSingle();
      if (retry.error) throw new Error(retry.error.message);
      justPaid = Boolean(retry.data);
    } else if (updateError) {
      throw new Error(updateError.message);
    } else {
      justPaid = Boolean(updated);
    }
  } else if (chargeId) {
    await db.from("orders").update({ charge_id: chargeId }).eq("id", order.id).is("charge_id", null);
  }

  const { data: claimed, error: claimError } = await db.from("orders").update({ stock_adjusted: true }).eq("id", order.id).eq("stock_adjusted", false).select("id").maybeSingle();
  if (claimError) throw new Error(claimError.message);
  if (claimed) await takeOrderStock(order.id);

  await applyStripeFee(order.id);
  if (justPaid) await sendSaleEmails(order.id);
}

export async function paySeller(shipmentId: string) {
  const db = supabaseAdmin();
  const loaded = await db.from("shipments").select("id,seller_id,seller_key,proceeds_pence,stripe_fee_pence,received_at,delivered_at,refunded_at,shipped_at,tracking_number,arrival_asked_at,hold_at,hold_kind,transfer_id,released_at,order_id").eq("id", shipmentId).maybeSingle();
  let shipment = loaded.data;
  let error = loaded.error;
  if (error && /arrival_asked_at/.test(error.message)) {
    const fallback = await db.from("shipments").select("id,seller_id,seller_key,proceeds_pence,stripe_fee_pence,received_at,delivered_at,refunded_at,shipped_at,tracking_number,hold_at,hold_kind,transfer_id,released_at,order_id").eq("id", shipmentId).maybeSingle();
    shipment = fallback.data ? { ...fallback.data, arrival_asked_at: null } : null;
    error = fallback.error;
  }
  if (error || !shipment) throw new Error(error?.message || "Shipment not found.");
  if (shipment.refunded_at || shipment.transfer_id || shipment.released_at) return;
  if (shipment.hold_at) {
    await db.from("shipments").update({ payout_error: holdMessage(shipment.hold_kind) }).eq("id", shipment.id);
    return;
  }
  if (!payoutDue(shipment)) return;
  if (shipment.seller_key === "shop") {
    const { data: released } = await db.from("shipments").update({ released_at: new Date().toISOString(), payout_error: null }).eq("id", shipment.id).is("released_at", null).select("id").maybeSingle();
    if (released) await sendPaidEmail(shipment.id);
    return;
  }
  await applyStripeFee(shipment.order_id);

  const { data: current, error: reloadError } = await db.from("shipments").select("id,seller_id,seller_key,proceeds_pence,stripe_fee_pence,hold_at,hold_kind,transfer_id,released_at").eq("id", shipmentId).maybeSingle();
  if (reloadError || !current) throw new Error(reloadError?.message || "Shipment not found.");
  if (current.transfer_id || current.released_at || current.seller_key === "shop") return;
  if (current.hold_at) {
    await db.from("shipments").update({ payout_error: holdMessage(current.hold_kind) }).eq("id", current.id);
    return;
  }
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

  const { data: paid } = await db.from("shipments").update({ transfer_id: transfer.id, released_at: new Date().toISOString(), payout_error: null }).eq("id", current.id).is("transfer_id", null).select("id").maybeSingle();
  if (paid) await sendPaidEmail(current.id);
}

export async function recordDelivery(shipmentId: string, when: Date) {
  const db = supabaseAdmin();
  const { data, error } = await db.from("shipments").update({ delivered_at: when.toISOString() }).eq("id", shipmentId).is("delivered_at", null).select("id").maybeSingle();
  if (error && !/delivered_at/.test(error.message)) throw new Error(error.message);
  if (data) await sendDeliveredEmail(shipmentId);
}

export async function saveTracking(shipmentId: string, tracking: { status: string; events: { time: string | null; description: string; location: string; status: string }[] }) {
  const db = supabaseAdmin();
  const { error } = await db.from("shipments").update({
    tracking_status: tracking.status,
    tracking_events: tracking.events,
    tracked_at: new Date().toISOString()
  }).eq("id", shipmentId);
  if (error && !/tracking_status|tracking_events|tracked_at/.test(error.message)) throw new Error(error.message);
}

export async function noteDeliveries() {
  const db = supabaseAdmin();
  const { data, error } = await db.from("shipments").select("id,carrier,tracking_number,tracked_at").is("delivered_at", null).is("refunded_at", null).is("transfer_id", null).is("released_at", null).not("tracking_number", "is", null);
  if (error) {
    if (/delivered_at|refunded_at|tracked_at/.test(error.message)) return;
    throw new Error(error.message);
  }
  const fresh = Date.now() - 6 * 60 * 60 * 1000;
  for (const shipment of data ?? []) {
    if (!shipment.tracking_number) continue;
    if (shipment.tracked_at && new Date(shipment.tracked_at).getTime() > fresh) continue;
    const tracking = await lookupTracking(shipment.carrier, shipment.tracking_number);
    if (!tracking) continue;
    await saveTracking(shipment.id, tracking);
    const when = deliveryMoment(tracking);
    if (when) await recordDelivery(shipment.id, when);
  }
}

export async function refundShipment(shipmentId: string) {
  const db = supabaseAdmin();
  const { data: shipment, error } = await db.from("shipments").select("id,seller_key,proceeds_pence,commission_pence,stripe_fee_pence,transfer_id,refunded_at,hold_at,order_id").eq("id", shipmentId).maybeSingle();
  if (error || !shipment) throw new Error(error?.message || "Unknown parcel.");
  if (shipment.refunded_at) return;
  if (!shipment.hold_at) throw new Error("The buyer has not asked for a refund or opened a dispute.");
  await applyStripeFee(shipment.order_id);

  const { data: current, error: reloadError } = await db.from("shipments").select("id,seller_key,proceeds_pence,commission_pence,stripe_fee_pence,transfer_id,refunded_at,order_id").eq("id", shipmentId).maybeSingle();
  if (reloadError || !current) throw new Error(reloadError?.message || "Unknown parcel.");
  if (current.refunded_at) return;
  const gross = current.proceeds_pence + current.commission_pence + (current.stripe_fee_pence ?? 0);
  if (gross <= 0) throw new Error("There is nothing left to refund.");

  const { data: order } = await db.from("orders").select("charge_id").eq("id", current.order_id).maybeSingle();
  if (!order?.charge_id) throw new Error("The card payment is not ready to refund.");
  const stripe = stripeClient();
  if (current.transfer_id && current.seller_key !== "shop" && current.proceeds_pence > 0) {
    await stripe.transfers.createReversal(current.transfer_id, { amount: current.proceeds_pence }, { idempotencyKey: `reversal_${current.id}` });
  }
  const refund = await stripe.refunds.create({
    charge: order.charge_id,
    amount: gross,
    metadata: { shipment_id: current.id }
  }, { idempotencyKey: `refund_${current.id}` });
  const { error: saveError } = await db.from("shipments").update({
    refunded_at: new Date().toISOString(),
    stripe_refund_id: refund.id,
    released_at: new Date().toISOString(),
    payout_error: null
  }).eq("id", current.id);
  if (saveError) throw new Error(saveError.message);
}

export async function releaseHold(shipmentId: string) {
  const db = supabaseAdmin();
  const { data: shipment, error } = await db.from("shipments").select("id,refunded_at,hold_at").eq("id", shipmentId).maybeSingle();
  if (error || !shipment) throw new Error(error?.message || "Unknown parcel.");
  if (shipment.refunded_at) throw new Error("This parcel has already been refunded.");
  if (!shipment.hold_at) return;
  const { error: updateError } = await db.from("shipments").update({
    hold_at: null,
    hold_kind: null,
    hold_reason: null,
    payout_error: null
  }).eq("id", shipmentId);
  if (updateError) throw new Error(updateError.message);
}

function orderStart(order: { created_at?: string | null; paid_at?: string | null } | null) {
  return order?.paid_at || order?.created_at || null;
}

export async function holdUnpostedSales() {
  const db = supabaseAdmin();
  const cutoff = Date.now() - POST_DEADLINE_MS;
  const first = await db.from("shipments").select("id,orders!inner(status,created_at,paid_at)").is("tracking_number", null).is("hold_at", null).is("refunded_at", null).is("transfer_id", null).is("released_at", null).eq("orders.status", "paid");
  const due: { id: string; started: string }[] = [];
  if (first.error && /paid_at/.test(first.error.message)) {
    const fallback = await db.from("shipments").select("id,orders!inner(status,created_at)").is("tracking_number", null).is("hold_at", null).is("refunded_at", null).is("transfer_id", null).is("released_at", null).eq("orders.status", "paid");
    if (fallback.error) {
      if (/hold_at|refunded_at|released_at/.test(fallback.error.message)) return;
      throw new Error(fallback.error.message);
    }
    for (const shipment of fallback.data ?? []) {
      const order = Array.isArray(shipment.orders) ? shipment.orders[0] : shipment.orders;
      const started = orderStart(order);
      if (started) due.push({ id: shipment.id, started });
    }
  } else if (first.error) {
    if (/hold_at|refunded_at|released_at/.test(first.error.message)) return;
    throw new Error(first.error.message);
  } else {
    for (const shipment of first.data ?? []) {
      const order = Array.isArray(shipment.orders) ? shipment.orders[0] : shipment.orders;
      const started = orderStart(order);
      if (started) due.push({ id: shipment.id, started });
    }
  }
  for (const shipment of due) {
    if (new Date(shipment.started).getTime() > cutoff) continue;
    const { data: held, error: holdError } = await db.from("shipments").update({
      hold_kind: "unposted",
      hold_reason: "No tracking number was added within 5 days of payment.",
      hold_at: new Date().toISOString(),
      payout_error: holdMessage("unposted")
    }).eq("id", shipment.id).is("tracking_number", null).is("hold_at", null).select("id").maybeSingle();
    if (holdError || !held) continue;
    await refundUnpostedParcel(held.id);
  }
}

async function refundHeldParcel(shipmentId: string, emailed: (shipmentId: string) => Promise<void>) {
  const db = supabaseAdmin();
  try {
    await refundShipment(shipmentId);
  } catch (failure) {
    const message = failure instanceof Error ? failure.message : "The refund could not be sent yet.";
    await db.from("shipments").update({ payout_error: message }).eq("id", shipmentId);
    return;
  }
  try {
    await emailed(shipmentId);
  } catch {
    // The refund has already been sent.
  }
}

async function refundUnpostedParcel(shipmentId: string) {
  await refundHeldParcel(shipmentId, sendUnpostedRefundEmail);
}

async function refundUnpostedParcels() {
  const db = supabaseAdmin();
  const { data, error } = await db.from("shipments").select("id").eq("hold_kind", "unposted").is("tracking_number", null).is("refunded_at", null);
  if (error) {
    if (/hold_kind|refunded_at/.test(error.message)) return;
    throw new Error(error.message);
  }
  for (const shipment of data ?? []) await refundUnpostedParcel(shipment.id);
}

const DUE_COLUMNS = "id,received_at,delivered_at,refunded_at,tracking_number,shipped_at,arrival_asked_at";
const DUE_COLUMNS_FALLBACK = "id,received_at,delivered_at,refunded_at,tracking_number,shipped_at";

async function selectUnpaid(filter: (columns: string) => PromiseLike<{ data: DueShipment[] | null; error: { message: string } | null }>) {
  const first = await filter(DUE_COLUMNS);
  if (first.error && /arrival_asked_at/.test(first.error.message)) {
    const second = await filter(DUE_COLUMNS_FALLBACK);
    if (second.error) return { data: null, error: second.error };
    return { data: (second.data ?? []).map((row) => ({ ...row, arrival_asked_at: null })), error: null };
  }
  return { data: first.data, error: first.error };
}

async function payDueShipments(rows: DueShipment[] | null) {
  const db = supabaseAdmin();
  for (const shipment of rows ?? []) {
    if (!payoutDue(shipment)) continue;
    try {
      await paySeller(shipment.id);
    } catch (failure) {
      const message = failure instanceof Error ? failure.message : "Stripe could not pay the seller yet.";
      await db.from("shipments").update({ payout_error: message }).eq("id", shipment.id);
    }
  }
}

export async function releaseSellerPayouts(sellerId: string) {
  const db = supabaseAdmin();
  const { data, error } = await selectUnpaid((columns) => db.from("shipments").select(columns).eq("seller_id", sellerId).is("transfer_id", null).is("released_at", null).is("hold_at", null).is("refunded_at", null) as PromiseLike<{ data: DueShipment[] | null; error: { message: string } | null }>);
  if (error) {
    if (/released_at|hold_at|delivered_at|refunded_at/.test(error.message)) return;
    throw new Error(error.message);
  }
  await payDueShipments(data);
}

async function releaseBuyerPayouts(buyerId: string) {
  const db = supabaseAdmin();
  const buyerColumns = (columns: string) => columns.includes("arrival_asked_at")
    ? "id,received_at,delivered_at,refunded_at,tracking_number,shipped_at,arrival_asked_at,orders!inner(buyer_id)"
    : "id,received_at,delivered_at,refunded_at,tracking_number,shipped_at,orders!inner(buyer_id)";
  const { data, error } = await selectUnpaid((columns) => db.from("shipments").select(buyerColumns(columns)).eq("orders.buyer_id", buyerId).is("transfer_id", null).is("released_at", null).is("hold_at", null).is("refunded_at", null) as PromiseLike<{ data: DueShipment[] | null; error: { message: string } | null }>);
  if (error) {
    if (/released_at|hold_at|delivered_at|refunded_at/.test(error.message)) return;
    throw new Error(error.message);
  }
  await payDueShipments(data);
}

export async function settleAccountPayouts(userId: string) {
  try {
    await releaseSellerPayouts(userId);
    await releaseBuyerPayouts(userId);
  } catch {
    // One seller's payout must not stop the account page loading.
  }
}

async function askStalledParcels() {
  const db = supabaseAdmin();
  const { data, error } = await db.from("shipments").select("id,shipped_at,tracking_number").not("tracking_number", "is", null).is("delivered_at", null).is("received_at", null).is("arrival_asked_at", null).is("hold_at", null).is("refunded_at", null).is("transfer_id", null).is("released_at", null);
  if (error) {
    if (/arrival_asked_at|delivered_at|received_at|hold_at|refunded_at|released_at/.test(error.message)) return;
    throw new Error(error.message);
  }
  const cutoff = Date.now() - STALL_ASK_MS;
  for (const shipment of data ?? []) {
    if (!shipment.shipped_at || new Date(shipment.shipped_at).getTime() > cutoff) continue;
    const askedAt = new Date().toISOString();
    const { data: saved, error: saveError } = await db.from("shipments").update({ arrival_asked_at: askedAt }).eq("id", shipment.id).is("arrival_asked_at", null).is("delivered_at", null).is("received_at", null).select("id").maybeSingle();
    if (saveError || !saved) continue;
    await sendArrivalEmail(shipment.id);
  }
}

export async function releaseDuePayouts() {
  try {
    await refundOversoldParcels();
    await refundUnpostedParcels();
  } catch {
    // A missed refund must not stop payouts that are already due.
  }
  try {
    await holdUnpostedSales();
  } catch {
    // A missed hold must not stop payouts that are already due.
  }
  try {
    await noteDeliveries();
  } catch {
    // A courier lookup can fail. Buyer confirmation can still pay the seller.
  }
  try {
    await askStalledParcels();
  } catch {
    // A missed arrival email must not stop payouts that are already due.
  }
  const db = supabaseAdmin();
  const { data, error } = await selectUnpaid((columns) => db.from("shipments").select(columns).is("transfer_id", null).is("released_at", null).is("hold_at", null).is("refunded_at", null) as PromiseLike<{ data: DueShipment[] | null; error: { message: string } | null }>);
  if (error) {
    if (/released_at|hold_at|delivered_at|refunded_at/.test(error.message)) return;
    throw new Error(error.message);
  }
  await payDueShipments(data);
}

async function takeStock(productId: string, quantity: number) {
  const db = supabaseAdmin();
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const { data: product, error } = await db.from("products").select("stock").eq("id", productId).maybeSingle();
    if (error) throw new Error(error.message);
    if (!product || product.stock < quantity) return false;
    const { data: taken, error: updateError } = await db.from("products").update({ stock: product.stock - quantity }).eq("id", productId).eq("stock", product.stock).select("id").maybeSingle();
    if (updateError) throw new Error(updateError.message);
    if (taken) return true;
  }
  return false;
}

async function restoreStock(productId: string, quantity: number) {
  const db = supabaseAdmin();
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const { data: product, error } = await db.from("products").select("stock").eq("id", productId).maybeSingle();
    if (error) throw new Error(error.message);
    if (!product) return;
    const { data: restored, error: updateError } = await db.from("products").update({ stock: product.stock + quantity }).eq("id", productId).eq("stock", product.stock).select("id").maybeSingle();
    if (updateError) throw new Error(updateError.message);
    if (restored) return;
  }
}

async function takeOrderStock(orderId: string) {
  const db = supabaseAdmin();
  const { data: items, error } = await db.from("order_items").select("product_id,quantity,seller_id").eq("order_id", orderId);
  if (error) throw new Error(error.message);
  const groups = new Map<string, { productId: string; quantity: number }[]>();
  for (const item of items ?? []) {
    if (!item.product_id) continue;
    const key = sellerKey(item.seller_id);
    const lines = groups.get(key) ?? [];
    lines.push({ productId: item.product_id, quantity: item.quantity });
    groups.set(key, lines);
  }
  for (const [key, lines] of groups) {
    const taken: { productId: string; quantity: number }[] = [];
    let short = false;
    for (const line of lines) {
      const ok = await takeStock(line.productId, line.quantity);
      if (!ok) {
        short = true;
        break;
      }
      taken.push(line);
    }
    if (!short) continue;
    for (const line of taken) await restoreStock(line.productId, line.quantity);
    const { data: shipment, error: holdError } = await db.from("shipments").update({
      hold_kind: "oversold",
      hold_reason: "This card sold out before the payment finished.",
      hold_at: new Date().toISOString(),
      payout_error: holdMessage("oversold")
    }).eq("order_id", orderId).eq("seller_key", key).is("hold_at", null).is("transfer_id", null).is("released_at", null).select("id").maybeSingle();
    if (holdError) throw new Error(holdError.message);
    if (shipment) await refundOversoldParcel(shipment.id);
  }
}

async function refundOversoldParcel(shipmentId: string) {
  await refundHeldParcel(shipmentId, async () => {});
}

async function refundOversoldParcels() {
  const db = supabaseAdmin();
  const { data, error } = await db.from("shipments").select("id").eq("hold_kind", "oversold").is("refunded_at", null);
  if (error) {
    if (/hold_kind|refunded_at/.test(error.message)) return;
    throw new Error(error.message);
  }
  for (const shipment of data ?? []) await refundOversoldParcel(shipment.id);
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
