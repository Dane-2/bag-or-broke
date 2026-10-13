/* global BigInt */
// Central finance calculations — JS port of bobupdates/finance_reference.py
// (BOB-CENTRAL-FINANCE-20261013-v1). Pure functions; integer cents and bps throughout.
import financeConfig from './config/finance.json';
import { BPS, applyBps, divHalfUp, nonneg, roundHalfUp } from './money';

export const TAX_RATE_BPS = financeConfig.tax.annual_rate_bps; // 2000
export const SALE_GAIN_TAX_BPS = financeConfig.tax.ordinary_sale_gain_rate_bps; // 2000
export const LATE_TAX_BPS = financeConfig.tax.initial_late_bps; // 500
export const LATE_TAX_CAP_BPS = financeConfig.tax.late_cap_bps_original_overdue; // 2500
export const MIN_PRINCIPAL_BPS = financeConfig.ordinary_debt.minimum_principal_bps; // 1000
export const INVESTMENT_MIN_CASH_BPS = financeConfig.ordinary_purchase_min_cash_bps; // 5000
export const ASSET_ADVANCE_LTV_BPS = financeConfig.asset_advance_ltv_bps; // 5000
export const CREDIT_FLOOR = financeConfig.credit_floor;
export const CREDIT_CEILING = financeConfig.credit_ceiling;
export const OPENING_CREDIT_SCORE = financeConfig.opening_credit_score;
export const LAP_AWARD_CENTS = financeConfig.lap_award_cents;
export const SCHOLARSHIP_CENTS = financeConfig.starting_scholarship_cents;
export const REP_VALUE_CENTS = financeConfig.final_score.rep_value_cents;
export const CAREER_VALUE_CENTS = financeConfig.final_score.career_value_cents;
export const LEGAL_ASSIST_BPS = financeConfig.legal_support.assistance_bps;
export const LEGAL_CAP_CENTS = financeConfig.legal_support.cap_per_matter_cents;
export const STARTING_TIERS = financeConfig.starting_tiers;

const CHECKPOINT = financeConfig.credit_checkpoint;

// ---------------------------------------------------------------------------
// Credit bands and borrowing capacity
// ---------------------------------------------------------------------------

export function band(score) {
  if (!(score >= CREDIT_FLOOR && score <= CREDIT_CEILING)) {
    throw new Error('score outside game range');
  }
  const b = financeConfig.credit_bands.find(x => x.score_min <= score && score <= x.score_max);
  return {
    rateBps: b.ordinary_rate_bps,
    unsecuredLimit: b.unsecured_limit_cents,
    creditBonus: b.final_credit_bonus_cents,
    scoreMin: b.score_min,
    scoreMax: b.score_max,
  };
}

/** Unsecured headroom: band limit less unsecured principal and accrued interest. FLOOR. */
export function availableCredit(score, principal, interest = 0, holds = []) {
  if (holds.length || score < 500) return 0;
  return Math.floor(nonneg(band(score).unsecuredLimit - principal - interest));
}

/** Advance against a retained asset: max(0, 50% of value - linked debt incl. interest). FLOOR. */
export function assetAdvance(value, linkedDebt, holds = []) {
  if (holds.length) return 0;
  return Math.floor(nonneg((value * ASSET_ADVANCE_LTV_BPS) / BPS - linkedDebt));
}

export function clampScore(score) {
  return Math.max(CREDIT_FLOOR, Math.min(CREDIT_CEILING, score));
}

/**
 * One credit checkpoint at the payment deadline.
 * current: all ordinary requirements paid; debtFree: no ordinary principal/interest left.
 * netReduction / basis: qualifying principal decline vs aggregate B for the extra +25.
 */
export function creditCheckpoint(score, current, debtFree, netReduction = 0, basis = 0) {
  let change;
  if (!current) {
    change = CHECKPOINT.missed;
  } else {
    const strong =
      debtFree || (basis > 0 && netReduction * BPS >= CHECKPOINT.large_reduction_bps * basis);
    change = CHECKPOINT.on_time + (strong ? CHECKPOINT.debt_free_or_large_reduction_extra : 0);
  }
  return clampScore(score + change);
}

// ---------------------------------------------------------------------------
// Ordinary interest and the principal target
// ---------------------------------------------------------------------------

/**
 * Exact interest numerator for one segment, in units of cents / (BPS * boardSize).
 * Keeping the numerator lets the ledger hold sub-cent accrual and round only on posting.
 */
export function interestNumerator(principal, rateBps, elapsedUnits) {
  return principal * rateBps * elapsedUnits;
}

/** Segments: [{ principal, rateBps, units }]; one final half-up rounding. */
export function ordinaryInterest(segments, boardSize = 40) {
  const numer = segments.reduce((s, x) => s + interestNumerator(x.principal, x.rateBps, x.units), 0);
  return divHalfUp(numer, BPS * boardSize);
}

/**
 * Principal target for one loan and lap.
 * draws: [{ amount, remainingUnits }] — remaining units of the originating lap at draw time.
 */
export function principalTarget({
  opening = 0,
  draws = [],
  reversedBasis = 0,
  creditPaid = 0,
  currentPrincipal = 0,
  olderDue = 0,
  boardSize = 40,
}) {
  const basisNumer = nonneg(
    opening * boardSize +
      draws.reduce((s, d) => s + d.amount * d.remainingUnits, 0) -
      reversedBasis * boardSize
  );
  const basis = divHalfUp(basisNumer, boardSize);
  const target = divHalfUp(basisNumer * MIN_PRINCIPAL_BPS, boardSize * BPS);
  const newDue = Math.min(nonneg(currentPrincipal - olderDue), nonneg(target - creditPaid));
  return { basis, target, newDue, totalPrincipalDue: olderDue + newDue };
}

// ---------------------------------------------------------------------------
// Taxes
// ---------------------------------------------------------------------------

/** Annual (per completed lap) tax. Business results combine and floor at zero. */
export function annualTax({ nil = 0, award = 0, cashEarnings = 0, contractGains = 0, businessProfits = [] } = {}) {
  const business = Math.max(0, businessProfits.reduce((s, x) => s + x, 0));
  const base = nil + award + cashEarnings + contractGains + business;
  if (base < 0) throw new Error('negative source category');
  return { base, tax: applyBps(base, TAX_RATE_BPS) };
}

export function createTaxBill({ id, lap, assessed, paid = 0, provisional = false }) {
  return {
    id,
    lap,
    assessed,
    paid,
    lateFees: 0,
    feesPaid: 0,
    originalOverdue: null,
    triggers: [],
    provisional,
  };
}

export const taxBillPrincipal = b => nonneg(b.assessed - b.paid);
export const taxBillCharges = b => nonneg(b.lateFees - b.feesPaid);
export const taxBillOwed = b => taxBillPrincipal(b) + taxBillCharges(b);

/** Apply one late charge per unique trigger; 5% of unpaid principal capped at 25% of original overdue. */
export function chargeTaxBill(bill, trigger) {
  if (bill.triggers.includes(trigger)) return { bill, charge: 0 };
  const originalOverdue = bill.originalOverdue === null ? taxBillPrincipal(bill) : bill.originalOverdue;
  const cap = applyBps(originalOverdue, LATE_TAX_CAP_BPS);
  const charge = Math.min(applyBps(taxBillPrincipal(bill), LATE_TAX_BPS), nonneg(cap - bill.lateFees));
  return {
    bill: {
      ...bill,
      originalOverdue,
      triggers: [...bill.triggers, trigger],
      lateFees: bill.lateFees + charge,
    },
    charge,
  };
}

/** Pay principal first, then charges. Returns the amount actually applied. */
export function payTaxBill(bill, amount) {
  if (amount < 0) throw new Error('negative payment');
  const a = Math.min(amount, taxBillOwed(bill));
  const principal = Math.min(a, taxBillPrincipal(bill));
  return {
    bill: { ...bill, paid: bill.paid + principal, feesPaid: bill.feesPaid + (a - principal) },
    applied: a,
  };
}

/** Genuine later adjustment; returns any overpaid principal to give back. */
export function adjustTaxBill(bill, newAssessed) {
  if (newAssessed < 0) throw new Error('negative tax');
  const giveBack = nonneg(bill.paid - newAssessed);
  return { bill: { ...bill, assessed: newAssessed, paid: bill.paid - giveBack }, giveBack };
}

// ---------------------------------------------------------------------------
// Sales, refunds and legal assistance
// ---------------------------------------------------------------------------

/**
 * Ordinary sale to the game. fractionBps = share of the holding sold (10000 = all).
 * Gain tax is reserved first, then linked debt is repaid, then the rest is cash.
 */
export function sale({ value, basis, debt = 0, fractionBps = BPS, available = 0, residualExit = false }) {
  if (!(fractionBps > 0 && fractionBps <= BPS)) throw new Error('invalid fraction');
  const full = fractionBps === BPS;
  const gross = applyBps(value, fractionBps);
  const soldBasis = applyBps(basis, fractionBps);
  const allocated = applyBps(debt, fractionBps);
  const tax = applyBps(nonneg(gross - soldBasis), SALE_GAIN_TAX_BPS);
  const pool = gross - tax;
  const gap = nonneg(allocated - pool);
  if (gap > available && !(full && residualExit)) throw new Error('cash contribution required');
  const contribution = full && residualExit ? 0 : gap;
  const debtPaid = Math.min(allocated, pool + contribution);
  const cashDelta = nonneg(pool - debtPaid) - contribution;
  return {
    gross,
    tax,
    debtPaid,
    cashDelta,
    contribution,
    residual: debt - debtPaid,
    valueLeft: value - gross,
    basisLeft: basis - soldBasis,
  };
}

/** Split a refund in the original cash/credit proportions, cumulatively (no cent farming). */
export function refundSplit({
  refund,
  originalCash,
  originalCredit,
  alreadyRefundedCash = 0,
  alreadyRefundedCredit = 0,
  unpaidOriginalPrincipal = 0,
}) {
  const total = originalCash + originalCredit;
  const prior = alreadyRefundedCash + alreadyRefundedCredit;
  if (total <= 0 || refund < 0 || prior + refund > total) throw new Error('refund exceeds remaining cost');
  const cashComponent = divHalfUp((prior + refund) * originalCash, total) - alreadyRefundedCash;
  const creditComponent = refund - cashComponent;
  const retire = Math.min(unpaidOriginalPrincipal, creditComponent);
  return {
    cash: cashComponent + creditComponent - retire,
    principalReduction: retire,
    cashComponent,
    creditComponent,
  };
}

/** Legal Support: 80% of cumulative eligible fees per matter, capped at $25,000, less already applied. */
export function legalAssistance(cumulativeEligibleFees, alreadyApplied = 0) {
  const total = Math.min(LEGAL_CAP_CENTS, applyBps(cumulativeEligibleFees, LEGAL_ASSIST_BPS));
  return total - alreadyApplied;
}

// ---------------------------------------------------------------------------
// Fixed contracts (consumed by the investment phase)
// ---------------------------------------------------------------------------

/** Exact premium * (1 + rate)^n for whole owned laps; float fallback for fractional laps. */
function compound(cents, rateBps, laps) {
  if (Number.isInteger(laps) && laps >= 0) {
    const num = BigInt(BPS + rateBps) ** BigInt(laps);
    const den = BigInt(BPS) ** BigInt(laps);
    const n = BigInt(cents) * num;
    const q = n / den;
    const r = n % den;
    return Number(r * BigInt(2) >= den ? q + BigInt(1) : q);
  }
  return roundHalfUp(cents * Math.pow(1 + rateBps / BPS, laps));
}

/** Cash-value life policy: premium * 1.03^owned_laps. */
export function policyValue(premium, ownedLaps, growthBps = 300) {
  return compound(premium, growthBps, ownedLaps);
}

/** Annuity terms locked at purchase. Progress and wait are measured in laps. */
export function buyAnnuity({ premium, rateBps, wait }, purchase) {
  const q = 1 + rateBps / BPS;
  const payment1 = roundHalfUp((premium * Math.pow(q, wait + 1)) / (q + 1));
  const v1 = compound(premium, rateBps, wait);
  const rest = v1 - payment1;
  return {
    premium,
    rateBps,
    wait,
    purchase,
    payment1,
    payment2: roundHalfUp(rest * q),
    remainingAtFirst: rest,
  };
}

export function annuityAt(terms, progress) {
  const t = progress - terms.purchase;
  const q = 1 + terms.rateBps / BPS;
  if (t < 0) throw new Error('before purchase');
  if (t < terms.wait) {
    return { cash: 0, asset: roundHalfUp(terms.premium * Math.pow(q, t)), earnings: 0 };
  }
  if (t < terms.wait + 1) {
    return {
      cash: terms.payment1,
      asset: roundHalfUp(terms.remainingAtFirst * Math.pow(q, t - terms.wait)),
      earnings: terms.payment1 - terms.premium / 2,
    };
  }
  return {
    cash: terms.payment1 + terms.payment2,
    asset: 0,
    earnings: terms.payment1 + terms.payment2 - terms.premium,
  };
}
