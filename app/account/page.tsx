"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase-browser";
import { POKEMON_NOTES, SALE_GAMES, cardLanguage, conditionLabel, conditionNote, conditionsFor, gbp, languagesFor, saleCondition } from "@/lib/catalog";
import { commissionOnSale } from "@/lib/commission";
import { PostageRates } from "@/components/postage-rates";
import { CARRIERS } from "@/lib/shipping";
import { GRADERS, GRADES } from "@/lib/grades";

type Parcel = {
  id: string;
  sellerName: string;
  shipTo?: string;
  addressLines?: string[];
  carrier: string | null;
  trackingNumber: string | null;
  shippedAt: string | null;
  receivedAt: string | null;
  deliveredAt: string | null;
  arrivalAskedAt?: string | null;
  refundedAt: string | null;
  holdKind: string | null;
  holdReason: string | null;
  proceedsPence: number;
  stripeFeePence?: number;
  paid: boolean;
  payoutError: string | null;
  commissionPence?: number;
  createdAt?: string | null;
  items: { name: string; quantity: number; unitPricePence?: number }[];
};
type Listing = {
  id: string;
  name: string;
  game: string;
  condition: string;
  grader?: string | null;
  price_pence: number;
  stock: number;
  active: boolean;
  seller_business?: boolean | null;
  language?: string | null;
  postage_size?: string | null;
};

const BASKET_KEY = "gmtcg-basket";

export default function AccountPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [token, setToken] = useState("");
  const [label, setLabel] = useState("");
  const [admin, setAdmin] = useState(false);
  const [listings, setListings] = useState<Listing[]>([]);
  const [sales, setSales] = useState<Parcel[]>([]);
  const [purchases, setPurchases] = useState<Parcel[]>([]);
  const [payoutsConnected, setPayoutsConnected] = useState(false);
  const [tracking, setTracking] = useState<Record<string, { carrier: string; number: string }>>({});
  const [holds, setHolds] = useState<Record<string, { kind: string; reason: string }>>({});
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [batchGame, setBatchGame] = useState("Pokémon");
  const [batchLanguage, setBatchLanguage] = useState("English");
  const [batchSelling, setBatchSelling] = useState("");
  const [frontPhoto, setFrontPhoto] = useState<File | null>(null);
  const [backPhoto, setBackPhoto] = useState<File | null>(null);
  const [frontPreview, setFrontPreview] = useState("");
  const [backPreview, setBackPreview] = useState("");
  const [edits, setEdits] = useState<Record<string, { price: string; stock: string; condition: string; condition_note: string; selling: string; language: string }>>({});
  const [form, setForm] = useState({
    name: "",
    game: "Pokémon",
    set_name: "",
    card_number: "",
    rarity: "",
    condition: "Near Mint (NM)",
    condition_note: "",
    graded: false,
    grader: "PSA",
    grade: "10",
    cert_number: "",
    price: "",
    stock: "1",
    seller_business: "",
    language: "English"
  });

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      const session = data.session;
      if (!session) {
        router.replace("/login");
        return;
      }
      setToken(session.access_token);
      const display = session.user.user_metadata?.display_name;
      setLabel(typeof display === "string" && display.trim() ? display.trim() : session.user.email ?? "Your account");
      const access = await fetch("/api/admin/check", { headers: { Authorization: `Bearer ${session.access_token}` } });
      if (access.ok) {
        const body = await access.json();
        setAdmin(Boolean(body.admin));
      }
      setReady(true);
      const sessionId = new URLSearchParams(window.location.search).get("session_id");
      if (sessionId) {
        const confirmed = await fetch("/api/checkout/confirm", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
          body: JSON.stringify({ sessionId })
        });
        if (confirmed.ok) localStorage.removeItem(BASKET_KEY);
      }
      await refresh(session.access_token);
    }).catch(() => {
      setMessage("Your account could not be loaded. Refresh the page.");
      setReady(true);
    });
  }, [router]);

  async function refresh(accessToken: string) {
    try {
      const response = await fetch("/api/account/listings", {
        headers: { Authorization: `Bearer ${accessToken}` },
        cache: "no-store"
      });
      const body = await response.json();
      if (response.ok) setListings(body.listings ?? []);
      else setMessage(body.error || "Listings could not be loaded.");
      const parcels = await fetch("/api/account/shipments", {
        headers: { Authorization: `Bearer ${accessToken}` },
        cache: "no-store"
      });
      const parcelBody = await parcels.json();
      if (parcels.ok) {
        setSales(parcelBody.sales ?? []);
        setPurchases(parcelBody.purchases ?? []);
        setPayoutsConnected(Boolean(parcelBody.payoutsConnected));
      } else {
        setMessage(parcelBody.error || "Parcels could not be loaded.");
      }
    } catch {
      setMessage("Your account could not be loaded. Refresh the page.");
    }
  }

  async function uploadPhoto(file: File) {
    const upload = new FormData();
    upload.set("photo", file);
    const photoResponse = await fetch("/api/account/photos", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: upload
    });
    const photoBody = await photoResponse.json();
    if (!photoResponse.ok) throw new Error(photoBody.error || "The photo could not be uploaded.");
    return String(photoBody.url ?? "");
  }

  async function uploadBatch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const input = event.currentTarget.elements.namedItem("batch");
    const file = input instanceof HTMLInputElement ? input.files?.[0] : undefined;
    if (!file) {
      setMessage("Choose the CSV file.");
      return;
    }
    setSaving(true);
    setMessage("");
    try {
      const body = new FormData();
      body.set("file", file);
      body.set("game", batchGame);
      body.set("language", batchLanguage);
      body.set("seller_business", batchSelling);
      const response = await fetch("/api/account/listings/batch", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body
      });
      const result = await response.json();
      const skipped = Array.isArray(result.skipped) ? result.skipped as { row: number; message: string }[] : [];
      const notes = skipped.slice(0, 6).map((item) => `Row ${item.row}: ${item.message}`).join(" ");
      if (!response.ok) throw new Error(notes ? `${result.error} ${notes}` : result.error || "The batch could not be listed.");
      setMessage(notes ? `Listed ${result.saved} cards. ${notes}` : `Listed ${result.saved} cards.`);
      if (input instanceof HTMLInputElement) input.value = "";
      await refresh(token);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The batch could not be listed.");
    } finally {
      setSaving(false);
    }
  }

  async function createListing(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    try {
      let imageUrl = "";
      let backImageUrl = "";
      if (!frontPhoto || !backPhoto) throw new Error("Add a photo of the front and the back.");
      imageUrl = await uploadPhoto(frontPhoto);
      backImageUrl = await uploadPhoto(backPhoto);
      const response = await fetch("/api/account/listings", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ ...form, stock: Number(form.stock), image_url: imageUrl, back_image_url: backImageUrl })
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Listing could not be saved.");
      setForm({ ...form, name: "", set_name: "", card_number: "", rarity: "", cert_number: "", price: "" });
      setFrontPhoto(null);
      setBackPhoto(null);
      setFrontPreview("");
      setBackPreview("");
      setMessage("Listing is live on the market.");
      await refresh(token);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Listing could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  function listingDraft(listing: Listing) {
    return edits[listing.id] ?? {
      price: (listing.price_pence / 100).toFixed(2),
      stock: String(listing.stock),
      condition: saleCondition(listing.condition, listing.game) ?? conditionLabel(listing.condition),
      condition_note: conditionNote(listing.condition),
      selling: listing.seller_business ? "business" : "private",
      language: cardLanguage(listing.game, listing.language) ?? "English"
    };
  }

  function rawListing(listing: Listing) {
    return !listing.grader && saleCondition(listing.condition) != null;
  }

  async function saveListing(listing: Listing) {
    const draft = listingDraft(listing);
    setSaving(true);
    setMessage("");
    try {
      const response = await fetch(`/api/account/listings/${listing.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ price: draft.price, stock: Number(draft.stock), condition: draft.condition, condition_note: draft.condition_note, seller_business: draft.selling, language: draft.language })
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Listing could not be updated.");
      setEdits((current) => {
        const next = { ...current };
        delete next[listing.id];
        return next;
      });
      setMessage("Listing updated.");
      await refresh(token);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Listing could not be updated.");
    } finally {
      setSaving(false);
    }
  }

  async function removeListing(id: string) {
    const response = await fetch(`/api/account/listings/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` }
    });
    const body = await response.json();
    if (!response.ok) {
      setMessage(body.error || "Listing could not be removed.");
      return;
    }
    await refresh(token);
  }

  function priceSplit(price: string) {
  if (!/^\d+(\.\d{1,2})?$/.test(price)) return null;
  const [pounds, pennies = ""] = price.split(".");
  const pence = Number(pounds) * 100 + Number(pennies.padEnd(2, "0"));
  const fee = commissionOnSale(pence);
  return { fee, net: pence - fee };
}

function needsLabel(parcel: Parcel) {
  return !parcel.trackingNumber && !parcel.refundedAt && !parcel.holdKind;
}

function labelLines(parcel: Parcel) {
  if (parcel.addressLines && parcel.addressLines.length > 0) return parcel.addressLines;
  return (parcel.shipTo ?? "").split(", ").map((line) => line.trim()).filter(Boolean);
}

function parcelRef(parcel: Parcel) {
  return parcel.id.replace(/-/g, "").slice(0, 6).toUpperCase();
}

function escapeLabel(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[character] ?? character));
}

function money(pence: number) {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(pence / 100);
}

function openPrint(title: string, body: string, style: string) {
  const sheet = window.open("", "_blank", "noopener,noreferrer");
  if (!sheet) return false;
  sheet.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title}</title><style>
    body { margin: 0; background: #fff; color: #111; font-family: Arial, sans-serif; }
    h1 { font-size: 16px; margin: 0 0 12px; }
    @media print { body { padding: 0; } h1 { display: none; } }
    ${style}
  </style></head><body><h1>${title}</h1>${body}<script>window.addEventListener("load", () => window.print());</script></body></html>`);
  sheet.document.close();
  return true;
}

function printLabels(parcels: Parcel[]) {
  const labels = parcels.map((parcel) => {
    const lines = labelLines(parcel).map((line) => escapeLabel(line)).join("<br>");
    return `<section class="label"><p class="kind">GrandmasterTCG</p><p class="to">${lines || "No delivery address on this order"}</p><p class="ref">Ref ${escapeLabel(parcelRef(parcel))}</p></section>`;
  }).join("");
  return openPrint("Address labels", `<div class="sheet">${labels}</div>`, `
    .sheet { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    .label { background: #fff; color: #111; border: 1px dashed #222; min-height: 150px; padding: 16px; break-inside: avoid; page-break-inside: avoid; }
    .kind { margin: 0 0 10px; font-size: 11px; letter-spacing: 0.04em; text-transform: uppercase; }
    .to { margin: 0; font-size: 18px; line-height: 1.35; }
    .ref { margin: 14px 0 0; font-size: 12px; letter-spacing: 0.04em; }
    @media (max-width: 700px) { .sheet { grid-template-columns: 1fr; } }
  `);
}

function printInvoices(parcels: Parcel[]) {
  const invoices = parcels.map((parcel) => {
    const lines = labelLines(parcel).map((line) => escapeLabel(line)).join("<br>");
    const cards = parcel.items.reduce((sum, item) => sum + (item.unitPricePence ?? 0) * item.quantity, 0);
    const postage = parcel.proceedsPence + (parcel.commissionPence ?? 0) - cards;
    const rows = parcel.items.map((item) => {
      const line = (item.unitPricePence ?? 0) * item.quantity;
      return `<tr><td>${escapeLabel(item.name)}</td><td>${item.quantity}</td><td>${escapeLabel(money(item.unitPricePence ?? 0))}</td><td>${escapeLabel(money(line))}</td></tr>`;
    }).join("");
    const when = parcel.createdAt ? new Date(parcel.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }) : "";
    const postageRow = postage > 0 ? `<tr><td colspan="3">Postage</td><td>${escapeLabel(money(postage))}</td></tr>` : "";
    return `<article class="invoice"><p class="kind">GrandmasterTCG</p><h2>Invoice</h2><p class="meta">Ref ${escapeLabel(parcelRef(parcel))} · ${escapeLabel(parcel.sellerName)}${when ? ` · ${escapeLabel(when)}` : ""}</p><p class="to">${lines || "No delivery address on this order"}</p><table><thead><tr><th>Card</th><th>Qty</th><th>Price</th><th>Total</th></tr></thead><tbody>${rows || "<tr><td colspan=\"4\">Cards</td></tr>"}${postageRow}<tr class="sum"><td colspan="3">Total</td><td>${escapeLabel(money(cards + Math.max(postage, 0)))}</td></tr></tbody></table></article>`;
  }).join("");
  return openPrint("Invoices", invoices, `
    .invoice { background: #fff; color: #111; max-width: 680px; margin: 0 auto 24px; padding: 8px 4px 20px; break-after: page; page-break-after: always; }
    .kind { margin: 0 0 8px; font-size: 11px; letter-spacing: 0.04em; text-transform: uppercase; }
    h2 { margin: 0 0 6px; font-size: 28px; }
    .meta, .to { margin: 0 0 14px; line-height: 1.4; }
    table { width: 100%; border-collapse: collapse; }
    th, td { text-align: left; padding: 8px 6px; border-bottom: 1px solid #ddd; }
    th:nth-child(n+2), td:nth-child(n+2) { text-align: right; }
    .sum td { font-weight: 700; border-bottom: 0; }
  `);
}

function canUndo(parcel: Parcel) {
  if (!parcel.receivedAt || parcel.paid || parcel.refundedAt) return false;
  return Date.now() - new Date(parcel.receivedAt).getTime() < 60 * 60 * 1000;
}

async function parcelAction(id: string, action: "ship" | "receive" | "undo", carrier?: string, trackingNumber?: string) {
    const response = await fetch(`/api/account/shipments/${id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ action, carrier, trackingNumber })
    });
    const body = await response.json();
    if (!response.ok) {
      setMessage(body.error || "That parcel could not be updated.");
      return;
    }
    setMessage(body.message || (action === "ship" ? "Tracking saved. You are paid when the buyer confirms, or 2 days after the courier shows it delivered." : action === "undo" ? "Confirmation removed." : "Marked as received."));
    await refresh(token);
  }

  function payOn(deliveredAt: string | null) {
    if (!deliveredAt) return "";
    return new Date(new Date(deliveredAt).getTime() + 2 * 24 * 60 * 60 * 1000).toLocaleDateString("en-GB", { day: "numeric", month: "long" });
  }

  function saleStatus(parcel: Parcel) {
    if (parcel.refundedAt) return "Refunded to the buyer.";
    if (parcel.holdKind === "unposted") return "No tracking number within 5 days. The buyer is refunded automatically.";
    if (parcel.holdKind === "oversold") return "This card sold out before payment finished. The buyer is refunded automatically.";
    if (parcel.holdKind === "refund") return `Buyer requested a refund. ${parcel.holdReason || ""}`;
    if (parcel.holdKind) return `Buyer opened a dispute. ${parcel.holdReason || ""}`;
    if (parcel.paid && parcel.receivedAt) return "Buyer received it. Paid out.";
    if (parcel.paid && parcel.deliveredAt) return "Paid out 2 days after the courier showed it delivered.";
    if (parcel.paid && parcel.arrivalAskedAt) return "Paid out because the courier showed no delivery and the buyer did not reply.";
    if (parcel.paid) return "Paid out.";
    if (parcel.receivedAt) return "Buyer confirmed receipt. Paid about an hour later, unless they undo it.";
    if (parcel.deliveredAt) return `Courier shows this delivered. Pays on ${payOn(parcel.deliveredAt)} unless the buyer disputes or requests a refund.`;
    if (parcel.arrivalAskedAt) return "The buyer has been asked if this arrived. Paid two days after that email if they stay silent.";
    if (parcel.trackingNumber) return `Posted by ${parcel.carrier}: ${parcel.trackingNumber}. Paid when the buyer confirms, or 2 days after the courier shows it delivered.`;
    return "Needs a tracking number within 5 days of payment.";
  }

  async function openHold(id: string) {
    const entry = holds[id] ?? { kind: "dispute", reason: "" };
    const response = await fetch(`/api/account/shipments/${id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ action: "hold", kind: entry.kind, reason: entry.reason })
    });
    const body = await response.json();
    if (!response.ok) {
      setMessage(body.error || "That request could not be saved.");
      return;
    }
    setMessage(body.message || "The payout is on hold.");
    await refresh(token);
  }

  async function connectPayouts() {
    const response = await fetch("/api/account/connect", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` }
    });
    const body = await response.json();
    if (!response.ok || !body.url) {
      setMessage(body.error || "Stripe payouts could not be started.");
      return;
    }
    window.location.href = body.url;
  }

  async function signOut() {
    await supabase.auth.signOut();
    router.push("/");
  }

  if (!ready) return <main className="join"><p className="account">Checking your account...</p></main>;

  return (
    <main className="account">
      <header className="account-top">
        <div>
          <a href="/">GrandmasterTCG</a>
          <h1>{label}</h1>
          <p>Buy from the market, and sell cards under this name. The shop keeps 2% of the cards in a basket, once, up to £100. Read the <a href="/terms">terms for sellers</a> before you list a card.</p>
        </div>
        <div>
          {admin && <a href="/admin">Shop admin</a>}
          <button type="button" onClick={signOut}>Sign out</button>
        </div>
      </header>
      {message && <p className="join-error" role="status">{message}</p>}
      <section className="account-panel parcel-panel">
        <h2>Payouts and parcels</h2>
        <p>Every sale must be posted with tracking within 5 days of payment. If it is not, the buyer is refunded and you are not paid. Once the number is saved, you and the buyer can both open Track parcel and follow where it is. Stripe pays the seller an hour after the buyer presses “I received this”, or 2 days after the courier shows the parcel delivered. If a tracked parcel still has no delivery scan after 7 days, the buyer is asked once, and the seller is paid 2 days later if the buyer stays silent. A dispute or refund request holds that payout until the shop decides it. Your 2% fee stays with the shop.</p>
        <button type="button" onClick={connectPayouts}>{payoutsConnected ? "Open Stripe payouts" : "Set up Stripe payouts"}</button>
        <div className="parcel-head">
          <h3>Sales to post</h3>
          {sales.some(needsLabel) && (
            <div className="parcel-actions">
              <button type="button" onClick={() => { if (!printLabels(sales.filter(needsLabel))) setMessage("Allow pop-up windows to print."); }}>Print labels</button>
              <button type="button" onClick={() => { if (!printInvoices(sales.filter(needsLabel))) setMessage("Allow pop-up windows to print."); }}>Print invoices</button>
            </div>
          )}
        </div>
        {sales.length === 0 ? <p>No paid sales waiting.</p> : sales.map((parcel) => (
          <article className="my-listing" key={parcel.id}>
            <div>
              <strong>{parcel.items.map((item) => `${item.quantity} × ${item.name}`).join(", ") || "Cards"}</strong>
              {parcel.shipTo && <span>Ship to {parcel.shipTo}</span>}
              <span>{saleStatus(parcel)}</span>
              {parcel.payoutError && <span>{parcel.payoutError}</span>}
              {parcel.trackingNumber && <a href={`/account/parcels/${parcel.id}`}>Track parcel</a>}
            </div>
            <div>
              <b>{gbp(parcel.proceedsPence)}</b>
              {(parcel.stripeFeePence ?? 0) > 0 && <span>Card fee {gbp(parcel.stripeFeePence ?? 0)}</span>}
              {needsLabel(parcel) && (
                <div className="parcel-print">
                  <button type="button" onClick={() => { if (!printLabels([parcel])) setMessage("Allow pop-up windows to print."); }}>Print label</button>
                  <button type="button" onClick={() => { if (!printInvoices([parcel])) setMessage("Allow pop-up windows to print."); }}>Print invoice</button>
                </div>
              )}
              {!parcel.receivedAt && !parcel.refundedAt && (
                <form className="track-form" onSubmit={(event) => { event.preventDefault(); const entry = tracking[parcel.id] ?? { carrier: parcel.carrier || "Royal Mail", number: parcel.trackingNumber || "" }; parcelAction(parcel.id, "ship", entry.carrier, entry.number); }}>
                  <select value={tracking[parcel.id]?.carrier ?? parcel.carrier ?? "Royal Mail"} onChange={(event) => setTracking({ ...tracking, [parcel.id]: { carrier: event.target.value, number: tracking[parcel.id]?.number ?? parcel.trackingNumber ?? "" } })}>
                    {CARRIERS.map((item) => <option key={item}>{item}</option>)}
                  </select>
                  <input placeholder="Tracking number" value={tracking[parcel.id]?.number ?? parcel.trackingNumber ?? ""} onChange={(event) => setTracking({ ...tracking, [parcel.id]: { carrier: tracking[parcel.id]?.carrier ?? parcel.carrier ?? "Royal Mail", number: event.target.value } })} required />
                  <button type="submit">{parcel.trackingNumber ? "Update tracking" : "Mark posted"}</button>
                </form>
              )}
            </div>
          </article>
        ))}
        <h3>Purchases</h3>
        {purchases.length === 0 ? <p>No paid purchases yet.</p> : purchases.map((parcel) => (
          <article className="my-listing" key={parcel.id}>
            <div>
              <strong>{parcel.items.map((item) => `${item.quantity} × ${item.name}`).join(", ") || "Cards"}</strong>
              <span>{parcel.sellerName} · {parcel.trackingNumber ? `${parcel.carrier} ${parcel.trackingNumber}` : "Waiting for tracking"}</span>
              {parcel.refundedAt ? <span>Refunded to your card.</span> : parcel.holdKind === "unposted" ? <span>No tracking was added within 5 days. The refund is going back to your card.</span> : parcel.holdKind === "oversold" ? <span>This card sold out before payment finished. The refund is going back to your card.</span> : parcel.holdKind ? <span>{parcel.holdKind === "refund" ? "Refund requested. The seller is not paid while the shop looks at this." : "Dispute open. The seller is not paid while the shop looks at this."} {parcel.holdReason}</span> : parcel.paid ? <span>{parcel.receivedAt ? "Received. The seller has been paid." : parcel.deliveredAt ? "The seller was paid 2 days after the courier showed it delivered." : "The seller has been paid."}</span> : parcel.receivedAt ? <span>You confirmed this. You can undo it for an hour. The seller is paid after that.</span> : parcel.deliveredAt ? <span>The courier shows this delivered. The seller is paid on {payOn(parcel.deliveredAt)} unless you dispute or request a refund.</span> : parcel.arrivalAskedAt ? <span>The courier has not shown a delivery. Confirm it, or dispute it, within 2 days of the email. If you do neither, the seller is paid.</span> : parcel.trackingNumber ? <span>The seller is paid when you confirm, or 2 days after the courier shows it delivered.</span> : <span>Waiting for tracking. The seller has 5 days from payment to add it.</span>}
            </div>
            {parcel.trackingNumber && <a href={`/account/parcels/${parcel.id}`}>Track parcel</a>}
            {!parcel.paid && !parcel.refundedAt && !parcel.holdKind && parcel.trackingNumber && !parcel.receivedAt && <button type="button" onClick={() => parcelAction(parcel.id, "receive")}>I received this</button>}
            {canUndo(parcel) && <button type="button" onClick={() => parcelAction(parcel.id, "undo")}>Undo</button>}
            {!parcel.paid && !parcel.refundedAt && !parcel.holdKind && (
              <form className="track-form" onSubmit={(event) => { event.preventDefault(); openHold(parcel.id); }}>
                <select value={holds[parcel.id]?.kind ?? "dispute"} onChange={(event) => setHolds({ ...holds, [parcel.id]: { kind: event.target.value, reason: holds[parcel.id]?.reason ?? "" } })}>
                  <option value="dispute">Dispute</option>
                  <option value="refund">Refund</option>
                </select>
                <input placeholder="What is wrong with this order?" value={holds[parcel.id]?.reason ?? ""} onChange={(event) => setHolds({ ...holds, [parcel.id]: { kind: holds[parcel.id]?.kind ?? "dispute", reason: event.target.value } })} required minLength={8} maxLength={500} />
                <button type="submit">Hold the payout</button>
              </form>
            )}
            {parcel.receivedAt && !parcel.paid && !parcel.holdKind && !canUndo(parcel) && <span>Received</span>}
          </article>
        ))}
      </section>
      <div className="account-grid">
        <section className="account-panel">
          <h2>Sell a card</h2>
          <form className="sell-form" onSubmit={createListing}>
            <label>Card name<input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required /></label>
            <label>Game
              <select value={form.game} onChange={(event) => {
                const game = event.target.value;
                const options = languagesFor(game);
                const conditions = conditionsFor(game);
                setForm({
                  ...form,
                  game,
                  language: options.includes(form.language) ? form.language : (options[0] ?? "English"),
                  condition: conditions.includes(form.condition) ? form.condition : "Near Mint (NM)",
                  condition_note: game === "Pokémon" ? form.condition_note : ""
                });
              }}>
                {SALE_GAMES.map((game) => <option key={game}>{game}</option>)}
              </select>
            </label>
            {languagesFor(form.game).length > 1 && (
              <label>Language
                <select value={form.language} onChange={(event) => setForm({ ...form, language: event.target.value })}>
                  {languagesFor(form.game).map((language) => <option key={language}>{language}</option>)}
                </select>
              </label>
            )}
            <label>Set<input value={form.set_name} onChange={(event) => setForm({ ...form, set_name: event.target.value })} required /></label>
            <label>Number<input value={form.card_number} onChange={(event) => setForm({ ...form, card_number: event.target.value })} /></label>
            <label>Rarity<input value={form.rarity} onChange={(event) => setForm({ ...form, rarity: event.target.value })} /></label>
            <label className="check-row"><input type="checkbox" checked={form.graded} onChange={(event) => setForm({ ...form, graded: event.target.checked, stock: event.target.checked ? "1" : form.stock })} /> This card is graded</label>
            {form.graded ? (
              <>
                <label>Grading company
                  <select value={form.grader} onChange={(event) => setForm({ ...form, grader: event.target.value })}>
                    {GRADERS.map((grader) => <option key={grader}>{grader}</option>)}
                  </select>
                </label>
                <label>Grade
                  <select value={form.grade} onChange={(event) => setForm({ ...form, grade: event.target.value })}>
                    {GRADES.map((grade) => <option key={grade}>{grade}</option>)}
                  </select>
                </label>
                <label>Certificate number<input value={form.cert_number} onChange={(event) => setForm({ ...form, cert_number: event.target.value })} placeholder="From the slab label" /></label>
                {form.game === "Pokémon" && (
                  <label>Condition
                    <select value={form.condition_note} onChange={(event) => setForm({ ...form, condition_note: event.target.value })}>
                      <option value="">Graded condition only</option>
                      {POKEMON_NOTES.map((condition) => <option key={condition}>{condition}</option>)}
                    </select>
                  </label>
                )}
              </>
            ) : (
              <label>Condition
                <select value={form.condition} onChange={(event) => setForm({ ...form, condition: event.target.value })}>
                  {conditionsFor(form.game).map((condition) => <option key={condition}>{condition}</option>)}
                </select>
              </label>
            )}
            <div className="photo-pair">
              <label>Front
                <input type="file" accept="image/jpeg,image/png,image/webp" required onChange={(event) => {
                  const file = event.target.files?.[0] ?? null;
                  setFrontPhoto(file);
                  setFrontPreview(file ? URL.createObjectURL(file) : "");
                }} />
              </label>
              <label>Back
                <input type="file" accept="image/jpeg,image/png,image/webp" required onChange={(event) => {
                  const file = event.target.files?.[0] ?? null;
                  setBackPhoto(file);
                  setBackPreview(file ? URL.createObjectURL(file) : "");
                }} />
              </label>
            </div>
            <div className="photo-pair">
              {frontPreview && <img className="photo-preview" src={frontPreview} alt="Front of the card" />}
              {backPreview && <img className="photo-preview" src={backPreview} alt="Back of the card" />}
            </div>
            <label>Who is selling
              <select value={form.seller_business} onChange={(event) => setForm({ ...form, seller_business: event.target.value })} required>
                <option value="">Choose</option>
                <option value="private">I am a private seller</option>
                <option value="business">I am selling as a business</option>
              </select>
            </label>
            <label>Price (£)<input inputMode="decimal" value={form.price} onChange={(event) => setForm({ ...form, price: event.target.value })} required /></label>
            <PostageRates />
            <p>You do not choose the postage. The shop adds it for the buyer. Cards from you in the same order go in one parcel and the buyer pays postage once. Up to 10 raw cards stay a Large Letter. An 11th raw card, or a 4th graded card, moves the parcel to a Small Parcel. If your cards in the order are over £75, the buyer pays Special Delivery by 1pm instead, and that includes cover up to £750. Buy the label online. For tracked postage, a Post Office counter costs more, and that difference is yours. The postage the buyer paid is added to your payout.</p>
            {priceSplit(form.price) && <p>You receive {gbp(priceSplit(form.price)!.net)} before the card processing fee when this is the only card in the basket. The shop keeps 2% of the cards in the basket, once, and never more than £100. Postage is added on top when the buyer pays, and it is included in your payout.</p>}
            <label>Quantity<input type="number" min={1} max={99} value={form.graded ? "1" : form.stock} onChange={(event) => setForm({ ...form, stock: event.target.value })} required disabled={form.graded} /></label>
            <button type="submit" disabled={saving}>{saving ? "Saving..." : "List this card"}</button>
          </form>
          <h2>Upload a batch</h2>
          <p>On Card Uploader, open List / Export, then Export CSV, and choose Export Basic. An eBay, TCGplayer, Shopify or Whatnot CSV works as well. Prices in the file are read as pounds, and each row needs a front photo link.</p>
          <form className="sell-form" onSubmit={uploadBatch}>
            <label>CSV file<input name="batch" type="file" accept=".csv,text/csv" required /></label>
            <label>Game when the file does not say
              <select value={batchGame} onChange={(event) => {
                const game = event.target.value;
                const options = languagesFor(game);
                setBatchGame(game);
                if (!options.includes(batchLanguage)) setBatchLanguage(options[0] ?? "English");
              }}>
                {SALE_GAMES.map((game) => <option key={game}>{game}</option>)}
              </select>
            </label>
            {languagesFor(batchGame).length > 1 && (
              <label>Language when the file does not say
                <select value={batchLanguage} onChange={(event) => setBatchLanguage(event.target.value)}>
                  {languagesFor(batchGame).map((language) => <option key={language}>{language}</option>)}
                </select>
              </label>
            )}
            <label>Who is selling
              <select value={batchSelling} onChange={(event) => setBatchSelling(event.target.value)} required>
                <option value="">Choose</option>
                <option value="private">I am a private seller</option>
                <option value="business">I am selling as a business</option>
              </select>
            </label>
            <button type="submit" disabled={saving}>{saving ? "Saving..." : "List this batch"}</button>
          </form>
        </section>
        <section className="account-panel">
          <h2>Your listings</h2>
          {listings.length === 0 ? <p>You have not listed a card yet.</p> : listings.map((listing) => (
            <article className="my-listing" key={listing.id}>
              <div>
                <strong>{listing.name}</strong>
                <span>{listing.game}{languagesFor(listing.game).length > 1 ? ` · ${cardLanguage(listing.game, listing.language)}` : ""} · {conditionLabel(listing.condition)} · {listing.seller_business ? "Business seller" : "Private seller"} · {listing.active && listing.stock > 0 ? `${listing.stock} in stock` : "Removed"} · you receive {gbp(listing.price_pence - commissionOnSale(listing.price_pence))} when this is the only card in the basket</span>
              </div>
              <div>
                <b>{gbp(listing.price_pence)}</b>
                {listing.active && (
                  <form className="track-form" onSubmit={(event) => { event.preventDefault(); saveListing(listing); }}>
                    {languagesFor(listing.game).length > 1 && (
                      <select aria-label={`Language for ${listing.name}`} value={listingDraft(listing).language} onChange={(event) => setEdits({ ...edits, [listing.id]: { ...listingDraft(listing), language: event.target.value } })}>
                        {languagesFor(listing.game).map((language) => <option key={language}>{language}</option>)}
                      </select>
                    )}
                    <select aria-label={`Seller type for ${listing.name}`} value={listingDraft(listing).selling} onChange={(event) => setEdits({ ...edits, [listing.id]: { ...listingDraft(listing), selling: event.target.value } })}>
                      <option value="private">Private seller</option>
                      <option value="business">Business seller</option>
                    </select>
                    <input inputMode="decimal" aria-label={`Price for ${listing.name}`} value={listingDraft(listing).price} onChange={(event) => setEdits({ ...edits, [listing.id]: { ...listingDraft(listing), price: event.target.value } })} />
                    {rawListing(listing) && (
                      <>
                        <select aria-label={`Condition for ${listing.name}`} value={listingDraft(listing).condition} onChange={(event) => setEdits({ ...edits, [listing.id]: { ...listingDraft(listing), condition: event.target.value } })}>
                          {conditionsFor(listing.game).map((condition) => <option key={condition}>{condition}</option>)}
                        </select>
                        <input type="number" min={1} max={99} aria-label={`Quantity for ${listing.name}`} value={listingDraft(listing).stock} onChange={(event) => setEdits({ ...edits, [listing.id]: { ...listingDraft(listing), stock: event.target.value } })} />
                      </>
                    )}
                    {!rawListing(listing) && listing.game === "Pokémon" && (
                      <select aria-label={`Condition for ${listing.name}`} value={listingDraft(listing).condition_note} onChange={(event) => setEdits({ ...edits, [listing.id]: { ...listingDraft(listing), condition_note: event.target.value } })}>
                        <option value="">Graded condition only</option>
                        {POKEMON_NOTES.map((condition) => <option key={condition}>{condition}</option>)}
                      </select>
                    )}
                    <button className="listing-save" type="submit" disabled={saving}>Save</button>
                    <button type="button" onClick={() => removeListing(listing.id)}>Remove</button>
                  </form>
                )}
              </div>
            </article>
          ))}
        </section>
      </div>
    </main>
  );
}
