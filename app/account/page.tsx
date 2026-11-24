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
  receivedAt: string | null;
  proceedsPence: number;
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
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [photo, setPhoto] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
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

  async function createListing(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    try {
      let imageUrl = "";
      if (photo) {
        const upload = new FormData();
        upload.set("photo", photo);
        const photoResponse = await fetch("/api/account/photos", {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          body: upload
        });
        const photoBody = await photoResponse.json();
        if (!photoResponse.ok) throw new Error(photoBody.error || "The photo could not be uploaded.");
        imageUrl = photoBody.url;
      }
      const response = await fetch("/api/account/listings", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ ...form, stock: Number(form.stock), image_url: imageUrl })
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Listing could not be saved.");
      setForm({ ...form, name: "", set_name: "", card_number: "", rarity: "", cert_number: "", price: "" });
      setPhoto(null);
      setPreview("");
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
    setMessage(body.message || (action === "ship" ? "Tracking saved. The buyer can confirm delivery." : "Delivery confirmed."));
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
          <p>Buy from the market, and sell cards under this name. The shop keeps 2% of each sale, up to £100 per card.</p>
        </div>
        <div>
          {admin && <a href="/admin">Shop admin</a>}
          <button type="button" onClick={signOut}>Sign out</button>
        </div>
      </header>
      {message && <p className="join-error" role="status">{message}</p>}
      <section className="account-panel parcel-panel">
        <h2>Payouts and parcels</h2>
        <p>Every sale must be posted with tracking. Stripe pays the seller only after the buyer confirms the parcel arrived. Your 2% fee stays with the shop.</p>
        <button type="button" onClick={connectPayouts}>{payoutsConnected ? "Open Stripe payouts" : "Set up Stripe payouts"}</button>
        <h3>Sales to post</h3>
        {sales.length === 0 ? <p>No paid sales waiting.</p> : sales.map((parcel) => (
          <article className="my-listing" key={parcel.id}>
            <div>
              <strong>{parcel.items.map((item) => `${item.quantity} × ${item.name}`).join(", ") || "Cards"}</strong>
              {parcel.shipTo && <span>Ship to {parcel.shipTo}</span>}
              <span>{parcel.receivedAt ? (parcel.paid ? "Buyer received it. Paid out." : "Buyer received it. Payout pending.") : parcel.trackingNumber ? `Posted by ${parcel.carrier}: ${parcel.trackingNumber}` : "Needs a tracking number"}</span>
              {parcel.payoutError && <span>{parcel.payoutError}</span>}
            </div>
            <div>
              <b>{gbp(parcel.proceedsPence)}</b>
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
            </div>
            {parcel.trackingNumber && !parcel.receivedAt && <button type="button" onClick={() => parcelAction(parcel.id, "receive")}>I received this</button>}
            {parcel.receivedAt && <span>Received</span>}
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
            <label>Photo of the card
              <input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => {
                const file = event.target.files?.[0] ?? null;
                setPhoto(file);
                setPreview(file ? URL.createObjectURL(file) : "");
              }} />
            </label>
            {preview && <img className="photo-preview" src={preview} alt="Card preview" />}
            <label>Price (£)<input inputMode="decimal" value={form.price} onChange={(event) => setForm({ ...form, price: event.target.value })} required /></label>
            {priceSplit(form.price) && <p>You receive {gbp(priceSplit(form.price)!.net)}. The shop keeps {gbp(priceSplit(form.price)!.fee)}.</p>}
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
