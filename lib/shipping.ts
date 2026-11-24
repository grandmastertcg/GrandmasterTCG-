export const CARRIERS = ["Royal Mail", "Parcelforce", "Evri", "DPD", "UPS", "DHL", "FedEx", "Other"] as const;

const CARRIER_CODE: Record<string, string> = {
  "Royal Mail": "royal-mail",
  Parcelforce: "parcelforce",
  Evri: "evri",
  DPD: "dpd-uk",
  UPS: "ups",
  DHL: "dhl",
  FedEx: "fedex"
};

export function validTracking(value: string) {
  return /^[A-Za-z0-9][A-Za-z0-9 -]{4,39}$/.test(value.trim());
}

export function carrierTrackUrl(carrier: string | null, trackingNumber: string) {
  const number = encodeURIComponent(trackingNumber.trim());
  if (carrier === "Royal Mail") return `https://www.royalmail.com/track-your-item#/tracking-results/${number}`;
  if (carrier === "Parcelforce") return `https://www.parcelforce.com/track-trace?trackNumber=${number}`;
  if (carrier === "Evri") return `https://www.evri.com/track/parcel/${number}/details`;
  if (carrier === "DPD") return `https://www.dpd.co.uk/apps/tracking/?reference=${number}`;
  if (carrier === "UPS") return `https://www.ups.com/track?loc=en_GB&tracknum=${number}`;
  if (carrier === "DHL") return `https://www.dhl.com/gb-en/home/tracking.html?tracking-id=${number}&submit=1`;
  if (carrier === "FedEx") return `https://www.fedex.com/fedextrack/?trknbr=${number}`;
  return `https://www.17track.net/en/track?nums=${number}`;
}

export type ParcelScan = {
  time: string | null;
  description: string;
  location: string;
  status: string;
};

export async function lookupTracking(carrier: string | null, trackingNumber: string) {
  const key = process.env.LASTSCANNED_API_KEY;
  if (!key) return null;
  const url = new URL(`https://api.lastscanned.com/v1/track/${encodeURIComponent(trackingNumber.trim())}`);
  const code = carrier ? CARRIER_CODE[carrier] : "";
  if (code) url.searchParams.set("carrier", code);
  try {
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${key}` },
      cache: "no-store",
      signal: AbortSignal.timeout(8000)
    });
    if (!response.ok) return null;
    const body = await response.json();
    const events: ParcelScan[] = Array.isArray(body.events)
      ? body.events.map((event: { timestamp?: string; localTime?: string; description?: string; location?: string; status?: string }) => ({
        time: event.localTime || event.timestamp || null,
        description: String(event.description || "Scan"),
        location: String(event.location || ""),
        status: String(event.status || "")
      }))
      : [];
    return {
      status: String(body.statusDescription || body.status || ""),
      delivered: events.some((event) => event.status === "delivered") || String(body.status || "").toLowerCase() === "delivered",
      deliveredAt: events.find((event) => event.status === "delivered")?.time || null,
      events
    };
  } catch {
    return null;
  }
}

export function deliveryMoment(tracking: { delivered?: boolean; deliveredAt?: string | null; status: string; events: ParcelScan[] } | null) {
  if (!tracking) return null;
  const scan = tracking.events.find((event) => event.status === "delivered");
  const delivered = Boolean(scan) || tracking.delivered || tracking.status.toLowerCase() === "delivered";
  if (!delivered) return null;
  const parsed = scan?.time ? new Date(scan.time) : new Date();
  if (Number.isNaN(parsed.getTime()) || parsed.getTime() > Date.now()) return new Date();
  return parsed;
}
