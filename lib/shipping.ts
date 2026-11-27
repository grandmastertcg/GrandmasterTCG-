export const CARRIERS = ["Royal Mail", "Parcelforce", "Evri", "DPD", "UPS", "DHL", "FedEx", "Other"] as const;

export type PostageSize = {
  id: string;
  label: string;
  weight: string;
  onlinePence: number;
  counterPence: number;
};

/** Buyer pays the online price. The Post Office column is what the counter charges. */
export const POSTAGE_SIZES: PostageSize[] = [
  { id: "large-letter", label: "Large Letter", weight: "750g at a Post Office, or 1kg online", onlinePence: 290, counterPence: 345 },
  { id: "small-parcel", label: "Small Parcel", weight: "2kg", onlinePence: 375, counterPence: 470 },
  { id: "medium-parcel-2kg", label: "Medium Parcel (2kg)", weight: "2kg", onlinePence: 570, counterPence: 760 },
  { id: "medium-parcel-10kg", label: "Medium Parcel (10kg)", weight: "10kg", onlinePence: 755, counterPence: 960 }
];

export function postageSize(id: string | null | undefined) {
  return POSTAGE_SIZES.find((size) => size.id === id) ?? POSTAGE_SIZES[0];
}

/** A Large Letter can be no more than 25mm thick. */
export const LARGE_LETTER_MM = 25;

/** A raw card in a toploader, a sleeved card in a bundle, cardboard and a bag, and a graded slab. */
const RAW_MM = 3;
const SLEEVE_MM = 1;
const PACKING_MM = 3;
const GRADED_MM = 8;
const RAW_GRAMS = 8;
const SLEEVE_GRAMS = 2;
const PACKING_GRAMS = 20;
const GRADED_GRAMS = 70;
const SPECIAL_100G = 100;

export function bundleSize(value: number | null | undefined) {
  const size = Number(value);
  if (!Number.isInteger(size) || size < 1) return 1;
  return Math.min(size, 40);
}

/** Card value above this, for one seller, is sent Special Delivery Guaranteed by 1pm. */
export const INSURED_OVER_PENCE = 7500;

export const SPECIAL_DELIVERY = [
  { id: "g100", weight: "Up to 100g", pence: 1035 },
  { id: "g500", weight: "Up to 500g", pence: 1135 },
  { id: "kg1", weight: "Up to 1kg", pence: 1245 },
  { id: "kg2", weight: "Up to 2kg", pence: 1655 },
  { id: "kg10", weight: "Up to 10kg", pence: 2395 }
] as const;

export const EXTRA_COVER = [
  { overPence: 75000, addPence: 300, cover: "£1,000" },
  { overPence: 100000, addPence: 1000, cover: "£2,500" }
] as const;

export type ParcelCard = {
  postageSize?: string | null;
  quantity: number;
  unitPricePence: number;
  graded?: boolean;
  /** Cards inside one copy of the listing. A bundle is a sleeved stack, not one toploader per card. */
  cardsInListing?: number;
};

export type ParcelQuote = {
  pence: number;
  label: string;
  insured: boolean;
};

function specialDelivery(tierId: string, over100g: boolean, cardPence: number) {
  const bandId = tierId === "medium-parcel-10kg"
    ? "kg10"
    : tierId === "medium-parcel-2kg"
      ? "kg2"
      : tierId === "small-parcel" || over100g
        ? "g500"
        : "g100";
  const band = SPECIAL_DELIVERY.find((item) => item.id === bandId) ?? SPECIAL_DELIVERY[0];
  const extra = [...EXTRA_COVER].reverse().find((item) => cardPence > item.overPence);
  const cover = extra ? `, cover up to ${extra.cover}` : ", cover up to £750";
  return {
    pence: band.pence + (extra?.addPence ?? 0),
    label: `Special Delivery by 1pm, ${band.weight.toLowerCase()}${cover}`
  };
}

/** One parcel per seller. The shop chooses the size from thickness. Over £75 uses Special Delivery. */
export function parcelQuote(cards: ParcelCard[]): ParcelQuote {
  if (!cards.length) return { pence: 0, label: "Postage", insured: false };
  const cardPence = cards.reduce((sum, card) => sum + card.unitPricePence * card.quantity, 0);
  let thickness = 0;
  let grams = 0;
  let cardsInParcel = 0;
  for (const card of cards) {
    const copies = bundleSize(card.cardsInListing);
    const count = copies * card.quantity;
    cardsInParcel += count;
    if (card.graded) {
      thickness += count * GRADED_MM;
      grams += count * GRADED_GRAMS;
    } else if (copies > 1) {
      thickness += count * SLEEVE_MM;
      grams += count * SLEEVE_GRAMS;
    } else {
      thickness += count * RAW_MM;
      grams += count * RAW_GRAMS;
    }
  }
  if (cardsInParcel > 0) {
    thickness += PACKING_MM;
    grams += PACKING_GRAMS;
  }
  const tooThick = thickness > LARGE_LETTER_MM;
  const tier = postageSize(tooThick ? "small-parcel" : "large-letter");
  if (cardPence <= INSURED_OVER_PENCE) {
    return { pence: tier.onlinePence, label: tier.label, insured: false };
  }
  const insured = specialDelivery(tier.id, grams > SPECIAL_100G, cardPence);
  return { pence: insured.pence, label: insured.label, insured: true };
}

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
