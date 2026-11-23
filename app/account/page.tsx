"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase-browser";
import { SALE_CONDITIONS, SALE_GAMES, gbp } from "@/lib/catalog";
import { commissionOnSale } from "@/lib/commission";

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
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: "",
    game: "Pokémon",
    set_name: "",
    card_number: "",
    rarity: "",
    condition: "Near Mint",
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
  }

  async function createListing(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    try {
      const response = await fetch("/api/account/listings", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ ...form, stock: Number(form.stock) })
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Listing could not be saved.");
      setForm({ ...form, name: "", set_name: "", card_number: "", rarity: "", price: "" });
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
            <label>Condition
              <select value={form.condition} onChange={(event) => setForm({ ...form, condition: event.target.value })}>
                {SALE_CONDITIONS.map((condition) => <option key={condition}>{condition}</option>)}
              </select>
            </label>
            <label>Price (£)<input inputMode="decimal" value={form.price} onChange={(event) => setForm({ ...form, price: event.target.value })} required /></label>
            {priceSplit(form.price) && <p>You receive {gbp(priceSplit(form.price)!.net)}. The shop keeps {gbp(priceSplit(form.price)!.fee)}.</p>}
            <label>Quantity<input type="number" min={1} max={99} value={form.stock} onChange={(event) => setForm({ ...form, stock: event.target.value })} required /></label>
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
