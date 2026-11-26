import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { userFromRequest } from "@/lib/require-user";
import { settleAccountPayouts } from "@/lib/fulfillment";

export async function GET(request: NextRequest) {
  const user = await userFromRequest(request);
  if (!user) return NextResponse.json({ error: "Please sign in." }, { status: 401 });

  const db = supabaseAdmin();
  const { data: admin } = await db.from("admin_users").select("user_id").eq("user_id", user.id).maybeSingle();
  const { data: payout } = await db.from("seller_payout_accounts").select("stripe_account_id").eq("user_id", user.id).maybeSingle();
  await settleAccountPayouts(user.id);

  const columns = "id,order_id,seller_key,seller_id,seller_name,carrier,tracking_number,shipped_at,received_at,delivered_at,refunded_at,arrival_asked_at,hold_kind,hold_reason,hold_at,proceeds_pence,commission_pence,stripe_fee_pence,transfer_id,released_at,payout_error,created_at,orders!inner(id,buyer_id,status,created_at,shipping_name,shipping_address)";
  const loaded = await db.from("shipments").select(columns).eq("orders.status", "paid").order("created_at", { ascending: false });
  const fallback = loaded.error && /arrival_asked_at/.test(loaded.error.message)
    ? await db.from("shipments").select(columns.replace(",arrival_asked_at", "")).eq("orders.status", "paid").order("created_at", { ascending: false })
    : loaded;
  const shipments = (fallback.data ?? []) as any[];
  const error = fallback.error;
  if (error) {
    if (/hold_at|hold_kind|released_at|delivered_at|refunded_at/.test(error.message)) {
      return NextResponse.json({ error: "Payout holds are not enabled in the database yet." }, { status: 500 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const orderIds = [...new Set(shipments.map((shipment) => shipment.order_id))];
  const { data: items } = orderIds.length
    ? await db.from("order_items").select("order_id,seller_id,product_name,quantity").in("order_id", orderIds)
    : { data: [] };

  const view = shipments.flatMap((shipment) => {
    const order = Array.isArray(shipment.orders) ? shipment.orders[0] : shipment.orders;
    const isSeller = shipment.seller_id === user.id || (shipment.seller_key === "shop" && Boolean(admin));
    const isBuyer = order?.buyer_id === user.id;
    if (!isSeller && !isBuyer) return [];
    const related = (items ?? []).filter((item) => item.order_id === shipment.order_id && (item.seller_id ?? "shop") === (shipment.seller_id ?? "shop"));
    const address = order?.shipping_address as { line1?: string; line2?: string; city?: string; postal_code?: string; country?: string } | null;
    const shipTo = [order?.shipping_name, address?.line1, address?.line2, address?.city, address?.postal_code, address?.country].filter(Boolean).join(", ");
    return [{
      id: shipment.id,
      role: isSeller ? "sale" : "purchase",
      sellerName: shipment.seller_name || "GrandmasterTCG",
      shipTo: isSeller ? shipTo : "",
      carrier: shipment.carrier,
      trackingNumber: shipment.tracking_number,
      shippedAt: shipment.shipped_at,
      receivedAt: shipment.received_at,
      deliveredAt: shipment.delivered_at,
      arrivalAskedAt: shipment.arrival_asked_at ?? null,
      refundedAt: shipment.refunded_at,
      holdKind: shipment.hold_kind,
      holdReason: shipment.hold_reason,
      proceedsPence: shipment.proceeds_pence,
      commissionPence: shipment.commission_pence,
      stripeFeePence: shipment.stripe_fee_pence ?? 0,
      paid: Boolean(shipment.transfer_id) || (shipment.seller_key === "shop" && Boolean(shipment.released_at)),
      payoutError: shipment.payout_error,
      createdAt: order?.created_at ?? shipment.created_at,
      items: related.map((item) => ({ name: item.product_name, quantity: item.quantity }))
    }];
  });

  return NextResponse.json({
    payoutsConnected: Boolean(payout),
    sales: view.filter((shipment) => shipment.role === "sale"),
    purchases: view.filter((shipment) => shipment.role === "purchase")
  });
}
