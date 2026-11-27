export const COMMISSION_RATE = 0.02;
export const COMMISSION_CAP_PENCE = 10000;

/** 2% of the card prices in one basket, never more than £100. Postage is not included. */
export function commissionOnBasket(cardPence: number) {
  if (!Number.isInteger(cardPence) || cardPence <= 0) return 0;
  return Math.min(Math.round(cardPence * COMMISSION_RATE), COMMISSION_CAP_PENCE);
}

/** Fee for a basket that contains only this card. */
export function commissionOnSale(unitPence: number) {
  return commissionOnBasket(unitPence);
}

/** Split one basket fee across weights. The shares add up to the fee. */
export function splitCommission(feePence: number, weights: number[]) {
  if (!Number.isInteger(feePence) || feePence <= 0) return weights.map(() => 0);
  const safe = weights.map((weight) => (Number.isInteger(weight) && weight > 0 ? weight : 0));
  const total = safe.reduce((sum, weight) => sum + weight, 0);
  if (total <= 0) return weights.map(() => 0);
  const shares = safe.map((weight) => Math.floor((weight * feePence) / total));
  let leftover = feePence - shares.reduce((sum, share) => sum + share, 0);
  const order = safe.map((weight, index) => ({ index, weight })).sort((a, b) => b.weight - a.weight);
  for (const entry of order) {
    if (leftover <= 0) break;
    if (entry.weight <= 0) continue;
    shares[entry.index] += 1;
    leftover -= 1;
  }
  return shares;
}
