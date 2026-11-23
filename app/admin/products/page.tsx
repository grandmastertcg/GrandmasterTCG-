"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../../lib/supabase-browser";

type Product = {
  id: string;
  name: string;
  game: string;
  set_name?: string | null;
  condition?: string | null;
  price_pence: number;
  stock: number;
};

function ProductEditor({
  product,
  onSaved,
}: {
  product: Product;
  onSaved: (updated: Product) => void;
}) {
  const [price, setPrice] = useState(
    (product.price_pence / 100).toFixed(2)
  );
  const [stock, setStock] = useState(String(product.stock));
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  async function saveChanges() {
    setSaving(true);
    setMessage("");

    try {
      const priceText = price.trim();
      const stockText = stock.trim();

      if (!/^\d{1,7}(\.\d{1,2})?$/.test(priceText)) {
        throw new Error("Enter a valid price in pounds.");
      }

      if (!/^\d+$/.test(stockText)) {
        throw new Error("Enter a valid stock quantity.");
      }

      const [pounds, pennies = ""] = priceText.split(".");
      const pricePence =
        Number(pounds) * 100 +
        Number(pennies.padEnd(2, "0"));
      const quantity = Number(stockText);

      if (pricePence < 1 || pricePence > 999999999) {
        throw new Error("Invalid price.");
      }

      if (
        !Number.isSafeInteger(quantity) ||
        quantity < 0 ||
        quantity > 100000
      ) {
        throw new Error("Invalid stock quantity.");
      }

      const { data, error } =
        await supabase.auth.getSession();

      if (error || !data.session) {
        throw new Error("Please sign in again.");
      }

      const response = await fetch(
        `/api/admin/products/${encodeURIComponent(product.id)}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization:
              `Bearer ${data.session.access_token}`,
          },
          body: JSON.stringify({
            price_pence: pricePence,
            stock: quantity,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(
          result.error || "Unable to save changes."
        );
      }

      onSaved({
        ...product,
        ...result.product,
      });

      setPrice(
        (result.product.price_pence / 100).toFixed(2)
      );
      setStock(String(result.product.stock));
      setMessage("Changes saved successfully!");
    } catch (err) {
      setMessage(
        err instanceof Error
          ? err.message
          : "Something went wrong."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      style={{
        background: "#222",
        border: "1px solid #66552b",
        borderRadius: 10,
        padding: 20,
      }}
    >
      <h2>{product.name}</h2>
      <p>Game: {product.game}</p>
      <p>Set: {product.set_name || "-"}</p>
      <p>Condition: {product.condition || "-"}</p>

      <label style={{ display: "block", marginTop: 16 }}>
        Price (£)
        <input
          type="text"
          inputMode="decimal"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          style={inputStyle}
        />
      </label>

      <label style={{ display: "block", marginTop: 16 }}>
        Stock Quantity
        <input
          type="number"
          min="0"
          step="1"
          value={stock}
          onChange={(e) => setStock(e.target.value)}
          style={inputStyle}
        />
      </label>

      <button
        type="button"
        onClick={saveChanges}
        disabled={saving}
        style={{
          background: "#f4c95d",
          color: "#111",
          border: "none",
          padding: "14px 24px",
          borderRadius: 8,
          fontWeight: "bold",
          marginTop: 20,
          cursor: saving ? "wait" : "pointer",
          opacity: saving ? 0.6 : 1,
        }}
      >
        {saving ? "Saving..." : "Save Changes"}
      </button>

      {message && <p role="status">{message}</p>}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  display: "block",
  width: "100%",
  boxSizing: "border-box",
  padding: 12,
  marginTop: 8,
  background: "#333",
  color: "#fff",
  border: "1px solid #777",
  borderRadius: 6,
};

export default function ManageProductsPage() {
  const [access, setAccess] = useState("checking");
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;

    async function loadProducts() {
      try {
        const { data, error } =
          await supabase.auth.getSession();

        if (error || !data.session) {
          if (active) setAccess("denied");
          return;
        }

        const check = await fetch("/api/admin/check", {
          headers: {
            Authorization:
              `Bearer ${data.session.access_token}`,
          },
          cache: "no-store",
        });

        if (!check.ok) {
          if (active) setAccess("denied");
          return;
        }

        const permission = await check.json();

        if (permission.admin !== true) {
          if (active) setAccess("denied");
          return;
        }

        if (!active) return;
        setAccess("allowed");

        const response = await fetch("/api/products", {
          cache: "no-store",
        });

        if (!response.ok) {
          throw new Error("Unable to load products.");
        }

        const result = await response.json();

        const items = Array.isArray(result)
          ? result
          : result.products;

        if (!Array.isArray(items)) {
          throw new Error("Unexpected product data.");
        }

        if (active) setProducts(items);
      } catch {
        if (active) {
          setMessage("Unable to load products.");
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    loadProducts();

    return () => {
      active = false;
    };
  }, []);

  function updateProduct(updated: Product) {
    setProducts((current) =>
      current.map((product) =>
        product.id === updated.id ? updated : product
      )
    );
  }

  if (access === "checking") {
    return <main style={{ minHeight: "100vh", background: "#090d18", color: "#f5f7fb", padding: 40 }}>Checking administrator access...</main>;
  }

  if (access === "denied") {
    return (
      <main style={{ minHeight: "100vh", background: "#090d18", color: "#f5f7fb", padding: 40 }}>
        <h1>Administrator login required</h1>
        <a href="/login">Go to Login</a>
      </main>
    );
  }

  return (
    <main
      style={{
        background: "#111",
        color: "#f4c95d",
        minHeight: "100vh",
        padding: "40px 20px",
        fontFamily: "Arial, sans-serif",
      }}
    >
      <div style={{ maxWidth: 1000, margin: "auto" }}>
        <h1>Manage Trading Cards</h1>
        <p>GrandmasterTCG Product Management</p>

        <a
          href="/admin/products/new"
          style={{
            display: "inline-block",
            padding: 14,
            background: "#f4c95d",
            color: "#111",
            borderRadius: 8,
            textDecoration: "none",
            fontWeight: "bold",
            marginBottom: 24,
          }}
        >
          + Add New Trading Card
        </a>

        {loading && <p>Loading products...</p>}
        {message && <p role="alert">{message}</p>}

        {!loading &&
          !message &&
          products.length === 0 && (
            <p>No products found.</p>
          )}

        <div style={{ display: "grid", gap: 16 }}>
          {products.map((product) => (
            <ProductEditor
              key={product.id}
              product={product}
              onSaved={updateProduct}
            />
          ))}
        </div>

        <p style={{ marginTop: 30 }}>
          <a href="/admin" style={{ color: "#f4c95d" }}>
            Back to Dashboard
          </a>
        </p>
      </div>
    </main>
  );
}
