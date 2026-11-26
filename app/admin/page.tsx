"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase-browser";
import { gbp } from "@/lib/catalog";

type RefundRequest = {
  id: string;
  sellerName: string;
  email: string | null;
  kind: string | null;
  reason: string | null;
  refundPence: number;
  carrier: string | null;
  trackingNumber: string | null;
  items: { name: string; quantity: number }[];
};

type Transaction = {
  id: string;
  created: string;
  email: string | null;
  name: string | null;
  place: string;
  amountPence: number;
  commissionPence: number | null;
  currency: string;
  items: { name: string; quantity: number }[];
};

export default function AdminPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [requests, setRequests] = useState<RefundRequest[]>([]);
  const [token, setToken] = useState("");
  const [notice, setNotice] = useState("");
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
      setToken(token);
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
      const refunds = await fetch("/api/admin/refunds", {
        headers: { Authorization: `Bearer ${sessionToken}` },
        cache: "no-store"
      });
      const refundBody = await refunds.json();
      if (refunds.ok) setRequests(Array.isArray(refundBody.requests) ? refundBody.requests : []);
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
      requests={requests}
      notice={notice}
      error={error}
      refreshing={refreshing}
      onRefresh={() => loadTransactions()}
      onDecide={async (id, action) => {
        setNotice("");
        setError("");
        const response = await fetch(`/api/admin/refunds/${id}`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ action })
        });
        const body = await response.json();
        if (!response.ok) {
          setError(body.error || "That refund could not be completed.");
          return;
        }
        setNotice(body.message || "Saved.");
        await loadTransactions(token);
      }}
    />
  );
}

function TransactionsScreen({
  transactions,
  requests,
  notice,
  error,
  refreshing,
  onRefresh,
  onDecide
}: {
  transactions: Transaction[];
  requests: RefundRequest[];
  notice: string;
  error: string;
  refreshing: boolean;
  onRefresh: () => void;
  onDecide: (id: string, action: "refund" | "release") => void;
}) {
  const total = transactions.reduce((sum, transaction) => sum + transaction.amountPence, 0);
  const commission = transactions.reduce((sum, transaction) => sum + (transaction.commissionPence ?? 0), 0);

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
        <div><span>Paid</span><strong>{gbp(total)}</strong></div>
        <div><span>Your 2% fee</span><strong>{gbp(commission)}</strong></div>
      </section>

      <section className="desk-table">
        <h2>Refunds and disputes</h2>
        <p>Read the buyer’s message. If the card did not arrive, or it is not the card they bought, refund them. A parcel with no tracking number is refunded on its own after 5 days. It only stays in this list if that refund has not gone through yet. If the seller has now added tracking, release the payout. The seller is then paid an hour after the buyer confirms, or 2 days after the courier shows the parcel delivered. A tracked parcel with no delivery scan is emailed to the buyer after 7 days, and paid 2 days later if the buyer stays silent.</p>
        {requests.length === 0 ? <p className="desk-empty">No open refund or dispute requests.</p> : requests.map((request) => (
          <article key={request.id}>
            <div>
              <strong>{request.kind === "refund" ? "Refund request" : request.kind === "unposted" ? "Not posted in 5 days" : request.kind === "oversold" ? "Sold out at payment" : "Dispute"}</strong>
              <span>{request.email || "No email"} · seller {request.sellerName}</span>
              <span>{request.reason}</span>
              {request.trackingNumber && <span>{request.carrier} {request.trackingNumber}</span>}
            </div>
            <ul>
              {request.items.map((item, index) => <li key={`${request.id}-${index}`}>{item.quantity} × {item.name}</li>)}
            </ul>
            <div>
              <b>{gbp(request.refundPence)}</b>
              <button type="button" onClick={() => onDecide(request.id, "refund")}>Refund the buyer</button>
              <button type="button" onClick={() => onDecide(request.id, "release")}>Release the payout</button>
            </div>
          </article>
        ))}
      </section>

      {notice && <p role="status">{notice}</p>}
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
              <b>
                {transaction.currency === "gbp" ? gbp(transaction.amountPence) : `${(transaction.amountPence / 100).toFixed(2)} ${transaction.currency.toUpperCase()}`}
                {transaction.commissionPence != null && <small>Your fee {gbp(transaction.commissionPence)}</small>}
              </b>
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
