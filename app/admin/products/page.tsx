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

  if (access === "checking") {
    return <main>Checking administrator access...</main>;
  }

  if (access === "denied") {
    return (
      <main>
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
            fontWeight: "bold",
            textDecoration: "none",
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
            <div
              key={product.id}
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
              <p>
                Condition: {product.condition || "-"}
              </p>

              <p>
                Price: £
                {(product.price_pence / 100).toFixed(2)}
              </p>

              <p>Stock: {product.stock}</p>
            </div>
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
