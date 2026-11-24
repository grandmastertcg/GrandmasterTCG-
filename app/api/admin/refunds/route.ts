import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { userFromRequest } from "@/lib/require-user";
import { holdUnpostedSales } from "@/lib/fulfillment";

async function requireAdmin(request: NextRequest) {
  const user = await userFromRequest(request);
  if (!user) return null;
  const { data } = await supabaseAdmin().from("admin_users").select("user_id").eq("user_id", user.id).maybeSingle();
  return data ? user : null;
}

export async function GET(request: NextRequest) {
  const admin = await requireAdmin(request);
  if (!admin) return NextResponse.json({ error: "Please sign in as the shop." }, { status: 401 });

  try {
    await holdUnpostedSales();
  } catch {
    // The list below still shows holds that were saved earlier.
  }
  const db = supabaseAdmin();
  const { data: shipments, error } = await db.from("shipments").select("id,seller_id,seller_name,hold_kind,hold_reason,hold_at,proceeds_pence,commission_pence,stripe_fee_pence,carrier,tracking_number,order_id,orders!inner(customer_email,status)").not("hold_at", "is", null).is("refunded_at", null).eq("orders.status", "paid").order("hold_at", { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const orderIds = [...new Set((shipments ?? []).map((shipment) => shipment.order_id))];
  const { data: items } = orderIds.length
    ? await db.from("order_items").select("order_id,seller_id,product_name,quantity")
    : { data: [] };

  return NextResponse.json({
    requests: (shipments ?? []).map((shipment) => {
      const order = Array.isArray(shipment.orders) ? shipment.orders[0] : shipment.orders;
      const related = (items ?? []).filter((item) => item.order_id === shipment.order_id && (item.seller_id ?? "shop") === (shipment.seller_id ?? "shop"));
      return {
        id: shipment.id,
        sellerName: shipment.seller_name || "GrandmasterTCG",
        email: order?.customer_email ?? null,
        kind: shipment.hold_kind,
        reason: shipment.hold_reason,
        askedAt: shipment.hold_at,
        carrier: shipment.carrier,
        trackingNumber: shipment.tracking_number,
        refundPence: shipment.proceeds_pence + shipment.commission_pence + (shipment.stripe_fee_pence ?? 0),
        items: related.map((item) => ({ name: item.product_name, quantity: item.quantity }))
      };
    })
  });
}
