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
    <main style={{ padding: 40 }}>
      <h1>GrandmasterTCG Password Reset</h1>
      <input
        type="password"
        placeholder="New password"
        value={password}
        onChange={e => setPassword(e.target.value)}
      />
      <button onClick={save}>Save Password</button>
      <p>{message}</p>
    </main>
  );
}
