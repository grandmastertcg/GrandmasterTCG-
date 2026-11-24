import { supabaseAdmin } from "@/lib/supabase";

const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://grandmastertcg.co.uk";

function gbp(pence: number) {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(pence / 100);
}

function addressText(name: string | null, address: { line1?: string; line2?: string; city?: string; postal_code?: string; country?: string } | null) {
  return [name, address?.line1, address?.line2, address?.city, address?.postal_code, address?.country].filter(Boolean).join(", ");
}

async function deliver(to: string, subject: string, text: string) {
  const key = process.env.RESEND_API_KEY;
  if (!key || !to) return;
  const from = process.env.ORDER_FROM_EMAIL || "GrandmasterTCG <orders@grandmastertcg.co.uk>";
  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to: [to], subject, text }),
    signal: AbortSignal.timeout(12000)
  });
}

async function userEmail(userId: string) {
  const { data } = await supabaseAdmin().auth.admin.getUserById(userId);
  return data.user?.email ?? "";
}

export async function sendSaleEmails(orderId: string) {
  try {
    const db = supabaseAdmin();
    const { data: order } = await db.from("orders").select("id,customer_email,total_pence,shipping_name,shipping_address").eq("id", orderId).maybeSingle();
    if (!order) return;
    const { data: items } = await db.from("order_items").select("product_name,quantity,seller_id,unit_price_pence").eq("order_id", orderId);
    const { data: shipments } = await db.from("shipments").select("seller_id,seller_key,seller_name,proceeds_pence").eq("order_id", orderId);
    const lines = (items ?? []).map((item) => `${item.quantity} × ${item.product_name}`);
    const shipTo = addressText(order.shipping_name, order.shipping_address as { line1?: string; line2?: string; city?: string; postal_code?: string; country?: string } | null);
    const buyer = order.customer_email || "";
    if (buyer) {
      await deliver(
        buyer,
        "Your GrandmasterTCG order",
        `Payment received for ${gbp(order.total_pence)}.\n\n${lines.join("\n")}\n\nThe seller has 5 days to add a tracking number. You can follow the parcel from your account: ${SITE}/account`
      );
    }

    const { data: admins } = await db.from("admin_users").select("user_id");
    for (const shipment of shipments ?? []) {
      const related = (items ?? []).filter((item) => (item.seller_id ?? "shop") === (shipment.seller_id ?? "shop"));
      const cards = related.map((item) => `${item.quantity} × ${item.product_name}`).join("\n");
      const text = `You sold:\n${cards || lines.join("\n")}\n\nPost within 5 days of this payment. Add the tracking number on your account, or the payout is held and the shop can refund the buyer.\n\nShip to: ${shipTo || "the address on your account"}\nYou receive ${gbp(shipment.proceeds_pence)}.\n\n${SITE}/account`;
      if (shipment.seller_id) {
        const email = await userEmail(shipment.seller_id);
        if (email) await deliver(email, "You have a GrandmasterTCG sale to post", text);
      } else {
        for (const admin of admins ?? []) {
          const email = await userEmail(admin.user_id);
          if (email) await deliver(email, "A GrandmasterTCG shop sale needs posting", text);
        }
      }
    }
  } catch {
    // A missed email must not undo a paid order.
  }
}
