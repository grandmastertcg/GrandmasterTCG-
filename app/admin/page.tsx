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

      // Temporary access check. A server-side admin
      // authorization check is still required.
      setAuthorized(true);
      setLoading(false);
    }

    checkAccess();
  }, [router]);

  if (loading) {
    return <main>Checking login...</main>;
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
      <p>Product management coming soon.</p>

      <h2>Orders</h2>
      <p>Order management coming soon.</p>

      <h2>Stock</h2>
      <p>Inventory management coming soon.</p>
    </main>
  );
}
