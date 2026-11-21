"use client";

import { useState } from "react";
import { supabase } from "../../../../lib/supabase-browser";

export default function AddProductPage() {
  const [name, setName] = useState("");
  const [game, setGame] = useState("Pokémon");
  const [cardSet, setSetName] = useState("");
  const [cardNumber, setCardNumber] = useState("");
  const [rarity, setRarity] = useState("");
  const [condition, setCondition] = useState("Near Mint");
  const [price, setPrice] = useState("");
  const [stock, setStock] = useState("1");
  const [imageUrl, setImageUrl] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

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
          set_name: cardset,
          card_number: cardNumber,
          rarity,
          condition,
          price,
          stock: Number(stock),
          image_url: imageUrl,
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
              onChange={e => setGame(e.target.value)}
            >
              <option>Pokémon</option>
              <option>Yu-Gi-Oh!</option>
              <option>One Piece</option>
              <option>Disney Lorcana</option>
              <option>Magic: The Gathering</option>
              <option>Other</option>
            </select>
          </label>

          <label style={labelStyle}>
            Set Name
            <input
              style={inputStyle}
              Value={cardSet}]
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
              <option>Near Mint</option>
              <option>Lightly Played</option>
              <option>Moderately Played</option>
              <option>Heavily Played</option>
              <option>Damaged</option>
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
            Card Image URL
            <input
              style={inputStyle}
              type="url"
              value={imageUrl}
              onChange={e => setImageUrl(e.target.value)}
              placeholder="https://example.com/card.jpg"
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
      </div>
    </main>
  );
}
