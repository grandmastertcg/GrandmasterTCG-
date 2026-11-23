"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase-browser";

export default function AdminPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);

  useEffect(() => {
    async function checkAccess() {
      const { data, error } = await supabase.auth.getUser();

      if (error || !data.user) {
        router.replace("/login");
        return;
      }

      const { data: sessionData, error: sessionError } =
  await supabase.auth.getSession();

if (sessionError || !sessionData.session) {
  router.replace("/login");
  return;
}

try {
  const response = await fetch("/api/admin/check", {
    method: "GET",
    headers: {
      Authorization: `Bearer ${sessionData.session.access_token}`,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    router.replace("/login");
    return;
  }

  setAuthorized(true);
  setLoading(false);
} catch {
  router.replace("/login");
}
    }

    checkAccess();
  }, [router]);

  if (loading) {
    return <main style={{ minHeight: "100vh", background: "#090d18", color: "#f5f7fb", padding: 40 }}>Checking login...</main>;
  }

  if (!authorized) {
    return null;
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#111",
        color: "#f4c95d",
        padding: 40,
        fontFamily: "Arial",
      }}
    >
      <h1>GrandmasterTCG Admin Dashboard</h1>
      <p>Welcome to your trading card shop.</p>

      <h2>Products</h2>
<a
  href="/admin/products/new"
  style={{
    display: "inline-block",
    background: "#f4c95d",
    color: "#111",
    padding: "14px 24px",
    borderRadius: 8,
    textDecoration: "none",
    fontWeight: "bold",
    marginTop: 12,
    marginBottom: 20,
  }}
>
  + Add New Trading Card
</a>

      <h2>Orders</h2>
      <p>Order management coming soon.</p>

      <h2>Stock</h2>
      <p>Inventory management coming soon.</p>
    </main>
  );
}
