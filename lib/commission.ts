export const COMMISSION_RATE = 0.02;
export const COMMISSION_CAP_PENCE = 10000;

/** 2% of one card's price, never more than £100. */
export function commissionOnSale(unitPence: number) {
  if (!Number.isInteger(unitPence) || unitPence <= 0) return 0;
  return Math.min(Math.round(unitPence * COMMISSION_RATE), COMMISSION_CAP_PENCE);
}

export function commissionForLine(unitPence: number, quantity: number) {
  if (!Number.isInteger(quantity) || quantity <= 0) return 0;
  return commissionOnSale(unitPence) * quantity;
}
