export const CARRIERS = ["Royal Mail", "Parcelforce", "Evri", "DPD", "UPS", "DHL", "FedEx", "Other"] as const;

const CARRIER_CODE: Record<string, number> = {
  "Royal Mail": 11031,
  Parcelforce: 11033,
  Evri: 100331,
  DPD: 100010,
  UPS: 100002,
  DHL: 100001,
  FedEx: 100003
};

const STATUS_LABEL: Record<string, string> = {
  InfoReceived: "The courier has the parcel details",
  InTransit: "On its way",
  Expired: "The courier stopped updating this number",
  AvailableForPickup: "Ready to collect",
  OutForDelivery: "Out for delivery",
  DeliveryFailure: "The courier could not deliver it",
  Delivered: "Delivered",
  Exception: "The courier reported a problem",
  NotFound: "The courier has no scan for this number yet"
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

type TrackEvent = {
  time_iso?: string | null;
  description?: string | null;
  location?: string | null;
  stage?: string | null;
};

async function trackRequest(path: string, body: unknown) {
  const token = process.env.TRACK_17_TOKEN;
  if (!token) return null;
  const response = await fetch(`https://api.17track.net/track/v2.4/${path}`, {
    method: "POST",
    headers: { "17token": token, "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
    signal: AbortSignal.timeout(12000)
  });
  if (!response.ok) return null;
  return response.json() as Promise<{ data?: { accepted?: Array<{ track_info?: { latest_status?: { status?: string }; latest_event?: { time_iso?: string }; tracking?: { providers?: Array<{ events?: TrackEvent[] }> } } }> } }>;
}

export async function lookupTracking(carrier: string | null, trackingNumber: string) {
  const number = trackingNumber.trim();
  const code = carrier ? CARRIER_CODE[carrier] : undefined;
  const registered = await trackRequest("register", [code ? { number, carrier: code } : { number }]);
  if (!registered && !process.env.TRACK_17_TOKEN) return null;
  const info = await trackRequest("gettrackinfo", [code ? { number, carrier: code } : { number }]);
  const accepted = info?.data?.accepted?.[0];
  const track = accepted?.track_info;
  const latest = String(track?.latest_status?.status || "");
  const rawEvents: TrackEvent[] = (track?.tracking?.providers ?? []).flatMap((provider: { events?: TrackEvent[] }) => provider.events ?? []);
  const events: ParcelScan[] = rawEvents.map((event) => ({
    time: event.time_iso || null,
    description: String(event.description || "Scan"),
    location: String(event.location || ""),
    status: String(event.stage || "").toLowerCase()
  }));
  events.sort((left, right) => new Date(right.time || 0).getTime() - new Date(left.time || 0).getTime());
  const deliveredEvent = events.find((event) => event.status === "delivered");
  return {
    status: events[0]?.description || STATUS_LABEL[latest] || (process.env.TRACK_17_TOKEN ? "Waiting for the first courier scan" : ""),
    delivered: latest === "Delivered" || Boolean(deliveredEvent),
    deliveredAt: deliveredEvent?.time || (latest === "Delivered" ? track?.latest_event?.time_iso || null : null),
    events
  };
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
