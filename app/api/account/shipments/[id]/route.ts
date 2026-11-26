import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { userFromRequest } from "@/lib/require-user";
import { CARRIERS, carrierTrackUrl, deliveryMoment, lookupTracking, validTracking } from "@/lib/shipping";
import { recordDelivery, saveTracking } from "@/lib/fulfillment";
import { sendHoldEmail, sendTrackingEmail } from "@/lib/mail";

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const user = await userFromRequest(request);
  if (!user) return NextResponse.json({ error: "Please sign in." }, { status: 401 });

  const { id } = await context.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "Unknown parcel." }, { status: 400 });

  const db = supabaseAdmin();
  const { data: admin } = await db.from("admin_users").select("user_id").eq("user_id", user.id).maybeSingle();
  const { data: shipment } = await db.from("shipments").select("id,order_id,seller_key,seller_id,seller_name,carrier,tracking_number,shipped_at,received_at,tracking_status,tracking_events,orders!inner(buyer_id,status,shipping_name,shipping_address)").eq("id", id).maybeSingle();
  if (!shipment) return NextResponse.json({ error: "Unknown parcel." }, { status: 404 });

  const order = Array.isArray(shipment.orders) ? shipment.orders[0] : shipment.orders;
  if (order?.status !== "paid") return NextResponse.json({ error: "This order is not paid yet." }, { status: 400 });
  const isSeller = shipment.seller_id === user.id || (shipment.seller_key === "shop" && Boolean(admin));
  const isBuyer = order?.buyer_id === user.id;
  if (!isSeller && !isBuyer) return NextResponse.json({ error: "You cannot view this parcel." }, { status: 403 });
  if (!shipment.tracking_number) return NextResponse.json({ error: "This parcel has no tracking number yet." }, { status: 400 });

  const { data: items } = await db.from("order_items").select("product_name,quantity,seller_id").eq("order_id", shipment.order_id);
  const related = (items ?? []).filter((item) => (item.seller_id ?? "shop") === (shipment.seller_id ?? "shop"));
  const address = order?.shipping_address as { line1?: string; line2?: string; city?: string; postal_code?: string; country?: string } | null;
  const shipTo = [order?.shipping_name, address?.line1, address?.line2, address?.city, address?.postal_code, address?.country].filter(Boolean).join(", ");
  const tracking = await lookupTracking(shipment.carrier, shipment.tracking_number);
  if (tracking) await saveTracking(shipment.id, tracking);
  const delivered = deliveryMoment(tracking);
  if (delivered) await recordDelivery(shipment.id, delivered);
  const stored = Array.isArray(shipment.tracking_events) ? shipment.tracking_events : [];

  return NextResponse.json({
    id: shipment.id,
    role: isSeller ? "sale" : "purchase",
    sellerName: shipment.seller_name || "GrandmasterTCG",
    shipTo: isSeller ? shipTo : "",
    carrier: shipment.carrier,
    trackingNumber: shipment.tracking_number,
    shippedAt: shipment.shipped_at,
    receivedAt: shipment.received_at,
    courierUrl: carrierTrackUrl(shipment.carrier, shipment.tracking_number),
    status: tracking?.status || shipment.tracking_status || "",
    events: tracking?.events?.length ? tracking.events : stored,
    items: related.map((item) => ({ name: item.product_name, quantity: item.quantity }))
  });
}

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const user = await userFromRequest(request);
  if (!user) return NextResponse.json({ error: "Please sign in." }, { status: 401 });

  const { id } = await context.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "Unknown parcel." }, { status: 400 });

  const body = await request.json();
  const action = String(body.action ?? "");
  const db = supabaseAdmin();
  const { data: shipment } = await db.from("shipments").select("id,seller_id,seller_key,received_at,refunded_at,transfer_id,released_at,order_id").eq("id", id).maybeSingle();
  if (!shipment) return NextResponse.json({ error: "Unknown parcel." }, { status: 404 });

  const { data: order } = await db.from("orders").select("buyer_id,status").eq("id", shipment.order_id).maybeSingle();
  if (order?.status !== "paid") return NextResponse.json({ error: "This order is not paid yet." }, { status: 400 });

  if (action === "ship") {
    const { data: admin } = await db.from("admin_users").select("user_id").eq("user_id", user.id).maybeSingle();
    const ownsSale = shipment.seller_id === user.id || (shipment.seller_key === "shop" && Boolean(admin));
    if (!ownsSale) return NextResponse.json({ error: "You can only ship your own sales." }, { status: 403 });
    if (shipment.refunded_at) return NextResponse.json({ error: "This parcel has been refunded." }, { status: 400 });
    if (shipment.received_at) return NextResponse.json({ error: "This parcel has already been received." }, { status: 400 });

    const carrier = String(body.carrier ?? "");
    const trackingNumber = String(body.trackingNumber ?? "").trim();
    if (!CARRIERS.includes(carrier as (typeof CARRIERS)[number])) {
      return NextResponse.json({ error: "Choose a courier." }, { status: 400 });
    }
    if (!validTracking(trackingNumber)) {
      return NextResponse.json({ error: "Enter a tracking number. Every parcel must be tracked." }, { status: 400 });
    }

    const { data: before } = await db.from("shipments").select("tracking_number,shipped_at").eq("id", id).maybeSingle();
    const numberChanged = Boolean(before?.tracking_number && before.tracking_number !== trackingNumber);
    const update: {
      carrier: string;
      tracking_number: string;
      shipped_at: string;
      tracking_status?: null;
      tracking_events?: null;
      tracked_at?: null;
      delivered_at?: null;
    } = {
      carrier,
      tracking_number: trackingNumber,
      shipped_at: before?.shipped_at ?? new Date().toISOString()
    };
    if (numberChanged) {
      update.tracking_status = null;
      update.tracking_events = null;
      update.tracked_at = null;
      if (!shipment.transfer_id && !shipment.released_at) update.delivered_at = null;
    }
    const { error } = await db.from("shipments").update(update).eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!before?.tracking_number) await sendTrackingEmail(id);
    return NextResponse.json({ ok: true });
  }

  if (action === "hold") {
    if (order?.buyer_id !== user.id) return NextResponse.json({ error: "Only the buyer can open a dispute or request a refund." }, { status: 403 });
    const kind = body.kind === "refund" ? "refund" : body.kind === "dispute" ? "dispute" : "";
    if (!kind) return NextResponse.json({ error: "Choose a dispute or a refund." }, { status: 400 });
    const reason = String(body.reason ?? "").trim();
    if (reason.length < 8 || reason.length > 500) {
      return NextResponse.json({ error: "Explain the problem in a short message." }, { status: 400 });
    }
    const { data: current } = await db.from("shipments").select("transfer_id,released_at,hold_at").eq("id", id).maybeSingle();
    if (current?.transfer_id || current?.released_at) return NextResponse.json({ error: "The seller has already been paid." }, { status: 400 });
    if (current?.hold_at) return NextResponse.json({ error: "This parcel is already on hold." }, { status: 400 });
    const message = kind === "refund"
      ? "Payout is on hold because the buyer requested a refund."
      : "Payout is on hold because the buyer opened a dispute.";
    const { error } = await db.from("shipments").update({
      hold_kind: kind,
      hold_reason: reason,
      hold_at: new Date().toISOString(),
      payout_error: message
    }).eq("id", id).is("transfer_id", null).is("hold_at", null);
    if (error) {
      if (/hold_at|hold_kind|hold_reason/.test(error.message)) {
        return NextResponse.json({ error: "Disputes and refunds are not enabled in the database yet." }, { status: 500 });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    await sendHoldEmail(id);
    return NextResponse.json({
      ok: true,
      message: kind === "refund" ? "Refund requested. The seller will not be paid while this is open." : "Dispute opened. The seller will not be paid while this is open."
    });
  }

  if (action === "receive") {
    if (order?.buyer_id !== user.id) return NextResponse.json({ error: "Only the buyer can confirm delivery." }, { status: 403 });
    const { data: current } = await db.from("shipments").select("tracking_number,received_at,hold_at").eq("id", id).maybeSingle();
    if (!current?.tracking_number) return NextResponse.json({ error: "This parcel has no tracking number yet." }, { status: 400 });
    if (current.hold_at) return NextResponse.json({ error: "This parcel is on hold. Close the dispute or refund before confirming delivery." }, { status: 400 });
    if (!current.received_at) {
      const { error } = await db.from("shipments").update({ received_at: new Date().toISOString() }).eq("id", id).is("received_at", null);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({
      ok: true,
      message: "Marked as received. You can undo this for an hour. The seller is paid after that."
    });
  }

  if (action === "undo") {
    if (order?.buyer_id !== user.id) return NextResponse.json({ error: "Only the buyer can undo this." }, { status: 403 });
    const { data: current } = await db.from("shipments").select("received_at,transfer_id,released_at").eq("id", id).maybeSingle();
    if (!current?.received_at) return NextResponse.json({ error: "This parcel is not marked as received." }, { status: 400 });
    if (current.transfer_id || current.released_at) return NextResponse.json({ error: "The seller has already been paid." }, { status: 400 });
    if (Date.now() - new Date(current.received_at).getTime() >= 60 * 60 * 1000) {
      return NextResponse.json({ error: "The hour to undo this has passed." }, { status: 400 });
    }
    const { error } = await db.from("shipments").update({ received_at: null }).eq("id", id).is("transfer_id", null).is("released_at", null);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, message: "Confirmation removed. The seller has not been paid." });
  }

  return NextResponse.json({ error: "Unknown action." }, { status: 400 });
}
