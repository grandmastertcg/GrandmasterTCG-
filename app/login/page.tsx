"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase-browser";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function login(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setMessage(error.message);
        return;
      }
      const token = data.session?.access_token;
      if (!token) {
        setMessage("Check your email to confirm this account, then sign in.");
        return;
      }
      const access = await fetch("/api/admin/check", { headers: { Authorization: `Bearer ${token}` } });
      const body = access.ok ? await access.json() : { admin: false };
      router.push(body.admin ? "/admin" : "/account");
    } catch {
      setMessage("Login failed. Check your configuration.");
    } finally {
      setLoading(false);
    }
  }

  async function forgot() {
    if (!email) {
      setMessage("Enter your email address first.");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`
    });
    setMessage(error ? error.message : "Password reset email sent.");
    setLoading(false);
  }

  return (
    <main className="join">
      <section className="join-card">
        <a href="/">GrandmasterTCG</a>
        <h1>Sign in</h1>
        <p>Buy from the market, or open your account to sell cards.</p>
        <form onSubmit={login}>
          <label>
            Email
            <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
          </label>
          <label>
            Password
            <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} required />
          </label>
          <button type="submit" disabled={loading}>{loading ? "Signing in..." : "Sign in"}</button>
        </form>
        {message && <p className="join-error" role="status">{message}</p>}
        <p><button className="text-btn" type="button" onClick={forgot}>Forgot password</button></p>
        <p>New here? <a href="/signup">Create an account</a></p>
      </section>
    </main>
  );
}
