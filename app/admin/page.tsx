"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase-browser";
import { gbp } from "@/lib/catalog";

type Transaction = {
  id: string;
  created: string;
  email: string | null;
  name: string | null;
  place: string;
  amountPence: number;
  currency: string;
  items: { name: string; quantity: number }[];
};

export default function AdminPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const { data, error: userError } = await supabase.auth.getUser();
      if (userError || !data.user) {
        router.replace("/login");
        return;
      }

      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !sessionData.session) {
        router.replace("/login");
        return;
      }

      const token = sessionData.session.access_token;
      const access = await fetch("/api/admin/check", {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store"
      });
      if (!access.ok) {
        router.replace("/login");
        return;
      }

      if (cancelled) return;
      setAuthorized(true);
      await loadTransactions(token);
      if (!cancelled) setLoading(false);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [router]);

  async function loadTransactions(token?: string) {
    setRefreshing(true);
    setError("");
    try {
      const sessionToken = token ?? (await supabase.auth.getSession()).data.session?.access_token;
      if (!sessionToken) {
        router.replace("/login");
        return;
      }
      const response = await fetch("/api/admin/transactions", {
        headers: { Authorization: `Bearer ${sessionToken}` },
        cache: "no-store"
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Transactions could not be loaded.");
      setTransactions(Array.isArray(body.transactions) ? body.transactions : []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Transactions could not be loaded.");
    } finally {
      setRefreshing(false);
    }
  }

  if (loading) {
    return <main className="desk"><p>Checking login...</p></main>;
  }

  if (!authorized) return null;

  return (
    <TransactionsScreen
      transactions={transactions}
      error={error}
      refreshing={refreshing}
      onRefresh={() => loadTransactions()}
    />
  );
}

function TransactionsScreen({
  transactions,
  error,
  refreshing,
  onRefresh
}: {
  transactions: Transaction[];
  error: string;
  refreshing: boolean;
  onRefresh: () => void;
}) {
  const total = transactions.reduce((sum, transaction) => sum + transaction.amountPence, 0);

  return (
    <main className="desk">
      <header className="desk-head">
        <div>
          <p className="desk-kicker">GrandmasterTCG</p>
          <h1>Transactions</h1>
          <p>Paid Stripe checkouts, newest first.</p>
        </div>
        <button type="button" onClick={onRefresh} disabled={refreshing}>
          {refreshing ? "Refreshing..." : "Refresh"}
        </button>
      </header>

      <section className="desk-stats">
        <div><span>Payments</span><strong>{transactions.length}</strong></div>
        <div><span>Taken</span><strong>{gbp(total)}</strong></div>
      </section>

      {error && <p className="desk-error" role="status">{error}</p>}

      {transactions.length === 0 && !error ? (
        <p className="desk-empty">No paid transactions yet. Completed checkouts will appear here.</p>
      ) : (
        <div className="desk-table">
          {transactions.map((transaction) => (
            <article key={transaction.id}>
              <div>
                <strong>{formatWhen(transaction.created)}</strong>
                <span>{transaction.name || "Customer"}</span>
                <span>{transaction.email || "No email"}</span>
                {transaction.place && <span>{transaction.place}</span>}
              </div>
              <ul>
                {transaction.items.length === 0 ? (
                  <li>Card details unavailable</li>
                ) : (
                  transaction.items.map((item, index) => (
                    <li key={`${transaction.id}-${index}`}>{item.quantity} × {item.name}</li>
                  ))
                )}
              </ul>
              <b>{transaction.currency === "gbp" ? gbp(transaction.amountPence) : `${(transaction.amountPence / 100).toFixed(2)} ${transaction.currency.toUpperCase()}`}</b>
            </article>
          ))}
        </div>
      )}
    </main>
  );
}

function formatWhen(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}
