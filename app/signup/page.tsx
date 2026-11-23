"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase-browser";

export default function SignupPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function signup(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { display_name: name.trim() },
          emailRedirectTo: `${window.location.origin}/account`
        }
      });
      if (error) {
        setMessage(error.message);
        return;
      }
      if (data.session) router.push("/account");
      else setMessage("Account created. Check your email to confirm it, then sign in.");
    } catch {
      setMessage("Account could not be created.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="join">
      <section className="join-card">
        <a href="/">GrandmasterTCG</a>
        <h1>Create an account</h1>
        <p>Use it to buy cards and to list cards you want to sell.</p>
        <form onSubmit={signup}>
          <label>
            Display name
            <input value={name} onChange={(event) => setName(event.target.value)} minLength={2} maxLength={40} required />
          </label>
          <label>
            Email
            <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
          </label>
          <label>
            Password
            <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} minLength={8} required />
          </label>
          <button type="submit" disabled={loading}>{loading ? "Creating account..." : "Create account"}</button>
        </form>
        {message && <p className="join-error" role="status">{message}</p>}
        <p>Already registered? <a href="/login">Sign in</a></p>
      </section>
    </main>
  );
}
