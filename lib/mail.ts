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

const DAY = 24 * 60 * 60 * 1000;

function payDate(deliveredAt: string) {
  return new Date(new Date(deliveredAt).getTime() + 2 * DAY).toLocaleDateString("en-GB", { day: "numeric", month: "long" });
}

async function adminEmails() {
  const { data: admins } = await supabaseAdmin().from("admin_users").select("user_id");
  const emails: string[] = [];
  for (const admin of admins ?? []) {
    const email = await userEmail(admin.user_id);
    if (email) emails.push(email);
  }
  return emails;
}

async function parcelContext(shipmentId: string) {
  const db = supabaseAdmin();
  const { data: shipment } = await db.from("shipments").select("id,seller_id,seller_key,seller_name,carrier,tracking_number,proceeds_pence,hold_kind,hold_reason,delivered_at,order_id").eq("id", shipmentId).maybeSingle();
  if (!shipment) return null;
  const { data: order } = await db.from("orders").select("customer_email,shipping_name,shipping_address,paid_at,created_at").eq("id", shipment.order_id).maybeSingle();
  const { data: items } = await db.from("order_items").select("product_name,quantity,seller_id").eq("order_id", shipment.order_id);
  const related = (items ?? []).filter((item) => (item.seller_id ?? "shop") === (shipment.seller_id ?? "shop"));
  const cards = related.map((item) => `${item.quantity} × ${item.product_name}`).join("\n");
  return { shipment, order, cards };
}

export async function sendTrackingEmail(shipmentId: string) {
  try {
    const context = await parcelContext(shipmentId);
    const buyer = context?.order?.customer_email || "";
    if (!context || !buyer || !context.shipment.tracking_number) return;
    await deliver(
      buyer,
      "Your GrandmasterTCG parcel has a tracking number",
      `Your parcel has been posted.\n\n${context.cards || "Your cards"}\n\n${context.shipment.carrier || "Courier"}: ${context.shipment.tracking_number}\n\nFollow it from your account: ${SITE}/account`
    );
  } catch {
    // A missed email must not undo the tracking number.
  }
}

export async function sendDeliveredEmail(shipmentId: string) {
  try {
    const context = await parcelContext(shipmentId);
    const buyer = context?.order?.customer_email || "";
    const deliveredAt = context?.shipment.delivered_at;
    if (!context || !buyer || !deliveredAt) return;
    await deliver(
      buyer,
      "Your GrandmasterTCG parcel shows as delivered",
      `The courier shows this parcel delivered.\n\n${context.cards || "Your cards"}\n\nThe seller is paid on ${payDate(deliveredAt)} unless you dispute the parcel or request a refund before then.\n\n${SITE}/account`
    );
  } catch {
    // A missed email must not undo the delivery scan.
  }
}

export async function sendArrivalEmail(shipmentId: string) {
  try {
    const context = await parcelContext(shipmentId);
    const buyer = context?.order?.customer_email || "";
    if (!context || !buyer) return;
    await deliver(
      buyer,
      "Has your GrandmasterTCG parcel arrived?",
      `The courier has not shown this parcel as delivered.\n\n${context.cards || "Your cards"}\n\nIf it has arrived and matches the listing, press “I received this” on your account. If it has not arrived, or the card is wrong, open a dispute or request a refund. If you do neither, the seller is paid two days after this email.\n\n${SITE}/account`
    );
  } catch {
    // A missed email must not undo the payout clock.
  }
}

export async function sendUnpostedRefundEmail(shipmentId: string) {
  try {
    const context = await parcelContext(shipmentId);
    if (!context) return;
    const buyer = context.order?.customer_email || "";
    const cards = context.cards || "Your cards";
    if (buyer) {
      await deliver(
        buyer,
        "Your GrandmasterTCG parcel has been refunded",
        `The seller did not add a tracking number within 5 days.\n\n${cards}\n\nThat part of the payment has been refunded to your card.\n\n${SITE}/account`
      );
    }
    const text = `No tracking number was added within 5 days, so this sale has been refunded.\n\n${cards}\n\nYou are not paid for this parcel.\n\n${SITE}/account`;
    if (context.shipment.seller_id) {
      const email = await userEmail(context.shipment.seller_id);
      if (email) await deliver(email, "A GrandmasterTCG sale was refunded", text);
    } else {
      for (const email of await adminEmails()) {
        await deliver(email, "A GrandmasterTCG shop sale was refunded", text);
      }
    }
  } catch {
    // A missed email must not undo the refund.
  }
}

export async function sendHoldEmail(shipmentId: string) {
  try {
    const context = await parcelContext(shipmentId);
    if (!context) return;
    const kind = context.shipment.hold_kind === "refund" ? "Refund request" : context.shipment.hold_kind === "oversold" ? "Sold out at payment" : context.shipment.hold_kind === "unposted" ? "Not posted" : "Dispute";
    const text = `${kind} on a parcel from ${context.shipment.seller_name || "GrandmasterTCG"}.\n\n${context.cards || "Cards"}\n\n${context.shipment.hold_reason || ""}\n\nOpen the shop admin page to refund the buyer or release the payout.\n\n${SITE}/admin`;
    for (const email of await adminEmails()) {
      await deliver(email, `GrandmasterTCG ${kind.toLowerCase()}`, text);
    }
  } catch {
    // A missed email must not undo the hold.
  }
}

export async function remindUnpostedSales() {
  try {
    const db = supabaseAdmin();
    const now = Date.now();
    const earliest = new Date(now - 4 * DAY).toISOString();
    const latest = new Date(now - 3 * DAY).toISOString();
    const first = await db.from("shipments").select("id,seller_id,seller_key,proceeds_pence,order_id,orders!inner(status,created_at,paid_at,shipping_name,shipping_address)").is("tracking_number", null).is("hold_at", null).is("refunded_at", null).eq("orders.status", "paid");
    const rows: { id: string; seller_id: string | null; proceeds_pence: number; order_id: string; started: string; shipping_name: string | null; shipping_address: { line1?: string; line2?: string; city?: string; postal_code?: string; country?: string } | null }[] = [];
    const source = first.error && /paid_at/.test(first.error.message)
      ? await db.from("shipments").select("id,seller_id,seller_key,proceeds_pence,order_id,orders!inner(status,created_at,shipping_name,shipping_address)").is("tracking_number", null).is("hold_at", null).is("refunded_at", null).eq("orders.status", "paid")
      : first;
    if (source.error) return;
    for (const shipment of source.data ?? []) {
      const order = Array.isArray(shipment.orders) ? shipment.orders[0] : shipment.orders;
      const started = order && "paid_at" in order ? order.paid_at || order.created_at : order?.created_at;
      if (!started) continue;
      rows.push({
        id: shipment.id,
        seller_id: shipment.seller_id,
        proceeds_pence: shipment.proceeds_pence,
        order_id: shipment.order_id,
        started,
        shipping_name: order?.shipping_name ?? null,
        shipping_address: order?.shipping_address ?? null
      });
    }
    const { data: items } = await db.from("order_items").select("order_id,product_name,quantity,seller_id");
    for (const shipment of rows) {
      const started = shipment.started;
      if (!started || started <= earliest || started > latest) continue;
      const related = (items ?? []).filter((item) => item.order_id === shipment.order_id && (item.seller_id ?? "shop") === (shipment.seller_id ?? "shop"));
      const cards = related.map((item) => `${item.quantity} × ${item.product_name}`).join("\n");
      const deadline = new Date(new Date(started).getTime() + 5 * DAY).toLocaleDateString("en-GB", { day: "numeric", month: "long" });
      const shipTo = addressText(shipment.shipping_name, shipment.shipping_address);
      const text = `This sale still has no tracking number.\n\n${cards || "Cards"}\n\nAdd the tracking number by ${deadline}. After that the buyer is refunded and you are not paid.\n\nShip to: ${shipTo || "the address on your account"}\nYou receive ${gbp(shipment.proceeds_pence)}.\n\n${SITE}/account`;
      if (shipment.seller_id) {
        const email = await userEmail(shipment.seller_id);
        if (email) await deliver(email, "GrandmasterTCG sale still needs tracking", text);
      } else {
        for (const email of await adminEmails()) {
          await deliver(email, "A GrandmasterTCG shop sale still needs tracking", text);
        }
      }
    }
  } catch {
    // A missed reminder must not stop payouts.
  }
}

export async function sendPaidEmail(shipmentId: string) {
  try {
    const context = await parcelContext(shipmentId);
    if (!context) return;
    const cards = context.cards || "Your cards";
    if (context.shipment.seller_id) {
      const email = await userEmail(context.shipment.seller_id);
      if (!email) return;
      await deliver(
        email,
        "You have been paid for a GrandmasterTCG sale",
        `This sale has been paid.\n\n${cards}\n\n${gbp(context.shipment.proceeds_pence)} has been sent to your Stripe payout account. Stripe then pays your bank on its own schedule.\n\n${SITE}/account`
      );
      return;
    }
    const text = `This shop sale is complete.\n\n${cards}\n\nThe payment stays with GrandmasterTCG.\n\n${SITE}/admin`;
    for (const email of await adminEmails()) {
      await deliver(email, "A GrandmasterTCG shop sale is complete", text);
    }
  } catch {
    // A missed email must not undo the payout.
  }
}

export async function sendSaleEmails(orderId: string) {
  try {
    const db = supabaseAdmin();
    const { data: order } = await db.from("orders").select("id,customer_email,total_pence,shipping_name,shipping_address").eq("id", orderId).maybeSingle();
    if (!order) return;
    const { data: items } = await db.from("order_items").select("product_name,quantity,seller_id,unit_price_pence").eq("order_id", orderId);
    const { data: shipments } = await db.from("shipments").select("seller_id,seller_key,seller_name,proceeds_pence,hold_kind,refunded_at").eq("order_id", orderId);
    const lines = (items ?? []).map((item) => `${item.quantity} × ${item.product_name}`);
    const shipTo = addressText(order.shipping_name, order.shipping_address as { line1?: string; line2?: string; city?: string; postal_code?: string; country?: string } | null);
    const buyer = order.customer_email || "";
    const oversold = (shipments ?? []).some((shipment) => shipment.hold_kind === "oversold");
    if (buyer) {
      await deliver(
        buyer,
        "Your GrandmasterTCG order",
        `Payment received for ${gbp(order.total_pence)}.\n\n${lines.join("\n")}\n\n${oversold ? "A card sold out before payment finished. That parcel is refunded to your card." : "The seller has 5 days to add a tracking number."} If the seller is a business, or the card is sold by GrandmasterTCG, you can cancel for 14 days after the parcel arrives. A private seller is not covered by that right. The card still has to match the listing.\n\n${SITE}/account\n${SITE}/terms`
      );
    }

    const { data: admins } = await db.from("admin_users").select("user_id");
    for (const shipment of shipments ?? []) {
      const related = (items ?? []).filter((item) => (item.seller_id ?? "shop") === (shipment.seller_id ?? "shop"));
      const cards = related.map((item) => `${item.quantity} × ${item.product_name}`).join("\n");
      const text = shipment.hold_kind === "oversold"
        ? `This sale cannot be posted. The card sold out before payment finished.\n\n${cards || lines.join("\n")}\n\n${shipment.refunded_at ? "The buyer has been refunded." : "The buyer is being refunded."} You are not paid for this parcel.\n\n${SITE}/account`
        : `You sold:\n${cards || lines.join("\n")}\n\nPost within 5 days of this payment. Add the tracking number on your account, or the buyer is refunded and you are not paid.\n\nShip to: ${shipTo || "the address on your account"}\nYou receive ${gbp(shipment.proceeds_pence)}.\n\n${SITE}/account`;
      const subject = shipment.hold_kind === "oversold"
        ? "A GrandmasterTCG sale sold out before payment"
        : shipment.seller_id
          ? "You have a GrandmasterTCG sale to post"
          : "A GrandmasterTCG shop sale needs posting";
      if (shipment.seller_id) {
        const email = await userEmail(shipment.seller_id);
        if (email) await deliver(email, subject, text);
      } else {
        for (const admin of admins ?? []) {
          const email = await userEmail(admin.user_id);
          if (email) await deliver(email, subject, text);
        }
      }
    }
  } catch {
    // A missed email must not undo a paid order.
  }
}
