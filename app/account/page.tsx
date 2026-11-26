"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase-browser";
import { SALE_CONDITIONS, SALE_GAMES, gbp } from "@/lib/catalog";
import { commissionOnSale } from "@/lib/commission";
import { CARRIERS } from "@/lib/shipping";
import { GRADERS, GRADES } from "@/lib/grades";

type Parcel = {
  id: string;
  sellerName: string;
  shipTo?: string;
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
  items: { name: string; quantity: number }[];
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
  const [frontPhoto, setFrontPhoto] = useState<File | null>(null);
  const [backPhoto, setBackPhoto] = useState<File | null>(null);
  const [frontPreview, setFrontPreview] = useState("");
  const [backPreview, setBackPreview] = useState("");
  const [edits, setEdits] = useState<Record<string, { price: string; stock: string; condition: string; selling: string }>>({});
  const [form, setForm] = useState({
    name: "",
    game: "Pokémon",
    set_name: "",
    card_number: "",
    rarity: "",
    condition: "Near Mint",
    graded: false,
    grader: "PSA",
    grade: "10",
    cert_number: "",
    price: "",
    stock: "1",
    seller_business: ""
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
      setReady(true);
    });
  }, [router]);

  async function refresh(accessToken: string) {
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
      condition: listing.condition,
      selling: listing.seller_business ? "business" : "private"
    };
  }

  function rawListing(listing: Listing) {
    return !listing.grader && SALE_CONDITIONS.includes(listing.condition as (typeof SALE_CONDITIONS)[number]);
  }

  async function saveListing(listing: Listing) {
    const draft = listingDraft(listing);
    setSaving(true);
    setMessage("");
    try {
      const response = await fetch(`/api/account/listings/${listing.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ price: draft.price, stock: Number(draft.stock), condition: draft.condition, seller_business: draft.selling })
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
          <p>Buy from the market, and sell cards under this name. The shop keeps 2% of each sale, up to £100 per card. Read the <a href="/terms">terms for sellers</a> before you list a card.</p>
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
        <h3>Sales to post</h3>
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
              <select value={form.game} onChange={(event) => setForm({ ...form, game: event.target.value })}>
                {SALE_GAMES.map((game) => <option key={game}>{game}</option>)}
              </select>
            </label>
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
              </>
            ) : (
              <label>Condition
                <select value={form.condition} onChange={(event) => setForm({ ...form, condition: event.target.value })}>
                  {SALE_CONDITIONS.map((condition) => <option key={condition}>{condition}</option>)}
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
            {priceSplit(form.price) && <p>You receive {gbp(priceSplit(form.price)!.net)} before the card processing fee. The shop keeps {gbp(priceSplit(form.price)!.fee)}.</p>}
            <label>Quantity<input type="number" min={1} max={99} value={form.graded ? "1" : form.stock} onChange={(event) => setForm({ ...form, stock: event.target.value })} required disabled={form.graded} /></label>
            <button type="submit" disabled={saving}>{saving ? "Saving..." : "List this card"}</button>
          </form>
        </section>
        <section className="account-panel">
          <h2>Your listings</h2>
          {listings.length === 0 ? <p>You have not listed a card yet.</p> : listings.map((listing) => (
            <article className="my-listing" key={listing.id}>
              <div>
                <strong>{listing.name}</strong>
                <span>{listing.game} · {listing.condition} · {listing.seller_business ? "Business seller" : "Private seller"} · {listing.active && listing.stock > 0 ? `${listing.stock} in stock` : "Removed"} · you receive {gbp(listing.price_pence - commissionOnSale(listing.price_pence))}</span>
              </div>
              <div>
                <b>{gbp(listing.price_pence)}</b>
                {listing.active && (
                  <form className="track-form" onSubmit={(event) => { event.preventDefault(); saveListing(listing); }}>
                    <select aria-label={`Seller type for ${listing.name}`} value={listingDraft(listing).selling} onChange={(event) => setEdits({ ...edits, [listing.id]: { ...listingDraft(listing), selling: event.target.value } })}>
                      <option value="private">Private seller</option>
                      <option value="business">Business seller</option>
                    </select>
                    <input inputMode="decimal" aria-label={`Price for ${listing.name}`} value={listingDraft(listing).price} onChange={(event) => setEdits({ ...edits, [listing.id]: { ...listingDraft(listing), price: event.target.value } })} />
                    {rawListing(listing) && (
                      <>
                        <select aria-label={`Condition for ${listing.name}`} value={listingDraft(listing).condition} onChange={(event) => setEdits({ ...edits, [listing.id]: { ...listingDraft(listing), condition: event.target.value } })}>
                          {SALE_CONDITIONS.map((condition) => <option key={condition}>{condition}</option>)}
                        </select>
                        <input type="number" min={1} max={99} aria-label={`Quantity for ${listing.name}`} value={listingDraft(listing).stock} onChange={(event) => setEdits({ ...edits, [listing.id]: { ...listingDraft(listing), stock: event.target.value } })} />
                      </>
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
