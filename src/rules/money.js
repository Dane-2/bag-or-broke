// Money helpers for the BOB central finance rules.
// All ledger amounts are integer cents; rates are integer basis points (bps).
// Rounding follows core.json: HALF_UP (away from zero) when posting, FLOOR for capacity.

export const BPS = 10000;

/** Dollars (number or numeric string, may contain commas) -> integer cents. */
export function toCents(dollars) {
  if (dollars === null || dollars === undefined || dollars === '') return 0;
  const n = typeof dollars === 'string' ? Number(dollars.replace(/[$,\s]/g, '')) : Number(dollars);
  if (!Number.isFinite(n)) return 0;
  return roundHalfUp(n * 100);
}

/** Integer cents -> dollars number (for legacy components and display). */
export function fromCents(cents) {
  return (cents || 0) / 100;
}

/** Round a finite number to an integer, half away from zero (Python ROUND_HALF_UP). */
export function roundHalfUp(x) {
  const sign = x < 0 ? -1 : 1;
  // Small epsilon absorbs binary noise like 2.4999999999 from 0.1-style inputs.
  return sign * Math.floor(Math.abs(x) + 0.5 + 1e-9);
}

/** Exact integer division n/d rounded half-up. n, d are integers, d > 0. */
export function divHalfUp(n, d) {
  if (d <= 0) throw new Error('divisor must be positive');
  const sign = n < 0 ? -1 : 1;
  const a = Math.abs(n);
  const q = Math.floor(a / d);
  const r = a - q * d;
  return sign * (r * 2 >= d ? q + 1 : q);
}

/** Exact integer division n/d floored toward zero for non-negative capacity math. */
export function divFloor(n, d) {
  if (d <= 0) throw new Error('divisor must be positive');
  return Math.floor(n / d);
}

/** cents * bps / 10000, rounded half-up. */
export function applyBps(cents, bps) {
  return divHalfUp(cents * bps, BPS);
}

export function nonneg(x) {
  return Math.max(0, x);
}

/** "$12,345" or "$12,345.67" (cents shown only when present). */
export function formatCents(cents, { sign = false } = {}) {
  const c = Math.round(cents || 0);
  const neg = c < 0;
  const abs = Math.abs(c);
  const whole = Math.floor(abs / 100);
  const frac = abs % 100;
  const body = `$${whole.toLocaleString('en-US')}${frac ? `.${String(frac).padStart(2, '0')}` : ''}`;
  if (neg) return `-${body}`;
  return sign && c > 0 ? `+${body}` : body;
}
