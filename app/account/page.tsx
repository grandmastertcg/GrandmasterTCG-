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
  price_pence: number;
  stock: number;
  active: boolean;
};

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
    stock: "1"
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
        await fetch("/api/checkout/confirm", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
          body: JSON.stringify({ sessionId })
        });
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
      if (frontPhoto) imageUrl = await uploadPhoto(frontPhoto);
      if (backPhoto) backImageUrl = await uploadPhoto(backPhoto);
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

async function parcelAction(id: string, action: "ship" | "receive", carrier?: string, trackingNumber?: string) {
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
    setMessage(body.message || (action === "ship" ? "Tracking saved. The buyer has 14 days to confirm, dispute or request a refund." : "Delivery confirmed."));
    await refresh(token);
  }

  function payOn(shippedAt: string | null) {
    if (!shippedAt) return "";
    return new Date(new Date(shippedAt).getTime() + 14 * 24 * 60 * 60 * 1000).toLocaleDateString("en-GB", { day: "numeric", month: "long" });
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
        <p>Every sale must be posted with tracking. Stripe pays the seller when the buyer presses “I received this”. If the buyer does not press that, and does not open a dispute or request a refund, the seller is paid 14 days after the tracking number was added. Your 2% fee stays with the shop.</p>
        <button type="button" onClick={connectPayouts}>{payoutsConnected ? "Open Stripe payouts" : "Set up Stripe payouts"}</button>
        <h3>Sales to post</h3>
        {sales.length === 0 ? <p>No paid sales waiting.</p> : sales.map((parcel) => (
          <article className="my-listing" key={parcel.id}>
            <div>
              <strong>{parcel.items.map((item) => `${item.quantity} × ${item.name}`).join(", ") || "Cards"}</strong>
              {parcel.shipTo && <span>Ship to {parcel.shipTo}</span>}
              <span>{parcel.holdKind ? (parcel.holdKind === "refund" ? `Buyer requested a refund. ${parcel.holdReason || ""}` : `Buyer opened a dispute. ${parcel.holdReason || ""}`) : parcel.paid ? (parcel.receivedAt ? "Buyer received it. Paid out." : "Paid out 14 days after tracking.") : parcel.receivedAt ? "Buyer received it. Payout pending." : parcel.trackingNumber ? `Posted by ${parcel.carrier}: ${parcel.trackingNumber}. Pays on ${payOn(parcel.shippedAt)} unless the buyer confirms, disputes or requests a refund.` : "Needs a tracking number"}</span>
              {parcel.payoutError && <span>{parcel.payoutError}</span>}
            </div>
            <div>
              <b>{gbp(parcel.proceedsPence)}</b>
              {(parcel.stripeFeePence ?? 0) > 0 && <span>Card fee {gbp(parcel.stripeFeePence ?? 0)}</span>}
              {!parcel.trackingNumber && !parcel.receivedAt && (
                <form className="track-form" onSubmit={(event) => { event.preventDefault(); const entry = tracking[parcel.id] ?? { carrier: "Royal Mail", number: "" }; parcelAction(parcel.id, "ship", entry.carrier, entry.number); }}>
                  <select value={tracking[parcel.id]?.carrier ?? "Royal Mail"} onChange={(event) => setTracking({ ...tracking, [parcel.id]: { carrier: event.target.value, number: tracking[parcel.id]?.number ?? "" } })}>
                    {CARRIERS.map((item) => <option key={item}>{item}</option>)}
                  </select>
                  <input placeholder="Tracking number" value={tracking[parcel.id]?.number ?? ""} onChange={(event) => setTracking({ ...tracking, [parcel.id]: { carrier: tracking[parcel.id]?.carrier ?? "Royal Mail", number: event.target.value } })} required />
                  <button type="submit">Mark posted</button>
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
              {parcel.holdKind ? <span>{parcel.holdKind === "refund" ? "Refund requested. The seller is not paid while this is open." : "Dispute open. The seller is not paid while this is open."} {parcel.holdReason}</span> : parcel.paid ? <span>{parcel.receivedAt ? "Received. The seller has been paid." : "The seller was paid 14 days after tracking."}</span> : parcel.shippedAt && !parcel.receivedAt ? <span>If you do not confirm, dispute or request a refund, the seller is paid on {payOn(parcel.shippedAt)}.</span> : null}
            </div>
            {!parcel.paid && !parcel.holdKind && parcel.trackingNumber && !parcel.receivedAt && <button type="button" onClick={() => parcelAction(parcel.id, "receive")}>I received this</button>}
            {!parcel.paid && !parcel.holdKind && (
              <form className="track-form" onSubmit={(event) => { event.preventDefault(); openHold(parcel.id); }}>
                <select value={holds[parcel.id]?.kind ?? "dispute"} onChange={(event) => setHolds({ ...holds, [parcel.id]: { kind: event.target.value, reason: holds[parcel.id]?.reason ?? "" } })}>
                  <option value="dispute">Dispute</option>
                  <option value="refund">Refund</option>
                </select>
                <input placeholder="What is wrong with this order?" value={holds[parcel.id]?.reason ?? ""} onChange={(event) => setHolds({ ...holds, [parcel.id]: { kind: holds[parcel.id]?.kind ?? "dispute", reason: event.target.value } })} required minLength={8} maxLength={500} />
                <button type="submit">Hold the payout</button>
              </form>
            )}
            {parcel.receivedAt && !parcel.paid && !parcel.holdKind && <span>Received</span>}
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
                <input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => {
                  const file = event.target.files?.[0] ?? null;
                  setFrontPhoto(file);
                  setFrontPreview(file ? URL.createObjectURL(file) : "");
                }} />
              </label>
              <label>Back
                <input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => {
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
                <span>{listing.game} · {listing.condition} · {listing.active && listing.stock > 0 ? `${listing.stock} in stock` : "Removed"} · you receive {gbp(listing.price_pence - commissionOnSale(listing.price_pence))}</span>
              </div>
              <div>
                <b>{gbp(listing.price_pence)}</b>
                {listing.active && <button type="button" onClick={() => removeListing(listing.id)}>Remove</button>}
              </div>
            </article>
          ))}
        </section>
      </div>
    </main>
  );
}
