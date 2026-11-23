"use client";
import { useState } from "react";
import { createClient } from "@supabase/supabase-js";

export default function Page() {
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");

  async function save() {
    if (password.length < 8) {
      setMessage("Use at least 8 characters.");
      return;
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      setMessage("Open a fresh password reset email link.");
      return;
    }

    const { error } = await supabase.auth.updateUser({
      password
    });
    setMessage(error?.message || "Password updated!");
  }

  return (
    <main style={{
      minHeight: "100vh",
      background: "#090d18",
      color: "#f5f7fb",
      padding: "60px 20px",
      textAlign: "center"
    }}>
      <h1 style={{ color: "#f4c65e" }}>GrandmasterTCG Password Reset</h1>
      <div style={{ maxWidth: 350, margin: "40px auto", display: "grid", gap: 15 }}>
        <input
          type="password"
          placeholder="New password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          style={{ padding: 12, background: "#1a2740", color: "#f5f7fb", border: "1px solid #2a3853", borderRadius: 8 }}
        />
        <button
          onClick={save}
          style={{ padding: 14, background: "#f4c65e", color: "#111", border: 0, borderRadius: 8, fontWeight: 800, cursor: "pointer" }}
        >
          Save Password
        </button>
        <p role="status">{message}</p>
      </div>
    </main>
  );
}
