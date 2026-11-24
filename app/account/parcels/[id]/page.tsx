"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase-browser";

type Scan = { time: string | null; description: string; location: string; status: string };
type Parcel = {
  id: string;
  role: "sale" | "purchase";
  sellerName: string;
  shipTo: string;
  carrier: string | null;
  trackingNumber: string;
  shippedAt: string | null;
  receivedAt: string | null;
  courierUrl: string;
  status: string;
  events: Scan[];
  items: { name: string; quantity: number }[];
};

export default function ParcelTrackingPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const [parcel, setParcel] = useState<Parcel | null>(null);
  const [message, setMessage] = useState("Checking your account...");

  useEffect(() => {
    const id = params.id;
    if (!id) return;
    supabase.auth.getSession().then(async ({ data }) => {
      const session = data.session;
      if (!session) {
        router.replace("/login");
        return;
      }
      const response = await fetch(`/api/account/shipments/${id}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
        cache: "no-store"
      });
      const body = await response.json();
      if (!response.ok) {
        setMessage(body.error || "This parcel could not be opened.");
        return;
      }
      setParcel(body);
      setMessage("");
    });
  }, [params.id, router]);

  if (!parcel) {
    return <main className="account"><p>{message}</p><p><a href="/account">Back to your account</a></p></main>;
  }

  const latest = parcel.events[0];
  const where = parcel.status
    || (latest ? [latest.description, latest.location].filter(Boolean).join(" · ") : "")
    || (parcel.receivedAt ? "The buyer confirmed this parcel arrived." : `Posted with ${parcel.carrier || "the courier"}`);

  return (
    <main className="account">
      <header className="account-top">
        <div>
          <a href="/account">Your account</a>
          <h1>Track parcel</h1>
          <p>{parcel.role === "sale" ? "You are the seller." : `Sold by ${parcel.sellerName}.`} {parcel.carrier} {parcel.trackingNumber}</p>
        </div>
      </header>
      <section className="account-panel parcel-panel">
        <h2>Where it is</h2>
        <p className="track-where">{parcel.status || where}</p>
        {latest?.location && <p>{latest.location}</p>}
        <p>
          <a href={parcel.courierUrl} target="_blank" rel="noreferrer">Open {parcel.carrier || "courier"} tracking</a>
        </p>
        {parcel.events.length > 0 ? (
          <ol className="track-list">
            {parcel.events.map((event, index) => (
              <li key={`${event.time}-${index}`}>
                <strong>{event.description}</strong>
                <span>{[event.location, event.time ? new Date(event.time).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : ""].filter(Boolean).join(" · ")}</span>
              </li>
            ))}
          </ol>
        ) : (
          <p>The live scans are on the courier’s page for this tracking number. The same page is there for the buyer and the seller.</p>
        )}
      </section>
      <section className="account-panel parcel-panel">
        <h2>This parcel</h2>
        <p>{parcel.items.map((item) => `${item.quantity} × ${item.name}`).join(", ") || "Cards"}</p>
        {parcel.shippedAt && <p>Posted {new Date(parcel.shippedAt).toLocaleString("en-GB", { day: "numeric", month: "long", year: "numeric" })}.</p>}
        {parcel.shipTo && <p>Ship to {parcel.shipTo}</p>}
      </section>
    </main>
  );
}
