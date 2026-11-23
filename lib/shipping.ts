export const CARRIERS = ["Royal Mail", "Parcelforce", "Evri", "DPD", "UPS", "DHL", "FedEx", "Other"] as const;

export function validTracking(value: string) {
  return /^[A-Za-z0-9][A-Za-z0-9 -]{4,39}$/.test(value.trim());
}
