"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../../../lib/supabase-browser";
import { SALE_CONDITIONS, SALE_GAMES, languagesFor } from "@/lib/catalog";

export default function AddProductPage() {
  const [name, setName] = useState("");
  const [game, setGame] = useState("Pokémon");
  const [language, setLanguage] = useState("English");
  const [cardSet, setSetName] = useState("");
  const [cardNumber, setCardNumber] = useState("");
  const [rarity, setRarity] = useState("");
  const [condition, setCondition] = useState("Near Mint (NM)");
  const [price, setPrice] = useState("");
  const [stock, setStock] = useState("1");
  const [imageUrl, setImageUrl] = useState("");
  const [backImageUrl, setBackImageUrl] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [batchGame, setBatchGame] = useState("Pokémon");
  const [batchLanguage, setBatchLanguage] = useState("English");
const [accessStatus, setAccessStatus] = useState<
    "checking" | "allowed" | "denied"
  >("checking");

  useEffect(() => {
    let active = true;

    async function checkAdmin() {
      try {
        const { data, error } =
          await supabase.auth.getSession();

        if (error || !data.session) {
          if (active) setAccessStatus("denied");
          return;
        }

        const response = await fetch("/api/admin/check", {
          headers: {
            Authorization: `Bearer ${data.session.access_token}`,
          },
          cache: "no-store",
        });

        if (!active) return;

        if (!response.ok) {
          setAccessStatus("denied");
          return;
        }

        const result = await response.json();

        setAccessStatus(
          result.admin === true ? "allowed" : "denied"
        );
      } catch {
        if (active) setAccessStatus("denied");
      }
    }

    checkAdmin();

    return () => {
      active = false;
    };
  }, []);
  async function saveProduct(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage("");

    try {
      const { data, error } = await supabase.auth.getSession();

      if (error || !data.session) {
        setMessage("Please sign in as an administrator.");
        return;
      }

      const response = await fetch("/api/admin/products", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${data.session.access_token}`,
        },
        body: JSON.stringify({
          name,
          game,
          language,
          set_name: cardSet,
          card_number: cardNumber,
          rarity,
          condition,
          price,
          stock: Number(stock),
          image_url: imageUrl,
          back_image_url: backImageUrl,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Unable to save product.");
      }

      setMessage("Product added successfully!");
      setName("");
      setSetName("");
      setCardNumber("");
      setRarity("");
      setPrice("");
      setStock("1");
      setImageUrl("");
      setBackImageUrl("");
    } catch (err) {
      setMessage(
        err instanceof Error ? err.message : "Something went wrong."
      );
    } finally {
      setSaving(false);
    }
  }

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: 12,
    borderRadius: 6,
    border: "1px solid #777",
    background: "#222",
    color: "#fff",
    boxSizing: "border-box",
  };

  const labelStyle: React.CSSProperties = {
    display: "grid",
    gap: 6,
  };
if (accessStatus === "checking") {
  return <main style={{ minHeight: "100vh", background: "#090d18", color: "#f5f7fb", padding: 40 }}>Checking administrator access...</main>;
}

if (accessStatus === "denied") {
  return (
    <main style={{ minHeight: "100vh", background: "#090d18", color: "#f5f7fb", padding: 40 }}>
      <h1>Administrator login required</h1>
      <a href="/login">Go to Login</a>
    </main>
  );
}
  return (
    <main style={{
      minHeight: "100vh",
      background: "#111",
      color: "#f4c95d",
      padding: "30px 20px",
      fontFamily: "Arial, sans-serif",
    }}>
      <div style={{ maxWidth: 600, margin: "auto" }}>
        <h1>Add Trading Card</h1>
        <p>Add a new card to GrandmasterTCG.</p>

        <form
          onSubmit={saveProduct}
          style={{ display: "grid", gap: 18, marginTop: 30 }}
        >
          <label style={labelStyle}>
            Card Name
            <input
              style={inputStyle}
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Charizard"
              required
            />
          </label>

          <label style={labelStyle}>
            Trading Card Game
            <select
              style={inputStyle}
              value={game}
              onChange={(event) => {
                const next = event.target.value;
                const options = languagesFor(next);
                setGame(next);
                if (!options.includes(language)) setLanguage(options[0] ?? "English");
              }}
            >
              {SALE_GAMES.map((item) => <option key={item}>{item}</option>)}
            </select>
          </label>

          {languagesFor(game).length > 1 && (
            <label style={labelStyle}>
              Language
              <select style={inputStyle} value={language} onChange={(event) => setLanguage(event.target.value)}>
                {languagesFor(game).map((item) => <option key={item}>{item}</option>)}
              </select>
            </label>
          )}

          <label style={labelStyle}>
            Set Name
            <input
              style={inputStyle}
              value={cardSet}
              onChange={e => setSetName(e.target.value)}
              placeholder="e.g. Base Set"
              required
            />
          </label>

          <label style={labelStyle}>
            Card Number
            <input
              style={inputStyle}
              value={cardNumber}
              onChange={e => setCardNumber(e.target.value)}
              placeholder="e.g. 4/102"
            />
          </label>

          <label style={labelStyle}>
            Rarity
            <input
              style={inputStyle}
              value={rarity}
              onChange={e => setRarity(e.target.value)}
              placeholder="e.g. Holo Rare"
            />
          </label>

          <label style={labelStyle}>
            Condition
            <select
              style={inputStyle}
              value={condition}
              onChange={e => setCondition(e.target.value)}
            >
              {SALE_CONDITIONS.map((item) => <option key={item}>{item}</option>)}
            </select>
          </label>

          <label style={labelStyle}>
            Price (£)
            <input
              style={inputStyle}
              type="number"
              min="0.01"
              step="0.01"
              value={price}
              onChange={e => setPrice(e.target.value)}
              placeholder="4.99"
              required
            />
          </label>

          <label style={labelStyle}>
            Stock Quantity
            <input
              style={inputStyle}
              type="number"
              min="0"
              step="1"
              value={stock}
              onChange={e => setStock(e.target.value)}
              required
            />
          </label>

          <label style={labelStyle}>
            Front photo URL
            <input
              style={inputStyle}
              type="url"
              value={imageUrl}
              onChange={e => setImageUrl(e.target.value)}
              placeholder="https://example.com/front.jpg"
              required
            />
          </label>

          <label style={labelStyle}>
            Back photo URL
            <input
              style={inputStyle}
              type="url"
              value={backImageUrl}
              onChange={e => setBackImageUrl(e.target.value)}
              placeholder="https://example.com/back.jpg"
              required
            />
          </label>

          <button
            type="submit"
            disabled={saving}
            style={{
              background: "#f4c95d",
              color: "#111",
              padding: 16,
              border: 0,
              borderRadius: 6,
              fontWeight: "bold",
              cursor: "pointer",
            }}
          >
            {saving ? "Saving..." : "Add Product"}
          </button>

          <p role="status">{message}</p>
        </form>

        <form
          onSubmit={async (event) => {
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
              const { data, error } = await supabase.auth.getSession();
              if (error || !data.session) {
                setMessage("Please sign in as an administrator.");
                return;
              }
              const body = new FormData();
              body.set("file", file);
              body.set("game", batchGame);
              body.set("language", batchLanguage);
              const response = await fetch("/api/admin/products/batch", {
                method: "POST",
                headers: { Authorization: `Bearer ${data.session.access_token}` },
                body
              });
              const result = await response.json();
              const skipped = Array.isArray(result.skipped) ? result.skipped as { row: number; message: string }[] : [];
              const notes = skipped.slice(0, 6).map((item) => `Row ${item.row}: ${item.message}`).join(" ");
              if (!response.ok) throw new Error(notes ? `${result.error} ${notes}` : result.error || "The batch could not be listed.");
              setMessage(notes ? `Listed ${result.saved} shop cards. ${notes}` : `Listed ${result.saved} shop cards.`);
              if (input instanceof HTMLInputElement) input.value = "";
            } catch (uploadError) {
              setMessage(uploadError instanceof Error ? uploadError.message : "The batch could not be listed.");
            } finally {
              setSaving(false);
            }
          }}
          style={{ display: "grid", gap: 12, marginTop: 28 }}
        >
          <h2 style={{ margin: "8px 0 0" }}>Upload a batch</h2>
          <p style={{ margin: 0, color: "#4b5563" }}>
            These cards are sold by GrandmasterTCG. On Card Uploader, export a Basic, eBay, TCGplayer, Shopify or Whatnot CSV. Prices are read as pounds, and each row needs a front photo link.
          </p>
          <label style={labelStyle}>
            CSV file
            <input name="batch" type="file" accept=".csv,text/csv" required style={inputStyle} />
          </label>
          <label style={labelStyle}>
            Game when the file does not say
            <select style={inputStyle} value={batchGame} onChange={(event) => {
              const next = event.target.value;
              const options = languagesFor(next);
              setBatchGame(next);
              if (!options.includes(batchLanguage)) setBatchLanguage(options[0] ?? "English");
            }}>
              {SALE_GAMES.map((item) => <option key={item}>{item}</option>)}
            </select>
          </label>
          {languagesFor(batchGame).length > 1 && (
            <label style={labelStyle}>
              Language when the file does not say
              <select style={inputStyle} value={batchLanguage} onChange={(event) => setBatchLanguage(event.target.value)}>
                {languagesFor(batchGame).map((item) => <option key={item}>{item}</option>)}
              </select>
            </label>
          )}
          <button type="submit" disabled={saving} style={{ background: "#f4c95d", color: "#111", padding: 16, border: 0, borderRadius: 6, fontWeight: "bold", cursor: "pointer" }}>
            {saving ? "Saving..." : "List this batch"}
          </button>
        </form>
      </div>
    </main>
  );
}
