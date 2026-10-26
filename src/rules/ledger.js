// Player finance ledger for the companion app (BOB-DIGITAL-ASSEMBLY-20261013-v1).
//
// The ledger owns Available Cash, the Tax Bucket, ordinary loans, tax bills, the credit
// score and the board-progress clock. Every change goes through applyOp(state, op), which is
// pure: it returns a new state plus a result, or throws without changing anything.
// Repeating an op id with the same payload returns the original result; a different payload
// under the same id is rejected. Natural events (lap close, credit checkpoint, final snapshot)
// happen at most once regardless of op id.
import { BPS, divHalfUp, nonneg, formatCents } from './money';
import { scoreBreakdown } from './portfolio';
import {
  band, availableCredit, assetAdvance, creditCheckpoint, principalTarget, annualTax, sale,
  createTaxBill, chargeTaxBill, payTaxBill, adjustTaxBill, taxBillPrincipal, taxBillOwed,
  INVESTMENT_MIN_CASH_BPS, LAP_AWARD_CENTS, OPENING_CREDIT_SCORE, buyAnnuity, legalAssistance,
} from './finance';
import { RULESET_ID, BOARD_SIZE, boardSpace } from './index';
import { catalogEntry, isActivation, INVESTMENT_CATALOG, LUXURY_CATALOG } from './catalog';
import { classify, RESPONSE_EVIDENCE, EXTERNAL_SETBACKS, riskOutcome } from './reveal';
import authored from './config/authored_producers.json';
import nilTiers from './config/nil_tiers.json';
import { STARTING_CREDITS } from './coach';
import { ENABLED_VENTURES, PARTNER_REQUIREMENTS, GAIN_TAX_BPS } from './venture';
import {
  launchValue, continuingRate, isMarketProfile, marketDrawBps, eventResult, activationResult,
  assetValue, companyValueOf, policyBalance, policyLoanQuote, annuityCancelQuote, holdingsValue, eligibility,
  productionDiscount, currentLapNumber, isActive, HEALTH_ASSIST_LIMITS,
} from './holdings';
import {
  yellowCard, eligibleYellow, yellowChoices, defaultChoice, createsSponsorRelationship,
  licensableContent, unrecoveredLoss, SPONSOR_RELATIONSHIP_TURNS, TOKEN_EXCLUDED, RECOVERABLE_LOSSES,
} from './nil';
import {
  createCareer, family as careerFamily, path as careerPath, familyChoices, eligibleFamilies, pathAllowed,
  familyRewardedThisLap, preparedFor, pathForGroup, referralSaving, REFERRAL,
} from './career';
import {
  curveball, eligibleCurveballs, requirementMet, defaultResponse, scenarioRecord, optionalTasks,
  COMPONENT_LABELS, BUSINESS_COMPONENTS, LOSS_COMPONENTS, PORTAL, athleteActive,
} from './scenarios';

const JOURNAL_LIMIT = 300;
const RECEIPT_LIMIT = 500;

const clone = x => JSON.parse(JSON.stringify(x));

export class LedgerError extends Error {
  constructor(message, code = 'invalid') {
    super(message);
    this.code = code;
  }
}

// ---------------------------------------------------------------------------
// Construction and read-only views
// ---------------------------------------------------------------------------

/** NIL tier record: the approved annual valuation is display-only and never posts cash. */
export function nilTierRecord(roll) {
  const t = nilTiers.tiers.find(x => x.roll === Number(roll));
  return t ? { roll: t.roll, label: t.label, annualValuation: t.annual_nil_valuation_cents, rulesetId: nilTiers.ruleset_id } : null;
}

export function createLedger({ openingCash, totalLaps = 5, boardSize = BOARD_SIZE, landingEvents = true, nilTierId = null }) {
  return {
    rulesetId: RULESET_ID,
    boardSize,
    totalLaps,
    diceCount: null,
    progress: 0,
    cash: openingCash,
    taxBucket: 0,
    creditScore: OPENING_CREDIT_SCORE,
    loans: [],
    nextId: 1,
    taxIncome: {},
    taxBills: [],
    closedLaps: [],
    checkpoints: [],
    pendingDeadline: null,
    period: { lap: 1, newDraws: 0, principalRepaid: 0 },
    receipts: {},
    receiptOrder: [],
    journal: [],
    seq: 0,
    snapshot: null,
    // Holdings and once-per-game / once-per-lap allowances
    assets: [],
    opportunity: null,
    requireLanding: true,
    milestones: [],
    activationLaps: [],
    discountLaps: [],
    repFamilies: {},
    experienceTurns: {},
    purchases: [],
    // Own turns and yellow NIL opportunities
    turn: 0,
    yellow: null,
    yellowHistory: [],
    yellowStats: {},
    tasks: [],
    sponsorRelations: [],
    losses: [],
    y12Laps: [],
    career: createCareer(),
    // REP / Career points (noncash game value) and curveball state
    points: { rep: 0, career: 0, log: [] },
    rewardKeys: [],
    scenario: null,
    scenarioHistory: [],
    scenarioStats: {},
    scheduled: [],
    payables: [],
    restrictions: [],
    behaviors: [],
    incomeShare: null,
    portal: null,
    healthIncidentUntil: -1,
    creditChangedTurn: null,
    // landingEvents=false skips yellow/purple/red/blue draws (finance-only tests).
    settings: { familyExpansionContent: true, landingEvents },
    // Reveal evidence: one observation per decision and dimension; setbacks outside the player's control.
    observations: [],
    setbacks: [],
    // Authored record producers (authored_producers.json)
    receivables: [],
    inventoryOrders: [],
    prepayments: [],
    bookings: [],
    npcContributions: [],
    perks: [],
    academicRisk: false,
    coach: { credits: STARTING_CREDITS, cache: {} },
    // NIL tier (BOB-NIL-RESET-2026-01): valuation is separate from Available Cash.
    nilTier: nilTierRecord(nilTierId),
    nilPaidToDate: 0,
  };
}

export const finalProgress = s => s.totalLaps * s.boardSize;
export const completedLaps = s => Math.min(s.totalLaps, Math.floor(s.progress / s.boardSize));
export const inFinalWindow = s => s.progress >= finalProgress(s) && !s.snapshot;
export const isFinished = s => Boolean(s.snapshot);
export const position = s => s.progress % s.boardSize;
const denom = s => BPS * s.boardSize;

/** Lap whose tax record receives income now (the final lap during the final window). */
export function incomeLap(s) {
  return Math.min(s.totalLaps, Math.floor(s.progress / s.boardSize) + 1);
}

/**
 * One lap is one year (Fix Log v1.2 #6): the lap in progress and the year shown are the same
 * number. It advances when the player's roll crosses Start, and stays at the last year during
 * the final window. Derived from board progress only, so a restored save shows the same year.
 */
export const currentYear = incomeLap;

export const currentRateBps = s => band(s.creditScore).rateBps;

const sumAmounts = list => list.reduce((t, x) => t + x.amount, 0);
const accruedCents = (s, loan) => divHalfUp(loan.accrual, denom(s));

export function loanInterest(s, loan) {
  return sumAmounts(loan.interest) + accruedCents(s, loan);
}

export function loanBalance(s, loan) {
  return loan.principal + loanInterest(s, loan);
}

export function linkedDebt(s, assetId) {
  return s.loans.filter(l => l.assetId === assetId).reduce((t, l) => t + loanBalance(s, l), 0);
}

export function totalBorrowing(s) {
  return s.loans.reduce((t, l) => t + loanBalance(s, l), 0);
}

/** Event bills plus the minimum still owed on an income-share claim (counted once at Finish). */
export function eventLiabilities(s) {
  const bills = (s.payables || []).reduce((t, p) => t + p.amount, 0);
  const share = s.incomeShare ? Math.max(0, s.incomeShare.minTotal - s.incomeShare.paid) : 0;
  const prepaid = (s.prepayments || []).reduce((t, p) => t + p.unearned, 0);
  return bills + share + prepaid;
}

export const displayRep = s => Math.max(0, s.points.rep);

/**
 * Pressure display (no fee): obligations due before the next roll vs Available Cash, and
 * optional task slots in use. Steady below 50%, Tight 50-100%, Strained above.
 */
export function pressure(s) {
  const debtDue = requiredPayment(s).total;
  const taxDue = s.taxBills.filter(b => !b.provisional).reduce((t, b) => t + taxBillOwed(b), 0);
  const billsDue = (s.payables || []).filter(p => p.amount > 0 && p.dueTurn <= s.turn + 1).reduce((t, p) => t + p.amount, 0);
  const due = debtDue + taxDue + billsDue;
  let financial = 'steady';
  if (due > 0 && s.cash <= 0) financial = 'strained';
  else if (due > 0) financial = due / s.cash > 1 ? 'strained' : due / s.cash >= 0.5 ? 'tight' : 'steady';
  const overdue = requiredPayment(s).overdue > 0 || (s.payables || []).some(p => p.amount > 0 && p.overdue) ||
    s.taxBills.some(b => b.originalOverdue !== null && taxBillOwed(b) > 0);
  const slots = (s.tasks || []).filter(t => t.status === 'open').reduce((t, x) => t + x.slots, 0);
  const commitment = slots <= 1 ? 'light' : slots === 2 ? 'busy' : slots === 3 ? 'full' : 'overloaded';
  return { due, financial, overdue, slots, commitment };
}

export function taxesOwed(s) {
  return s.taxBills.reduce((t, b) => t + taxBillOwed(b), 0);
}

/** Amounts already posted and due at the next deadline (interest + principal markers). */
export function requiredPayment(s) {
  // Only amounts posted at a lap close are required; interest settled early during the
  // current lap is owed but not due until that lap closes.
  const lastClosed = s.closedLaps.length ? Math.max(...s.closedLaps) : 0;
  const lines = [];
  s.loans.forEach(l => {
    l.interest.forEach(e => e.amount > 0 && e.lap <= lastClosed && lines.push({ loanId: l.id, kind: 'interest', ...e }));
    l.markers.forEach(m => m.amount > 0 && lines.push({ loanId: l.id, kind: 'principal', ...m }));
  });
  const interest = lines.filter(x => x.kind === 'interest').reduce((t, x) => t + x.amount, 0);
  const principal = lines.filter(x => x.kind === 'principal').reduce((t, x) => t + x.amount, 0);
  const overdue = lines.filter(x => x.overdue).reduce((t, x) => t + x.amount, 0);
  return { interest, principal, total: interest + principal, overdue, lines };
}

/** Restrictions on new borrowing, each with a plain-language reason. */
export function holds(s) {
  const out = [];
  if (inFinalWindow(s)) out.push({ code: 'final', message: 'The game has reached its final lap. New borrowing is closed.' });
  if (requiredPayment(s).overdue > 0) {
    out.push({ code: 'delinquent', message: 'A required debt payment is overdue. Pay it to borrow again.' });
  }
  if (s.taxBills.some(b => b.originalOverdue !== null && taxBillOwed(b) > 0)) {
    out.push({ code: 'tax', message: 'An overdue tax bill is unpaid. Pay it to borrow again.' });
  }
  if (s.loans.some(l => l.residualExit && loanBalance(s, l) > 0)) {
    out.push({ code: 'residual', message: 'Debt left over from selling an asset below its loan must be repaid first.' });
  }
  if ((s.payables || []).some(p => p.amount > 0 && p.overdue)) {
    out.push({ code: 'payable', message: 'An overdue event bill is unpaid. Pay it in Finance to borrow again.' });
  }
  if (s.creditScore < 500) out.push({ code: 'score', message: 'A credit score below 500 blocks ordinary borrowing.' });
  return out;
}

export function unsecuredUsage(s) {
  const loans = s.loans.filter(l => l.kind === 'unsecured');
  return {
    principal: loans.reduce((t, l) => t + l.principal, 0),
    interest: loans.reduce((t, l) => t + loanInterest(s, l), 0),
  };
}

export function availableUnsecured(s) {
  const u = unsecuredUsage(s);
  return availableCredit(s.creditScore, u.principal, u.interest, holds(s));
}

/** Estimated principal target for a new draw if the lap closed with no repayment. */
function estimatedMinimum(s, amount) {
  const remaining = s.boardSize - position(s);
  const interest = divHalfUp(amount * currentRateBps(s) * remaining, denom(s));
  const principal = divHalfUp(amount * remaining * 1000, s.boardSize * BPS);
  return { interest, principal, total: interest + principal };
}

/** Quote a purchase. kind: 'investment' (secured, >= 50% cash) or 'luxury' (unsecured credit). */
export function quoteBuy(s, { kind, price, cashPart, cashOnly = false, minCashBps = INVESTMENT_MIN_CASH_BPS }) {
  const errors = [];
  const cp = Math.max(0, Math.min(price, cashPart));
  const borrow = price - cp;
  const minCash = cashOnly ? price : kind === 'investment' ? Math.ceil((price * minCashBps) / BPS) : 0;
  if (isFinished(s)) errors.push('Your game is finished.');
  if (inFinalWindow(s)) errors.push('New purchases are closed after the final lap.');
  if (cp < minCash) {
    errors.push(cashOnly ? 'This card is cash only.' : `Pay at least ${formatCents(minCash)} in cash.`);
  }
  if (cp > s.cash) errors.push('Not enough Available Cash.');
  let available = null;
  if (borrow > 0) {
    const h = holds(s);
    if (kind === 'luxury') {
      available = availableUnsecured(s);
      if (borrow > available) errors.push(h.length ? h[0].message : 'That is more than your available credit.');
    } else if (h.length) {
      errors.push(h[0].message);
    }
  }
  return {
    kind,
    price,
    cashPart: cp,
    borrow,
    minCash,
    rateBps: currentRateBps(s),
    availableCredit: kind === 'luxury' ? (available ?? availableUnsecured(s)) : null,
    estimatedMinimum: borrow > 0 ? estimatedMinimum(s, borrow) : null,
    cashAfter: s.cash - cp,
    errors,
    ok: errors.length === 0,
  };
}

/** Quote an ordinary sale of an asset back to the game. */
export function quoteSell(s, { assetId, value, basis, residualExit = false }) {
  const debt = linkedDebt(s, assetId);
  try {
    return { ok: true, debt, ...sale({ value, basis, debt, available: Math.max(0, s.cash), residualExit }) };
  } catch (e) {
    return { ok: false, debt, error: 'The sale does not cover the linked loan. Sell with a residual exit instead.' };
  }
}

export function quoteAdvance(s, { assetId, value }) {
  const asset = s.assets.find(a => a.id === assetId);
  const v = asset ? assetValue(s, asset) : value;
  const debt = linkedDebt(s, assetId);
  const h = holds(s);
  return { max: assetAdvance(v, debt, h), linkedDebt: debt, holds: h, rateBps: currentRateBps(s), value: v };
}

/** Assets that can secure an advance: owned businesses, properties and market positions. */
export function advanceableAssets(s) {
  return s.assets.filter(a => {
    if (!isActive(a) || !(a.holding === 'growth' || a.holding === 'market')) return false;
    const entry = catalogEntry(a.cardId);
    return entry && entry.borrowRoute === 'central_secured_50_percent_ltv' && assetValue(s, a) > 0;
  });
}

/** Whether the current landing lets the player buy from this menu. */
export function landingStatus(s, entry) {
  if (!s.requireLanding) return { ok: true };
  const need = entry && entry.kind === 'luxury' ? 'diamond' : 'green';
  const o = s.opportunity;
  if (o && !o.used && o.category === need) return { ok: true };
  if (o && o.used && o.category === need) return { ok: false, reason: 'You already used this landing. Roll to your next space.' };
  return { ok: false, reason: need === 'diamond' ? 'Land on a diamond space to shop.' : 'Land on a green space to invest.' };
}

function priceFor(s, entry, optionBps = BPS) {
  if (!entry) return { price: 0, discount: 0 };
  const scaled = entry.entryOptionsBps ? divHalfUp(entry.price * optionBps, BPS) : entry.price;
  let discount = entry.kind === 'luxury' ? Math.min(scaled, productionDiscount(s, entry)) : 0;
  // Sports mentoring referral: 5% off the Youth Sports clinic delivery (capped), used once.
  if (entry.id === 'YSH_CLINIC' && s.career && s.career.referral && !s.career.referral.used) {
    discount = referralSaving(scaled);
  }
  return { price: scaled - discount, discount };
}

const fundingKind = entry => (entry.kind === 'luxury' || isActivation(entry) ? 'luxury' : 'investment');

/** Everything the purchase screen needs: price, eligibility, landing and funding. */
export function quoteAcquire(s, { entryId, cashPart, targetId = null, optionBps = BPS }) {
  const entry = catalogEntry(entryId);
  const el = eligibility(s, entry, { targetId });
  const landing = landingStatus(s, entry);
  const { price, discount } = priceFor(s, entry, optionBps);
  const funding = quoteBuy(s, {
    kind: fundingKind(entry || {}),
    price,
    cashPart: cashPart ?? price,
    cashOnly: Boolean(entry && entry.cashOnly),
    minCashBps: entry ? entry.minCashBps : INVESTMENT_MIN_CASH_BPS,
  });
  const errors = [...(landing.ok ? [] : [landing.reason]), ...(el.ok ? [] : [el.reason]), ...funding.errors];
  return { entry, price, discount, eligibility: el, landing, funding, errors: [...new Set(errors)], ok: errors.length === 0 };
}

// ---------------------------------------------------------------------------
// Internal mutation helpers (operate on a cloned draft)
// ---------------------------------------------------------------------------

function log(d, entry) {
  d.seq += 1;
  d.journal.push({ seq: d.seq, progress: d.progress, ...entry });
  if (d.journal.length > JOURNAL_LIMIT) d.journal.splice(0, d.journal.length - JOURNAL_LIMIT);
}

function income(d, lap) {
  if (!d.taxIncome[lap]) d.taxIncome[lap] = { nil: 0, award: 0, cashEarnings: 0, contractGains: 0, businessProfits: [] };
  return d.taxIncome[lap];
}

function assertActive(d) {
  if (d.snapshot) throw new LedgerError('Your game is finished. The final result is locked.', 'finished');
}

function openLoan(d, { kind, assetId = null, label, amount }) {
  const loan = {
    id: `L${d.nextId++}`,
    kind,
    assetId,
    label,
    principal: amount,
    accrual: 0,
    interest: [],
    markers: [],
    lapOpening: 0,
    lapDraws: [{ amount, remainingUnits: d.boardSize - position(d) }],
    lapReversed: 0,
    lapPrincipalPaid: 0,
    residualExit: false,
    openedAt: d.progress,
  };
  d.loans.push(loan);
  d.period.newDraws += amount;
  return loan;
}

function drawOnLoan(d, loan, amount) {
  loan.principal += amount;
  loan.lapDraws.push({ amount, remainingUnits: d.boardSize - position(d) });
  d.period.newDraws += amount;
}

function accrueAll(d, units) {
  const rate = currentRateBps(d);
  d.loans.forEach(l => {
    l.accrual += l.principal * rate * units;
  });
}

function postAccrual(d, loan, lap) {
  const cents = divHalfUp(loan.accrual, denom(d));
  loan.accrual = 0;
  if (cents > 0) loan.interest.push({ lap, amount: cents, overdue: false });
  return cents;
}

/** Recompute (or create) the tax bill for a lap whose record is already closed. */
function rebill(d, lap) {
  const { tax } = annualTax(income(d, lap));
  const existing = d.taxBills.find(b => b.lap === lap);
  if (existing) {
    const { bill, giveBack } = adjustTaxBill(existing, tax);
    Object.assign(existing, bill);
    d.cash += giveBack;
  } else if (tax > 0) {
    d.taxBills.push(createTaxBill({ id: `tax-${lap}`, lap, assessed: tax, provisional: lap === d.totalLaps }));
  }
}

function recordLap(d) {
  // Receipts posted exactly at a boundary, before that lap closes, belong to the closing lap.
  const atBoundary = d.progress > 0 && d.progress % d.boardSize === 0;
  const closing = d.progress / d.boardSize;
  return atBoundary && !d.closedLaps.includes(closing) ? closing : incomeLap(d);
}

function recordIncome(d, cls, amount) {
  if (amount === 0) return;
  const lap = recordLap(d);
  if (cls === 'business') income(d, lap).businessProfits.push(amount);
  else income(d, lap)[cls] += amount;
  if (d.closedLaps.includes(lap)) rebill(d, lap);
}

function closeLap(d, lap) {
  if (d.closedLaps.includes(lap)) return null;
  // 4. Lap award, recognized as taxable income for this lap.
  d.cash += LAP_AWARD_CENTS;
  income(d, lap).award += LAP_AWARD_CENTS;

  // Boundary value changes: settle growth assets once, luxury resale declines once,
  // and companions owe care for the next playable lap.
  let resaleDecline = 0;
  d.assets.forEach(a => {
    if (!isActive(a)) return;
    if (a.holding === 'growth') {
      a.anchorValue = assetValue(d, a);
      a.anchorProgress = d.progress;
    } else if (a.holding === 'lux_good' && a.acquiredAt < d.progress && a.declineBps > 0) {
      const next = divHalfUp(a.resale * (BPS - a.declineBps), BPS);
      resaleDecline += a.resale - next;
      a.resale = next;
    } else if (a.holding === 'companion' && lap < d.totalLaps && !a.pendingCare) {
      a.pendingCare = { lap: lap + 1, amount: a.renewalCare };
    }
    // Authored: simulated partners of a 35% Youth Sports stake miss one operating contribution.
    const npc = authored.npc_partner;
    if (a.holding === 'growth' && npc.applies_to.includes(a.cardId) && (a.ownershipBps ?? BPS) < BPS &&
        !a.npcOverdueRecorded && d.progress - a.acquiredAt >= d.boardSize) {
      const budget = divHalfUp(assetValue(d, a) * npc.operating_budget_bps_of_company_value, BPS);
      const partnerShare = BPS - (a.ownershipBps ?? BPS);
      d.npcContributions.push({ id: `NPC${d.nextId++}`, assetId: a.id, shortfall: divHalfUp(budget * partnerShare, BPS), overdueUntilTurn: d.turn + npc.overdue_for_own_turns, satisfied: false });
      a.npcOverdueRecorded = true;
    }
  });

  // 5. Post interest and principal markers; extra charge on older overdue tax bills.
  let interestPosted = 0;
  let principalDue = 0;
  let basis = 0;
  d.loans.forEach(l => {
    interestPosted += postAccrual(d, l, lap);
    const olderDue = sumAmounts(l.markers);
    const t = principalTarget({
      opening: l.lapOpening,
      draws: l.lapDraws,
      reversedBasis: l.lapReversed,
      creditPaid: l.lapPrincipalPaid,
      currentPrincipal: l.principal,
      olderDue,
      boardSize: d.boardSize,
    });
    basis += t.basis;
    if (t.newDue > 0) {
      l.markers.push({ lap, amount: t.newDue, overdue: false });
      principalDue += t.newDue;
    }
    l.lapOpening = l.principal;
    l.lapDraws = [];
    l.lapReversed = 0;
    l.lapPrincipalPaid = 0;
  });
  d.taxBills.forEach((b, i) => {
    if (b.lap < lap && b.originalOverdue !== null && taxBillPrincipal(b) > 0) {
      d.taxBills[i] = chargeTaxBill(b, `lap-${lap}`).bill;
    }
  });

  // 6. Close this lap's tax record.
  rebill(d, lap);
  const bill = d.taxBills.find(b => b.lap === lap) || null;

  d.closedLaps.push(lap);
  const dueTax = bill ? taxBillOwed(bill) : 0;
  d.pendingDeadline = {
    lap,
    dueAtClose: requiredPayment(d).total + (bill && !bill.provisional ? dueTax : 0),
    basis,
    newDraws: d.period.newDraws,
    principalRepaid: d.period.principalRepaid,
  };
  d.period = { lap: lap + 1, newDraws: 0, principalRepaid: 0 };

  const summary = {
    lap,
    award: LAP_AWARD_CENTS,
    interestPosted,
    principalDue,
    taxBill: bill ? bill.assessed : 0,
    resaleDecline,
    careDue: d.assets.filter(a => isActive(a) && a.pendingCare && a.pendingCare.lap === lap + 1).length,
  };
  log(d, { type: 'lap_close', label: `Lap ${lap} closed`, cashDelta: LAP_AWARD_CENTS, detail: summary });
  return summary;
}

/** Evaluate the closed lap's debt and tax deadline once (before the next roll or at Finish). */
function evaluateDeadline(d) {
  const p = d.pendingDeadline;
  if (!p || d.checkpoints.includes(p.lap)) return null;
  d.loans.forEach(l => {
    l.interest.forEach(e => {
      if (e.lap <= p.lap && e.amount > 0) e.overdue = true;
    });
    l.markers.forEach(m => {
      if (m.lap <= p.lap && m.amount > 0) m.overdue = true;
    });
  });
  const current = requiredPayment(d).overdue === 0;
  // Evidence: required amounts at this deadline, counted only when the cash existed to pay them.
  const unpaidDebt = requiredPayment(d).overdue;
  const unpaidTax = d.taxBills.filter(b => b.lap === p.lap).reduce((t, b) => t + taxBillPrincipal(b), 0);
  if (p.dueAtClose > 0) {
    const unpaid = unpaidDebt + unpaidTax;
    if (unpaid === 0) observe(d, { opportunity: `deadline-${p.lap}`, dimension: 'avoidable_nonpayment', outcome: 'pay_required_amount', label: `Paid lap ${p.lap} bills on time` });
    else if (d.cash >= unpaid) observe(d, { opportunity: `deadline-${p.lap}`, dimension: 'avoidable_nonpayment', outcome: 'leave_unpaid_with_sufficient_available_cash', label: `Left lap ${p.lap} bills unpaid with cash available` });
  }
  const debtFree = d.loans.every(l => loanBalance(d, l) === 0);
  const netReduction = nonneg(p.principalRepaid - p.newDraws);
  const before = d.creditScore;
  d.creditScore = creditCheckpoint(before, current, debtFree, netReduction, p.basis);
  if (band(before).unsecuredLimit !== band(d.creditScore).unsecuredLimit) d.creditChangedTurn = d.turn;

  let taxLate = 0;
  d.taxBills.forEach((b, i) => {
    if (b.lap === p.lap && taxBillPrincipal(b) > 0) {
      const r = chargeTaxBill(b, 'deadline');
      d.taxBills[i] = r.bill;
      taxLate += r.charge;
    }
  });

  d.checkpoints.push(p.lap);
  d.pendingDeadline = null;
  const result = { lap: p.lap, before, after: d.creditScore, current, debtFree, taxLate };
  log(d, {
    type: 'checkpoint',
    label: `Lap ${p.lap} payment deadline: credit ${before} → ${d.creditScore}`,
    cashDelta: 0,
    detail: result,
  });
  return result;
}

function applyPrincipal(d, loan, amount, markerLap = null) {
  loan.principal -= amount;
  if (markerLap !== null && d.pendingDeadline && markerLap === d.pendingDeadline.lap) {
    d.pendingDeadline.principalRepaid += amount;
  } else {
    d.period.principalRepaid += amount;
  }
}

/** Allocate a payment across one loan (or all, in the spec's default order). Returns amount used. */
function allocatePayment(d, amount, loanId) {
  let left = amount;
  const loans = loanId ? d.loans.filter(l => l.id === loanId) : d.loans;
  const take = (entry, onPaid) => {
    if (left <= 0 || entry.amount <= 0) return;
    const x = Math.min(left, entry.amount);
    entry.amount -= x;
    left -= x;
    onPaid(x);
  };

  const byLap = (a, b) => a.e.lap - b.e.lap || (a.l.id < b.l.id ? -1 : 1);
  const payInterest = () =>
    loans.flatMap(l => l.interest.map(e => ({ l, e }))).sort(byLap).forEach(({ e }) => take(e, () => {}));
  // 1. Posted interest, oldest entry first.
  payInterest();
  // 2. Overdue principal markers, oldest due lap first; 3. then markers not yet overdue.
  [true, false].forEach(overdue => {
    loans
      .flatMap(l => l.markers.filter(m => m.overdue === overdue).map(e => ({ l, e })))
      .sort(byLap)
      .forEach(({ l, e }) => take(e, x => applyPrincipal(d, l, x, e.lap)));
  });
  // Interest accrued so far this lap is settled before any extra principal, so a payoff
  // clears it. Posting it early only changes when it is rounded, not how much is owed.
  if (left > 0) {
    const lap = incomeLap(d);
    loans.forEach(l => postAccrual(d, l, lap));
    payInterest();
  }
  // 4. Extra principal: highest rate first (all ordinary loans share the band rate), oldest loan id.
  loans.forEach(l => {
    if (left <= 0 || l.principal <= 0) return;
    const x = Math.min(left, l.principal);
    left -= x;
    l.lapPrincipalPaid += x;
    applyPrincipal(d, l, x);
  });

  loans.forEach(l => {
    l.interest = l.interest.filter(e => e.amount > 0);
    l.markers = l.markers.filter(m => m.amount > 0);
  });
  return amount - left;
}

function pruneLoans(d) {
  d.loans = d.loans.filter(l => l.principal > 0 || l.interest.length > 0 || l.markers.length > 0 || l.accrual > 0);
}

// ---------------------------------------------------------------------------
// Holdings: scheduled contract and market events
// ---------------------------------------------------------------------------

const annuityDue = (d, a, k) => a.acquiredAt + (a.terms.wait + k) * d.boardSize;
const marketDue = (d, a) => a.acquiredAt + (a.circuitsDrawn + 1) * d.boardSize;

/** Earliest scheduled holding event after the current progress (Infinity if none). */
function nextDuePoint(d) {
  let next = Infinity;
  d.assets.forEach(a => {
    if (!isActive(a)) return;
    if (a.holding === 'annuity' && a.paymentsMade < 2) next = Math.min(next, annuityDue(d, a, a.paymentsMade));
    if (a.holding === 'market' && a.value > 0) next = Math.min(next, marketDue(d, a));
  });
  return next;
}

function nextDie(dice) {
  const face = dice.list[dice.i];
  dice.i += 1;
  if (!(face >= 1 && face <= 6)) throw new LedgerError('A market roll was missing. Please roll again.');
  return face;
}

/** Close a life policy (cancel or lapse): settle its loan from cash value, realize the gain. */
function closePolicy(d, a, status) {
  const value = assetValue(d, a);
  const balance = policyBalance(d, a);
  const cash = Math.max(0, value - balance);
  d.cash += cash;
  recordIncome(d, 'contractGains', Math.max(0, value - a.premium));
  a.status = status;
  a.closedValue = value;
  a.loan = null;
  return { value, balance, cash, gain: Math.max(0, value - a.premium) };
}

/** Process due payments, policy lapses and market draws at exactly the current progress. */
function settleDue(d, dice, events) {
  d.assets.forEach(a => {
    if (!isActive(a)) return;
    if (a.holding === 'life' && a.loan && policyBalance(d, a) >= assetValue(d, a)) {
      const r = closePolicy(d, a, 'lapsed');
      events.push({ type: 'policy_lapsed', assetId: a.id, title: a.title, ...r });
      log(d, { type: 'policy_lapsed', label: `${a.title} lapsed: its loan used up the cash value`, cashDelta: r.cash });
    }
    if (a.holding === 'annuity') {
      while (a.paymentsMade < 2 && annuityDue(d, a, a.paymentsMade) <= d.progress) {
        const first = a.paymentsMade === 0;
        const payment = first ? a.terms.payment1 : a.terms.payment2;
        const principal = first ? Math.floor(a.terms.premium / 2) : a.terms.premium - Math.floor(a.terms.premium / 2);
        d.cash += payment;
        recordIncome(d, 'contractGains', Math.max(0, payment - principal));
        a.paymentsMade += 1;
        a.cashReceived = (a.cashReceived || 0) + payment;
        if (a.paymentsMade === 2) a.status = 'paid_out';
        events.push({ type: 'annuity_payment', assetId: a.id, title: a.title, payment, earnings: payment - principal });
        log(d, { type: 'annuity_payment', label: `${a.title} payment ${a.paymentsMade} of 2`, cashDelta: payment });
      }
    }
    if (a.holding === 'market') {
      while (a.value > 0 && marketDue(d, a) <= d.progress) {
        const face = nextDie(dice);
        const bps = marketDrawBps(a.profile, face);
        const before = a.value;
        a.value = Math.max(0, divHalfUp(a.value * (BPS + bps), BPS));
        a.circuitsDrawn += 1;
        a.draws.push({ circuit: a.circuitsDrawn, face, bps });
        events.push({ type: 'market_draw', assetId: a.id, title: a.title, face, bps, before, after: a.value });
      }
    }
  });
}

function awardFamily(d, family, earned) {
  if (!family || !(earned > 0)) return 0;
  const prev = d.repFamilies[family] || 0;
  if (earned <= prev) return 0;
  d.repFamilies[family] = earned;
  return earned - prev;
}

function consumeLanding(d, entry) {
  const status = landingStatus(d, entry);
  if (!status.ok) throw new LedgerError(status.reason, 'landing');
  if (d.requireLanding) d.opportunity.used = true;
}

/** Shared sale settlement for ledger assets and legacy callers. */
function settleSale(d, { assetId, label, value, basis, residualExit }) {
  const debt = linkedDebt(d, assetId);
  let r;
  try {
    r = sale({ value, basis, debt, available: Math.max(0, d.cash), residualExit });
  } catch (e) {
    throw new LedgerError('The sale does not cover the linked loan. Choose a residual exit to sell anyway.');
  }
  let left = r.debtPaid;
  d.loans
    .filter(l => l.assetId === assetId)
    .forEach(l => {
      if (left > 0) left -= allocatePayment(d, Math.min(left, loanBalance(d, l)), l.id);
      l.assetId = null;
      if (loanBalance(d, l) > 0) l.residualExit = true;
    });
  d.cash += r.cashDelta;
  pruneLoans(d);
  log(d, { type: 'sell', label: `Sold ${label}`, cashDelta: r.cashDelta, detail: r });
  return r;
}

// ---------------------------------------------------------------------------
// Reveal evidence
// ---------------------------------------------------------------------------

function observe(d, { opportunity, dimension, outcome, label }) {
  if (d.observations.some(o => o.opportunity_id === opportunity && o.dimension === dimension)) return;
  d.observations.push({
    event_id: `${opportunity}:${dimension}`,
    opportunity_id: opportunity,
    dimension,
    outcome,
    actionable: true,
    choice_exposed: true,
    forced: false,
    reversed: false,
    turn: d.turn,
    label,
  });
}

/** Obligations due before the next roll and still unpaid (debt, closed-lap tax, event bills). */
export function dueNow(d) {
  const tax = d.taxBills.filter(b => !b.provisional).reduce((t, b) => t + taxBillOwed(b), 0);
  const bills = d.payables.filter(p => p.amount > 0 && p.dueTurn <= d.turn + 1).reduce((t, p) => t + p.amount, 0);
  return requiredPayment(d).total + tax + bills;
}

/** Was any purchase on this landing actually eligible and affordable? */
function landingActionable(d, kind) {
  const catalog = kind === 'luxury' ? LUXURY_CATALOG : INVESTMENT_CATALOG;
  const h = holds(d);
  return catalog.some(entry => {
    if (!eligibility(d, entry).ok) return false;
    const price = priceFor(d, entry).price;
    if (price <= d.cash) return true;
    if (entry.cashOnly || h.length) return false;
    if (fundingKind(entry) === 'luxury') return availableUnsecured(d) >= price - Math.max(0, d.cash);
    return d.cash >= Math.ceil((price * entry.minCashBps) / BPS);
  });
}

// ---------------------------------------------------------------------------
// Yellow NIL opportunities
// ---------------------------------------------------------------------------

function postCashIncome(d, amount, taxClass) {
  d.cash += amount;
  recordIncome(d, taxClass === 'business' ? 'business' : 'nil', amount);
  if (taxClass !== 'business') d.nilPaidToDate = (d.nilPaidToDate || 0) + amount;
  if (taxClass !== 'business') applyIncomeShare(d, amount);
}

/** R19: a qualifying NIL cash receipt is taxed gross, then the claim takes its share. */
function applyIncomeShare(d, amount) {
  const c = d.incomeShare;
  if (!c || !(amount > 0)) return 0;
  const claim = Math.min(divHalfUp(amount * c.shareBps, BPS), Math.max(0, c.cap - c.paid));
  d.cash -= claim;
  c.paid += claim;
  c.receipts += 1;
  if (claim > 0) log(d, { type: 'income_share', label: 'Income-share claim payment', cashDelta: -claim });
  if (c.receipts >= c.receiptLimit || c.paid >= c.cap) {
    if (c.paid < c.minTotal) {
      d.payables.push({ id: `PAY${d.nextId++}`, cardId: 'R19', label: 'Advance minimum repayment', component: 'income_share', amount: c.minTotal - c.paid, dueTurn: d.turn + 1, overdue: false });
    }
    d.incomeShare = null;
  }
  return claim;
}

function addPoints(d, rep = 0, career = 0, source = '') {
  if (!rep && !career) return;
  d.points.rep += rep;
  d.points.career += career;
  d.points.log.push({ turn: d.turn, rep, career, source });
}

/** Draw one eligible yellow card uniformly and post its base benefit immediately. */
function drawYellow(d, pick) {
  const pool = eligibleYellow(d);
  if (!pool.length) {
    d.yellow = { id: `Y-${d.turn}`, cardId: null, turn: d.turn, status: 'clear' };
    log(d, { type: 'yellow', label: 'Yellow space: all clear this turn', cashDelta: 0 });
    return d.yellow;
  }
  const card = pool[Math.floor(Math.abs(pick || 0)) % pool.length];
  const stats = d.yellowStats[card.id] || { count: 0, lastTurn: -Infinity };
  d.yellowStats[card.id] = { count: stats.count + 1, lastTurn: d.turn };

  const base = { cash: 0, income: 0, noncash: 0, recovered: 0, token: false, target: null };
  card.immediate.forEach(effect => {
    if (effect.op === 'cash_income') {
      postCashIncome(d, effect.amount.fixed_cents, effect.tax_class);
      base.cash += effect.amount.fixed_cents;
      base.income += effect.amount.fixed_cents;
    } else if (effect.op === 'protection_token') {
      d.assets.push({
        id: `token-${d.turn}`,
        cardId: card.id,
        kind: 'nil',
        title: 'Emergency Fund',
        holding: 'token',
        status: 'active',
        acquiredAt: d.progress,
        basis: 0,
        exposure: [],
        stages: [],
        limit: effect.limit_cents,
        uses: effect.uses,
      });
      base.token = true;
    } else if (effect.op === 'collect_existing_receivable') {
      const r = d.receivables.filter(x => x.amount >= effect.amount.fixed_cents).sort((a, b) => a.dueTurn - b.dueTurn)[0];
      if (r) {
        r.amount -= effect.amount.fixed_cents;
        postCashIncome(d, effect.amount.fixed_cents, 'nil');
        base.cash += effect.amount.fixed_cents;
        base.income += effect.amount.fixed_cents;
      }
    } else if (effect.op === 'refund_loss') {
      let amount = Math.min(effect.amount.cap_cents, unrecoveredLoss(d));
      base.recovered = amount;
      d.cash += amount; // restores a loss; not new income
      d.losses.forEach(l => {
        const x = Math.min(amount, l.amount - l.recovered);
        l.recovered += x;
        amount -= x;
      });
    }
  });
  if (card.id === 'Y08') base.target = licensableContent(d)?.title || null;
  if (createsSponsorRelationship(card.id)) {
    d.sponsorRelations.push({ cardId: card.id, createdTurn: d.turn, expiresTurn: d.turn + SPONSOR_RELATIONSHIP_TURNS });
  }
  d.yellow = { id: `Y-${d.turn}`, cardId: card.id, turn: d.turn, status: 'pending', base, choiceId: null };
  log(d, { type: 'yellow', label: `${card.title}`, cashDelta: base.cash + base.recovered });
  if (card.choices.length === 1) resolveYellow(d, card.choices[0].id);
  return d.yellow;
}

/** Commit the player's choice for the drawn card (follow-up task, service delivery or decline). */
function resolveYellow(d, choiceId) {
  const y = d.yellow;
  if (!y || y.status !== 'pending') throw new LedgerError('There is no yellow card waiting for a choice.');
  const card = yellowCard(y.cardId);
  const choice = yellowChoices(d, card).find(c => c.id === choiceId);
  if (!choice) throw new LedgerError('Choose one of the options.');
  if (!choice.available) throw new LedgerError(choice.reason);
  const raw = card.choices.find(c => c.id === choiceId);
  let task = null;
  raw.effects.forEach(effect => {
    if (effect.op === 'task') {
      task = {
        id: `T${d.nextId++}`,
        cardId: card.id,
        title: card.title,
        label: choice.label,
        kind: effect.kind,
        slots: effect.slots,
        createdTurn: d.turn,
        dueTurn: d.turn + effect.due_own_turns,
        reward: choice.reward,
        taxClass: choice.rewardTaxClass,
        status: 'open',
      };
      d.tasks.push(task);
    } else if (effect.op === 'complete_sponsored_service_once') {
      const offer = card.immediate.find(e => e.op === 'sponsored_service_offer');
      recordIncome(d, 'nil', offer.tax_on_delivery_cents); // noncash NIL income on delivery
      d.y12Laps.push(currentLapNumber(d));
      y.base.noncash = offer.face_value_cents;
    }
  });
  y.status = 'resolved';
  y.choiceId = choiceId;
  d.yellowHistory.push({ cardId: card.id, title: card.title, turn: y.turn, choice: choice.label, ...y.base, taskId: task?.id || null });
  return { choice: choiceId, task };
}

/** Start of an own turn: unanswered cards take their cost-free branch; overdue optional tasks lapse. */
function startOwnTurn(d, dice, events) {
  if (d.yellow && d.yellow.status === 'pending') resolveYellow(d, defaultChoice(yellowCard(d.yellow.cardId)));
  if (d.scenario && d.scenario.status === 'pending') {
    const card = curveball(d.scenario.cardId);
    respondScenario(d, defaultResponse(card), {}, false, true);
    events.push({ type: 'scenario_default', label: `${card.title}: no response chosen, so the cost-free option applied` });
  }
  // A green or diamond landing left unused, when something was affordable, is a decline.
  const o = d.opportunity;
  if (o && !o.used && (o.category === 'green' || o.category === 'diamond') && landingActionable(d, o.category === 'green' ? 'investment' : 'luxury')) {
    observe(d, {
      opportunity: `land-${d.turn}`,
      dimension: o.category === 'green' ? 'investment' : 'luxury',
      outcome: 'decline',
      label: o.category === 'green' ? 'Passed on investing' : 'Passed on a lifestyle purchase',
    });
  }
  const next = d.turn + 1;
  // Due scenario checkpoints first.
  const due = d.scheduled.filter(x => x.dueTurn <= next);
  d.scheduled = d.scheduled.filter(x => x.dueTurn > next);
  due.forEach(item => {
    const ctx = scenarioContext(d, { cardId: item.cardId, id: item.scenarioId, targetId: item.targetId, recordId: item.recordId, saved: item.saved }, { lossId: item.lossId });
    applyEffects(d, item.effects, ctx, true);
    if (ctx.lines.length) events.push({ type: 'scenario_followup', label: `${ctx.card.title}: follow-up`, lines: ctx.lines });
  });
  const missed = [];
  d.tasks.forEach(t => {
    if (t.status === 'open' && t.dueTurn < next) {
      if (t.autoClose) {
        t.status = 'completed';
        return;
      }
      t.status = 'missed';
      missed.push(t);
      if (t.kind === 'transfer_academic' || t.kind === 'academic_repair') d.academicRisk = true;
      if (!t.mandatory) observe(d, { opportunity: `task-${t.id}`, dimension: 'follow_through', outcome: 'ignore', label: `Missed: ${t.label}` });
    }
  });
  d.payables.forEach(p => {
    if (p.amount > 0 && p.dueTurn <= next) p.overdue = true;
  });
  // Earned receivables pay on their due turn; prepaid customer orders are earned when fulfilled.
  d.receivables.forEach(r => {
    if (r.amount > 0 && r.dueTurn <= next) {
      events.push({ type: 'receivable', label: `${r.label} paid: ${formatCents(r.amount)}` });
      const x = r.amount;
      r.amount = 0;
      postCashIncome(d, x, 'nil');
    }
  });
  d.prepayments.forEach(p => {
    if (p.unearned > 0 && p.fulfilTurn <= next) {
      recordIncome(d, 'business', p.unearned);
      p.unearned = 0;
    }
  });
  portalStep(d, next, dice, events);
  const internship = careerStartTurn(d, next);
  d.turn = next;
  d.yellow = null;
  if (internship === 'missed') missed.push({ label: 'Internship follow-up (one repair chance next)', reward: 0 });
  return missed;
}

// ---------------------------------------------------------------------------
// Career (purple)
// ---------------------------------------------------------------------------

function drawPurple(d, pick) {
  const pool = eligibleFamilies(d);
  if (!pool.length) {
    d.career.offer = { id: `P-${d.turn}`, turn: d.turn, family: null, status: 'clear' };
    return d.career.offer;
  }
  const f = pool[Math.floor(Math.abs(pick || 0)) % pool.length];
  d.career.offer = { id: `P-${d.turn}`, turn: d.turn, family: f.id, status: 'offered' };
  log(d, { type: 'career_offer', label: `Purple space: ${f.name}`, cashDelta: 0 });
  return d.career.offer;
}

/** Award a completed family once per completion lap. */
function awardCareer(d, familyId, pathId) {
  const f = careerFamily(familyId);
  if (familyRewardedThisLap(d, familyId)) return { rep: 0, career: 0, rewarded: false };
  const lap = currentLapNumber(d);
  d.career.rewardedLaps[familyId] = [...(d.career.rewardedLaps[familyId] || []), lap];
  d.career.lastRewardedTurn[`${familyId}:${pathId}`] = d.turn;
  return { rep: f.rep, career: f.career, rewarded: true };
}

function careerRecord(d, entry) {
  d.career.history.push({ turn: d.turn, lap: currentLapNumber(d), ...entry });
  if (entry.path && entry.status === 'completed') {
    d.career.experience.push({ path: entry.path, turn: d.turn, source: entry.family });
  }
}

/** Start of an own turn: an unanswered offer closes; internships move through their follow-up. */
function careerStartTurn(d, nextTurn) {
  const c = d.career;
  if (c.offer && c.offer.status === 'offered') {
    c.offer.status = 'declined';
    careerRecord(d, { family: c.offer.family, path: null, status: 'declined', rep: 0, career: 0 });
  }
  c.offer = null;
  const i = c.internship;
  if (!i || i.dueTurn >= nextTurn) return null;
  if (i.state === 'active' || i.state === 'extended') {
    i.state = 'repair';
    i.dueTurn = nextTurn;
    observe(d, { opportunity: `intern-${i.id}`, dimension: 'follow_through', outcome: 'ignore', label: 'Missed an internship follow-up' });
    careerRecord(d, { family: 'internship', path: i.path, status: 'missed', rep: 0, career: 0 });
    return 'missed';
  }
  careerRecord(d, { family: 'internship', path: i.path, status: 'closed_unfinished', rep: 0, career: 0 });
  c.internship = null;
  return 'closed';
}

// ---------------------------------------------------------------------------
// Curveballs (red / blue scenarios)
// ---------------------------------------------------------------------------

const TOKEN_COMPONENT_EXCLUDED = ['settlement_tax', 'tax', 'advance_contract', 'contract_exit', 'income_share'];

/** The scenario's source record (receivable, order, prepayment, booking, contribution, perk). */
function scenarioRecordOf(d, ctx) {
  if (!ctx.recordId) return null;
  const lists = [d.receivables, d.inventoryOrders, d.prepayments, d.bookings, d.npcContributions, d.perks];
  for (const list of lists) {
    const r = (list || []).find(x => x.id === ctx.recordId);
    if (r) return r;
  }
  return null;
}

function targetAsset(d, ctx) {
  return ctx.targetId ? d.assets.find(a => a.id === ctx.targetId) : null;
}

function setAssetValue(d, a, value) {
  const v = Math.max(0, value);
  if (a.holding === 'market') a.value = v;
  else {
    a.anchorValue = v;
    a.anchorProgress = d.progress;
  }
}

function amountOf(d, amount, ctx) {
  if (!amount) return 0;
  if (amount.fixed_cents !== undefined) return amount.fixed_cents;
  const fields = {
    available_cash_before_event: ctx.cashBefore,
    company_value: targetAsset(d, ctx) ? companyValueOf(d, targetAsset(d, ctx)) : 0,
    company_value_before_event: ctx.targetValueBefore,
  };
  const rec = scenarioRecordOf(d, ctx) || {};
  Object.assign(fields, {
    recorded_shortfall_cents: rec.shortfall,
    inventory_unsold_value: rec.unsold,
    unearned_customer_prepayments: rec.unearned,
    refundable_venue_deposit: rec.deposit,
    perk_disclosed_taxable_value: rec.value,
  });
  const base = fields[amount.field] !== undefined ? fields[amount.field] || 0 : ctx.saved[amount.field] || 0;
  const value = divHalfUp(Math.max(0, base) * (amount.basis_points ?? BPS), BPS);
  return amount.cap_cents !== undefined ? Math.min(value, amount.cap_cents) : value;
}

/** Consume one plan use for this event's matter (once) and return the help for `fee`. */
function planHelp(d, ctx, plan, fee) {
  const m = ctx.matter[plan];
  if (!m.used) {
    const p = d.assets.find(a => isActive(a) && a.holding === 'plan' && a.plan === plan && a.uses > 0);
    if (!p) return 0;
    p.uses -= 1;
    m.used = true;
  }
  const limits = plan === 'legal' ? { bps: 8000, cap: 2500000 } : HEALTH_ASSIST_LIMITS;
  const help = Math.min(Math.max(0, limits.cap - m.applied), divHalfUp(fee * limits.bps, BPS));
  m.applied += help;
  return help;
}

function newPayable(d, ctx, { component, amount, due, saveAs }) {
  const p = {
    id: `PAY${d.nextId++}`,
    cardId: ctx.card.id,
    eventId: ctx.eventId,
    label: `${ctx.card.title}: ${COMPONENT_LABELS[component] || component}`,
    component,
    amount,
    dueTurn: d.turn + due,
    overdue: false,
  };
  d.payables.push(p);
  if (saveAs) ctx.saved[saveAs] = p.id;
  ctx.lines.push({ kind: 'payable', label: p.label, amount, dueTurn: p.dueTurn });
  return p;
}

function payableBySaved(d, ctx, key) {
  return d.payables.find(p => p.id === ctx.saved[key]);
}

/** One expense: plan help, service discount and emergency token, then cash; a mandatory shortfall becomes an event bill. */
function postExpense(d, e, ctx, mandatory) {
  const gross = amountOf(d, e.amount, ctx);
  if (!(gross > 0)) return;
  let help = 0;
  if (e.component === 'eligible_legal_fee' && ctx.elect.legal) help += planHelp(d, ctx, 'legal', gross);
  if (e.component === 'health_expense' && ctx.elect.health) help += planHelp(d, ctx, 'health', gross);
  let discount = 0;
  if (ctx.elect.service) {
    // One eligible service discount: a Coach/Web credit for this business, or the sports referral.
    const credit = d.assets.find(a => isActive(a) && a.holding === 'service_credit' && a.uses > 0 &&
      a.components.includes(e.component) && a.targetId === ctx.targetId);
    const creditSaving = credit ? Math.min(credit.cap, divHalfUp((gross - help) * credit.bps, BPS)) : 0;
    const target = targetAsset(d, ctx);
    const referralOk = e.component === 'equipment_repair' && target && ['YSH_TEAM', 'YSH_CENTER', 'YSH_COMPLEX'].includes(target.cardId) &&
      d.career.referral && !d.career.referral.used;
    const referralSaving = referralOk ? Math.min(250000, divHalfUp((gross - help) * 500, BPS)) : 0;
    if (creditSaving >= referralSaving && creditSaving > 0) {
      discount = creditSaving;
      credit.uses -= 1;
      credit.status = 'used';
    } else if (referralSaving > 0) {
      discount = referralSaving;
      d.career.referral.used = true;
    }
  }
  let token = 0;
  if (mandatory && ctx.elect.token && !TOKEN_COMPONENT_EXCLUDED.includes(e.component)) {
    const t = d.assets.find(a => isActive(a) && a.holding === 'token' && a.uses > 0);
    if (t) {
      token = Math.min(t.limit, gross - help - discount);
      t.uses -= 1;
      t.status = 'used';
    }
  }
  const net = gross - help - discount - token;
  let paidNow = net;
  if (mandatory) {
    paidNow = Math.max(0, Math.min(d.cash, net));
    if (net - paidNow > 0) newPayable(d, ctx, { component: e.component, amount: net - paidNow, due: 1 });
  } else if (net > d.cash && !ctx.preview) {
    throw new LedgerError('Not enough Available Cash for this response.');
  }
  d.cash -= paidNow;
  if (BUSINESS_COMPONENTS.includes(e.component)) recordIncome(d, 'business', -net);
  if (LOSS_COMPONENTS.includes(e.component)) {
    const loss = { id: `loss-${d.nextId++}`, label: ctx.card.title, amount: gross, recovered: 0 };
    d.losses.push(loss);
    if (e.save_as) ctx.saved[e.save_as] = gross;
    ctx.lossId = loss.id;
  } else if (e.save_as) ctx.saved[e.save_as] = gross;
  ctx.assistance += help + discount + token;
  ctx.lines.push({ kind: 'expense', label: COMPONENT_LABELS[e.component] || e.component, gross, help: help + discount + token, paidNow });
}

function applyEffects(d, effects, ctx, mandatory) {
  effects.forEach(e => {
    if (e.requires === 'task_completed' && !ctx.taskCompleted) return;
    switch (e.op) {
      case 'expense':
        postExpense(d, e, ctx, mandatory);
        break;
      case 'event_payable': {
        const amount = amountOf(d, e.amount, ctx);
        if (amount > 0) newPayable(d, ctx, { component: e.component, amount, due: e.due_own_turns || 1, saveAs: e.save_as });
        break;
      }
      case 'restriction':
        d.restrictions.push({ kind: e.kind, untilTurn: d.turn + e.own_turns, eventId: ctx.eventId, cardId: ctx.card.id });
        if (e.kind === 'sport_appearance' && ['B02', 'B13'].includes(ctx.card.id)) {
          d.healthIncidentUntil = Math.max(d.healthIncidentUntil, d.turn + e.own_turns);
        }
        ctx.lines.push({ kind: 'restriction', kind2: e.kind, turns: e.own_turns });
        break;
      case 'clear_event_restriction':
        d.restrictions = d.restrictions.filter(r => r.eventId !== ctx.eventId);
        ctx.lines.push({ kind: 'note', label: 'Restriction lifted' });
        break;
      case 'refund_loss': {
        const loss = d.losses.find(l => l.id === ctx.lossId);
        const want = amountOf(d, e.amount, ctx);
        const x = loss ? Math.min(want, loss.amount - loss.recovered) : 0;
        if (x > 0) {
          loss.recovered += x;
          d.cash += x;
          ctx.lines.push({ kind: 'refund', label: 'Recovered', amount: x });
        }
        break;
      }
      case 'resolve_table':
        if (ctx.preview) {
          ctx.unknown = true;
          break;
        }
        ctx.faces[e.table] = ctx.faces[e.table] || ctx.dice();
        ctx.lines.push({ kind: 'roll', table: e.table, face: ctx.faces[e.table] });
        applyEffects(d, ctx.card.chance[e.table].die_faces[String(ctx.faces[e.table])], ctx, true);
        break;
      case 'task':
        ctx.newTask = {
          id: `T${d.nextId++}`,
          cardId: ctx.card.id,
          eventId: ctx.eventId,
          title: ctx.card.title,
          label: ctx.choiceLabel,
          kind: e.kind,
          slots: e.slots,
          createdTurn: d.turn,
          dueTurn: d.turn + e.due_own_turns,
          reward: 0,
          onComplete: [],
          targetId: ctx.targetId,
          recordId: ctx.recordId,
          saved: ctx.saved,
          status: 'open',
        };
        d.tasks.push(ctx.newTask);
        break;
      case 'mandatory_commitment':
        d.tasks.push({
          id: `T${d.nextId++}`, cardId: ctx.card.id, title: ctx.card.title, label: 'Planning commitment', kind: 'commitment',
          slots: e.slots, createdTurn: d.turn, dueTurn: d.turn + e.own_turns, reward: 0, mandatory: true, autoClose: true, status: 'open',
        });
        break;
      case 'delay_one_eligible_task':
      case 'delay_task': {
        const rec = scenarioRecordOf(d, ctx);
        if (ctx.card.id === 'R09' && rec) {
          const svc = d.assets.find(a => a.id === rec.serviceId);
          if (svc) svc.blockedUntilTurn = d.turn + e.own_turns;
          break;
        }
        if (ctx.card.id === 'R12' && rec) {
          rec.fulfilTurn += e.own_turns;
          break;
        }
        const t = optionalTasks(d).sort((a, b) => a.dueTurn - b.dueTurn)[0];
        if (t) t.dueTurn += e.own_turns;
        break;
      }
      case 'cancel_one_optional_task':
      case 'cancel_task_without_reward': {
        const rec = scenarioRecordOf(d, ctx);
        if (ctx.card.id === 'R09' && rec) {
          const svc = d.assets.find(a => a.id === rec.serviceId);
          if (svc) svc.status = 'cancelled';
          break;
        }
        const t = optionalTasks(d).sort((a, b) => a.dueTurn - b.dueTurn)[0];
        if (t) t.status = 'released';
        break;
      }
      case 'record_behavior':
      case 'record_outcome':
        d.behaviors.push({ turn: d.turn, cardId: ctx.card.id, tag: e.tag || e.band });
        break;
      case 'schedule_care_checkpoint':
        d.healthIncidentUntil = Math.max(d.healthIncidentUntil, d.turn + e.own_turns);
        break;
      case 'rep_delta':
      case 'career_delta': {
        if (e.reward_key && d.rewardKeys.includes(e.reward_key)) break;
        if (e.reward_key) d.rewardKeys.push(e.reward_key);
        if (e.op === 'rep_delta') addPoints(d, e.points, 0, ctx.card.id);
        else addPoints(d, 0, e.points, ctx.card.id);
        ctx.points[e.op === 'rep_delta' ? 'rep' : 'career'] += e.points;
        break;
      }
      case 'asset_write_down': {
        const a = targetAsset(d, ctx);
        if (!a) break;
        const loss = amountOf(d, e.amount, ctx);
        setAssetValue(d, a, companyValueOf(d, a) - loss);
        if (e.save_as) ctx.saved[e.save_as] = loss;
        ctx.lines.push({ kind: 'value', label: a.title, amount: -loss });
        break;
      }
      case 'restore_prior_value_loss': {
        const a = targetAsset(d, ctx);
        if (!a || !isActive(a)) break;
        const x = amountOf(d, e.amount, ctx);
        setAssetValue(d, a, companyValueOf(d, a) + x);
        ctx.lines.push({ kind: 'value', label: a.title, amount: x });
        break;
      }
      case 'asset_write_down_tagged':
        d.assets.forEach(a => {
          if (!isActive(a) || a.holding !== 'market' || !(a.value > 0)) return;
          const tag = e.precedence.find(t => (a.exposure || []).includes(t));
          if (!tag) return;
          const loss = divHalfUp(a.value * e.rates_basis_points[tag], BPS);
          a.value -= loss;
          ctx.lines.push({ kind: 'value', label: a.title, amount: -loss });
        });
        break;
      case 'cash_advance': {
        const x = amountOf(d, e.amount, ctx);
        d.cash += x; // borrowed money, not income
        ctx.lines.push({ kind: 'advance', label: 'Advance received (not income)', amount: x });
        break;
      }
      case 'replace_existing_payable': {
        const p = payableBySaved(d, ctx, e.target);
        if (p) {
          p.amount = amountOf(d, e.amount, ctx);
          p.dueTurn = d.turn + e.due_own_turns;
          ctx.lines.push({ kind: 'payable', label: p.label, amount: p.amount, dueTurn: p.dueTurn });
        }
        break;
      }
      case 'pay_existing_payable': {
        const p = payableBySaved(d, ctx, e.target);
        const x = Math.min(amountOf(d, e.amount, ctx), p ? p.amount : 0);
        if (x > d.cash && !ctx.preview) throw new LedgerError('Not enough Available Cash for this response.');
        d.cash -= x;
        if (p) p.amount -= x;
        ctx.lines.push({ kind: 'paid', label: 'Paid toward the claim', amount: x });
        break;
      }
      case 'reduce_existing_payable': {
        const p = d.payables.find(x => x.id === ctx.saved[e.target]);
        if (p) p.amount = Math.max(0, p.amount - amountOf(d, e.amount, ctx));
        break;
      }
      case 'income_share_contract':
        d.incomeShare = {
          eventId: ctx.eventId, shareBps: e.share_basis_points, receiptLimit: e.receipt_limit, cap: e.total_cap_cents,
          minTotal: e.final_minimum_total_cents, paid: 0, receipts: 0,
        };
        break;
      case 'amend_income_share':
        if (d.incomeShare) {
          Object.assign(d.incomeShare, { shareBps: e.share_basis_points, receiptLimit: e.receipt_limit, cap: e.total_cap_cents, minTotal: e.final_minimum_total_cents });
        }
        break;
      case 'settle_income_share': {
        const x = amountOf(d, e.amount, ctx);
        if (x > d.cash && !ctx.preview) throw new LedgerError('Not enough Available Cash for this response.');
        d.cash -= x;
        d.incomeShare = null;
        ctx.lines.push({ kind: 'paid', label: 'Fixed exit price', amount: x });
        break;
      }
      case 'start_transfer_process':
        d.portal = { mode: e.mode, stage: 'searching', searchTurn: d.turn + 1, searches: 0, offers: [], eventId: ctx.eventId, academicTaskId: null };
        break;
      case 'close_contract_at_recorded_expiry': {
        const r = d.sponsorRelations.find(x => x.expiresTurn >= d.turn && x.expiresTurn <= d.turn + 1 && !x.closed);
        if (r) r.closed = true;
        break;
      }
      case 'navigate':
        ctx.navigate = e.target;
        break;
      case 'link_existing_bill':
      case 'remove_unearned_projection':
      case 'keep_original_event_schedule':
        break;
      // Receivables (R02 / Y02)
      case 'delay_receivable': {
        const r = scenarioRecordOf(d, ctx);
        if (r) {
          r.dueTurn = Math.max(r.dueTurn, d.turn) + e.turns;
          ctx.lines.push({ kind: 'note', label: `${r.label} now due on turn ${r.dueTurn}` });
        }
        break;
      }
      case 'reschedule_receivable': {
        const r = scenarioRecordOf(d, ctx);
        if (r) {
          r.dueTurn = d.turn + 1;
          ctx.lines.push({ kind: 'note', label: `${r.label} now due on turn ${r.dueTurn}` });
        }
        break;
      }
      case 'collect_existing_receivable': {
        const r = scenarioRecordOf(d, ctx);
        if (r && r.amount > 0) {
          const x = Math.min(r.amount, e.amount ? amountOf(d, e.amount, ctx) : r.amount);
          r.amount -= x;
          postCashIncome(d, x, 'nil');
          ctx.lines.push({ kind: 'income', label: 'Collected', amount: x });
        }
        break;
      }
      // Bookings and customer prepayments (R09 / R12)
      case 'refund_original': {
        const b = scenarioRecordOf(d, ctx);
        const x = Math.min(amountOf(d, e.amount, ctx), b ? b.deposit : 0);
        if (x > 0) {
          b.deposit -= x;
          d.cash += x; // a refund, not income
          ctx.lines.push({ kind: 'refund', label: 'Deposit refunded', amount: x });
        }
        break;
      }
      case 'refund_customer_prepayment': {
        const p = scenarioRecordOf(d, ctx);
        const x = Math.min(amountOf(d, e.amount, ctx), p && p.unearned !== undefined ? p.unearned : 0);
        if (x > 0) {
          p.unearned -= x;
          const now = Math.max(0, Math.min(d.cash, x));
          d.cash -= now;
          if (x - now > 0) newPayable(d, ctx, { component: 'customer_refund', amount: x - now, due: 1 });
          ctx.lines.push({ kind: 'paid', label: 'Customer refunds', amount: x });
        }
        break;
      }
      case 'earn_existing_customer_prepayments':
      case 'earn_remaining_customer_prepayments': {
        const p = scenarioRecordOf(d, ctx);
        if (p && p.unearned > 0) {
          recordIncome(d, 'business', p.unearned);
          ctx.lines.push({ kind: 'income', label: 'Orders fulfilled (earned)', amount: p.unearned });
          p.unearned = 0;
        }
        break;
      }
      // Partner contribution (R05)
      case 'reduce_activity_budget':
      case 'mark_contribution_satisfied': {
        const c = scenarioRecordOf(d, ctx);
        if (c) c.satisfied = true;
        break;
      }
      // Perk tax (R16)
      case 'recognize_noncash_income': {
        const p = scenarioRecordOf(d, ctx);
        if (p && !p.taxRecorded) {
          recordIncome(d, 'nil', p.value);
          p.taxRecorded = true;
          ctx.lines.push({ kind: 'note', label: `${p.label}: ${formatCents(p.value)} counted as NIL income (no cash)` });
        }
        break;
      }
      case 'tax_bucket_transfer': {
        const x = Math.min(amountOf(d, e.amount, ctx), Math.max(0, d.cash));
        d.cash -= x;
        d.taxBucket += x;
        ctx.lines.push({ kind: 'note', label: `${formatCents(x)} moved to your Tax Bucket` });
        break;
      }
      // Representative (R17)
      case 'terminate_representative_access':
        d.assets.forEach(a => {
          if (isActive(a) && a.holding === 'representative') a.status = 'terminated';
        });
        break;
      // Academic (B07)
      case 'clear_academic_risk':
        d.academicRisk = false;
        break;
      case 'schedule_academic_repair':
        d.tasks.push({
          id: `T${d.nextId++}`, cardId: ctx.card.id, title: ctx.card.title, label: 'Academic repair', kind: 'academic_repair',
          slots: 1, createdTurn: d.turn, dueTurn: d.turn + e.own_turns, reward: 0, mandatory: false, onComplete: [{ op: 'clear_academic_risk' }], status: 'open',
        });
        break;
      case 'cash_income': {
        const x = amountOf(d, e.amount, ctx);
        postCashIncome(d, x, e.tax_class);
        ctx.lines.push({ kind: 'income', label: 'NIL income', amount: x });
        break;
      }
      default:
        throw new LedgerError(`Unsupported scenario effect ${e.op}`);
    }
  });
}

function scenarioContext(d, sc, extra = {}) {
  const card = curveball(sc.cardId);
  return {
    card,
    eventId: sc.id,
    targetId: sc.targetId,
    recordId: sc.recordId || null,
    cashBefore: sc.cashBefore,
    targetValueBefore: sc.targetValueBefore,
    saved: sc.saved || {},
    faces: sc.faces || {},
    dice: () => {
      throw new LedgerError('Missing stored roll.');
    },
    elect: { legal: false, health: false, token: false, service: false },
    matter: { legal: { used: false, applied: 0 }, health: { used: false, applied: 0 } },
    lines: [],
    points: { rep: 0, career: 0 },
    assistance: 0,
    preview: false,
    ...extra,
  };
}

/** Draw a red or blue scenario for this landing; tables get their stored rolls now. */
function drawCurveball(d, color, pick, dice) {
  const pool = eligibleCurveballs(d, color);
  if (!pool.length) {
    d.scenario = { id: `S-${d.turn}`, cardId: null, color, turn: d.turn, status: 'clear' };
    log(d, { type: 'scenario', label: `${color === 'red' ? 'Red' : 'Blue'} space: all clear this turn`, cashDelta: 0 });
    return d.scenario;
  }
  const card = pool[Math.floor(Math.abs(pick || 0)) % pool.length];
  const record = scenarioRecord(d, card);
  const target = record.targetId ? d.assets.find(a => a.id === record.targetId) : null;
  const faces = {};
  Object.keys(card.chance || {}).forEach(t => {
    faces[t] = nextDie(dice);
  });
  const stats = d.scenarioStats[card.id] || { count: 0, lastTurn: -Infinity };
  d.scenarioStats[card.id] = { count: stats.count + 1, lastTurn: d.turn };
  d.scenario = {
    id: `S-${d.turn}`,
    cardId: card.id,
    color,
    turn: d.turn,
    status: 'pending',
    targetId: target ? target.id : null,
    targetTitle: target ? target.title : null,
    cashBefore: d.cash,
    targetValueBefore: target ? assetValue(d, target) : 0,
    recordId: record.recordId || null,
    faces,
    saved: {},
  };
  log(d, { type: 'scenario', label: card.title, cashDelta: 0 });
  return d.scenario;
}

/** Apply the immediate effects and the chosen response together, once. */
function respondScenario(d, choiceId, elect, preview = false, forced = false) {
  const sc = d.scenario;
  if (!sc || sc.status !== 'pending') throw new LedgerError('There is no curveball waiting for a response.');
  const card = curveball(sc.cardId);
  const choice = card.choices.find(c => c.id === choiceId);
  if (!choice) throw new LedgerError('Choose one of the responses.');
  const target = sc.targetId ? d.assets.find(a => a.id === sc.targetId) : null;
  const unmet = choice.requires.find(r => !requirementMet(d, r, target));
  if (unmet && !forced) throw new LedgerError('That response is not available right now.');
  const ctx = scenarioContext(d, sc, { elect: { ...elect }, preview, choiceLabel: choice.label });
  const cashStart = d.cash;
  applyEffects(d, card.immediate || [], ctx, true);
  // An unanswered card's default response is applied like a mandatory bill: cash first, then an event bill.
  applyEffects(d, choice.effects, ctx, forced);
  (choice.scheduled || []).forEach(item => {
    if (item.at) return; // e.g. R02 collection happens through the receivable's own collector
    const gated = item.effects.some(e => e.requires === 'task_completed');
    if (gated && ctx.newTask) ctx.newTask.onComplete = item.effects;
    else if (!gated) d.scheduled.push({ dueTurn: d.turn + item.after_own_turns, effects: item.effects, scenarioId: sc.id, cardId: card.id, targetId: sc.targetId, recordId: sc.recordId || null, saved: ctx.saved, lossId: ctx.lossId || null });
  });
  sc.status = 'resolved';
  sc.choiceId = choiceId;
  sc.saved = ctx.saved;
  const entry = {
    cardId: card.id,
    title: card.title,
    color: card.color,
    turn: d.turn,
    choice: choice.label,
    cashDelta: d.cash - cashStart,
    assistance: ctx.assistance,
    lines: ctx.lines,
  };
  if (!preview) {
    d.scenarioHistory.push(entry);
    if (EXTERNAL_SETBACKS.includes(card.id)) d.setbacks.push({ event_id: sc.id, external: true, adverse: true, committed: true, reversed: false, label: card.title });
    if (!forced) {
      (RESPONSE_EVIDENCE[card.id]?.[choiceId] || []).forEach(([dimension, outcome]) =>
        observe(d, { opportunity: sc.id, dimension, outcome, label: `${card.title}: ${choice.label}` }));
      // Support the player held that applied to this event: used or left unused.
      const comps = new Set([...(card.immediate || []), ...choice.effects].filter(e => e.op === 'expense').map(e => e.component));
      const held = plan => d.assets.some(a => a.holding === 'plan' && a.plan === plan && (a.uses > 0 || ctx.matter[plan].used));
      const applicable = (comps.has('eligible_legal_fee') && held('legal')) || (comps.has('health_expense') && held('health'));
      if (applicable) {
        const used = ctx.matter.legal.used || ctx.matter.health.used;
        observe(d, { opportunity: `${sc.id}-support`, dimension: 'purposeful_promotion', outcome: used ? 'apply_relevant_use' : 'leave_unused', label: used ? `Used support on ${card.title}` : `Kept support unused on ${card.title}` });
      }
    }
  }
  return { ...entry, points: ctx.points, navigate: ctx.navigate || null, unknown: Boolean(ctx.unknown) };
}

/** Portal step at the start of an own turn (offer search, expiry, placement follow-up). */
function portalStep(d, next, dice, events) {
  const p = d.portal;
  if (!p) return;
  const fakeCard = curveball('B05');
  const ctx = scenarioContext(d, { cardId: 'B05', id: p.eventId }, { card: fakeCard });
  const failSearch = () => {
    if (p.searches < 2) {
      p.stage = 'searching';
      p.searchTurn = next;
      return;
    }
    if (p.mode === 'entered' && !p.recoveryOffered) {
      applyEffects(d, PORTAL.no_placement_after_two_searches.effects, ctx, true);
      p.recoveryOffered = true;
      if (athleteActive(d)) {
        p.stage = 'offers';
        p.offers = [{ ...PORTAL.offers.find(o => o.id === 'O_BALANCED'), expiresTurn: next + 2 }];
        events.push({ type: 'portal', label: 'No placement after two searches. A support referral offers one balanced option.' });
        return;
      }
    }
    events.push({ type: 'portal', label: p.mode === 'entered' ? 'No transfer placement. Career, business and study continue.' : 'No better offer found. You keep your current place.' });
    d.portal = null;
  };
  if (p.stage === 'searching' && p.searchTurn <= next) {
    const face = nextDie(dice);
    p.searches += 1;
    const ids = PORTAL.step1.faces[String(face)];
    p.offers = ids.map(id => ({ ...PORTAL.offers.find(o => o.id === id), expiresTurn: next + 2 }));
    p.stage = 'offers';
    events.push({ type: 'portal', label: ids.length ? `Transfer search: ${ids.length} offer${ids.length > 1 ? 's' : ''} received` : 'Transfer search: no offers this time' });
    if (!ids.length) failSearch();
  } else if (p.stage === 'offers' && p.offers.every(o => o.expiresTurn < next)) {
    failSearch();
  } else if (p.stage === 'placed' && p.followTurn <= next) {
    const face = nextDie(dice);
    let band = PORTAL.followup_fit.die_faces[String(face)];
    const task = d.tasks.find(t => t.id === p.academicTaskId);
    if (task && task.status !== 'completed' && (band === 'positive' || band === 'extreme_positive')) band = 'middle';
    applyEffects(d, PORTAL.followup_fit.effects[band], ctx, true);
    events.push({ type: 'portal', label: `New team fit: ${band.replace('_', ' ')}` });
    d.behaviors.push({ turn: next, cardId: 'B05', tag: `transfer_${band}` });
    d.portal = null;
  }
}

// ---------------------------------------------------------------------------
// Operations
// ---------------------------------------------------------------------------

const handlers = {
  /** Legacy/manual cash change (expenses, untaxed receipts). May leave cash negative. */
  adjust_cash(d, { amount, label = 'Cash adjustment' }) {
    assertActive(d);
    d.cash += amount;
    log(d, { type: 'adjust', label, cashDelta: amount });
    return { cash: d.cash };
  },

  /** Taxable income. setAside moves part of it straight into the Tax Bucket. */
  income(d, { amount, taxClass = 'nil', setAside = 0, label = 'Income' }) {
    assertActive(d);
    if (!(amount > 0)) throw new LedgerError('Enter a positive amount.');
    if (setAside < 0 || setAside > amount) throw new LedgerError('Set-aside must be between $0 and the amount received.');
    if (!['nil', 'cashEarnings', 'contractGains', 'business'].includes(taxClass)) {
      throw new LedgerError('Unknown tax class.');
    }
    d.cash += amount - setAside;
    d.taxBucket += setAside;
    recordIncome(d, taxClass, amount);
    if (taxClass === 'nil') {
      d.nilPaidToDate = (d.nilPaidToDate || 0) + amount;
      applyIncomeShare(d, amount);
    }
    observe(d, {
      opportunity: `income-${d.seq + 1}`,
      dimension: 'planning',
      outcome: setAside > 0 ? 'review_or_prepare' : 'proceed_without_optional_preparation',
      label: setAside > 0 ? 'Set aside tax from NIL income' : 'Kept all NIL income available',
    });
    log(d, { type: 'income', label, cashDelta: amount - setAside, bucketDelta: setAside, taxClass });
    return { cash: d.cash, taxBucket: d.taxBucket };
  },

  /** NIL work paid later: an earned receivable collected (and taxed) when it arrives. */
  invoice(d, { amount, label = 'NIL invoice' }) {
    assertActive(d);
    if (!(amount > 0)) throw new LedgerError('Enter a positive amount.');
    const rep = d.assets.some(a => isActive(a) && a.holding === 'representative');
    const due = rep ? authored.receivables.representative_due_own_turns : authored.receivables.due_own_turns;
    const r = { id: `RCV${d.nextId++}`, label, amount, dueTurn: d.turn + due, originalDue: d.turn + due };
    d.receivables.push(r);
    log(d, { type: 'invoice', label: `${label} (paid in ${due} turn${due > 1 ? 's' : ''})`, cashDelta: 0 });
    return { receivableId: r.id, dueTurn: r.dueTurn };
  },

  reserve(d, { amount }) {
    assertActive(d);
    if (!(amount > 0) || amount > d.cash) throw new LedgerError('Not enough Available Cash to set aside.');
    d.cash -= amount;
    d.taxBucket += amount;
    log(d, { type: 'reserve', label: 'Moved to Tax Bucket', cashDelta: -amount, bucketDelta: amount });
    return { cash: d.cash, taxBucket: d.taxBucket };
  },

  release(d, { amount }) {
    assertActive(d);
    if (!(amount > 0) || amount > d.taxBucket) throw new LedgerError('The Tax Bucket does not hold that much.');
    d.taxBucket -= amount;
    d.cash += amount;
    log(d, { type: 'release', label: 'Moved from Tax Bucket', cashDelta: amount, bucketDelta: -amount });
    return { cash: d.cash, taxBucket: d.taxBucket };
  },

  /** The player's own movement roll: deadline check, then board progress and lap closes. */
  roll(d, { steps, diceCount = 1, draws = [], pick = 0 }) {
    assertActive(d);
    if (inFinalWindow(d)) throw new LedgerError('You have reached the final lap. Finish & Reveal when ready.');
    if (d.diceCount === null) d.diceCount = diceCount;
    const max = 6 * d.diceCount;
    if (!Number.isInteger(steps) || steps < d.diceCount || steps > max) {
      throw new LedgerError(`Enter a roll between ${d.diceCount} and ${max}.`);
    }
    const laps = [];
    const events = [];
    const dice = { list: draws, i: 0 };
    const missedTasks = startOwnTurn(d, dice, events);
    const checkpoint = evaluateDeadline(d);

    const target = Math.min(d.progress + steps, finalProgress(d));
    while (d.progress < target) {
      const boundary = (Math.floor(d.progress / d.boardSize) + 1) * d.boardSize;
      const end = Math.min(boundary, target, nextDuePoint(d));
      accrueAll(d, end - d.progress);
      d.progress = end;
      settleDue(d, dice, events);
      if (d.progress % d.boardSize === 0) {
        const closed = closeLap(d, d.progress / d.boardSize);
        if (closed) laps.push(closed);
      }
    }
    const final = d.progress >= finalProgress(d);
    const index = position(d);
    const landed = final || index === 0 ? null : boardSpace(index);
    d.opportunity = landed ? { category: landed.category, index, progress: d.progress, used: false } : null;
    const events_on = d.settings.landingEvents !== false;
    const yellow = events_on && landed && landed.category === 'yellow' ? clone(drawYellow(d, pick)) : null;
    const purple = events_on && landed && landed.category === 'purple' ? clone(drawPurple(d, pick)) : null;
    if (!(landed && (landed.category === 'red' || landed.category === 'blue')) && d.scenario && d.scenario.status !== 'pending') d.scenario = null;
    const scenario = events_on && landed && (landed.category === 'red' || landed.category === 'blue')
      ? clone(drawCurveball(d, landed.category, pick, dice))
      : null;
    log(d, {
      type: 'roll',
      label: final ? `Rolled ${steps} — reached the finish` : `Rolled ${steps} — space ${index}`,
      cashDelta: 0,
    });
    return { steps, checkpoint, closedLaps: laps, events, landed, final, progress: d.progress, yellow, purple, scenario, missedTasks };
  },

  pay_debt(d, { amount, loanId = null }) {
    assertActive(d);
    if (!(amount > 0)) throw new LedgerError('Enter a positive amount.');
    if (amount > d.cash) throw new LedgerError('Not enough Available Cash. Move money from the Tax Bucket first if you want to use it.');
    if (loanId && !d.loans.some(l => l.id === loanId)) throw new LedgerError('That loan is not open.');
    const used = allocatePayment(d, amount, loanId);
    if (used === 0) throw new LedgerError('There is no debt to pay.');
    d.cash -= used;
    pruneLoans(d);
    log(d, { type: 'pay_debt', label: 'Debt payment', cashDelta: -used });
    return { paid: used, cash: d.cash };
  },

  pay_taxes(d, { amount, source = 'cash', billId = null }) {
    assertActive(d);
    if (!(amount > 0)) throw new LedgerError('Enter a positive amount.');
    const fund = source === 'bucket' ? 'taxBucket' : 'cash';
    if (amount > d[fund]) throw new LedgerError(source === 'bucket' ? 'The Tax Bucket does not hold that much.' : 'Not enough Available Cash.');
    // Default order: oldest unpaid principal across bills, then oldest charges.
    const bills = billId ? d.taxBills.filter(b => b.id === billId) : [...d.taxBills].sort((a, b) => a.lap - b.lap);
    let left = amount;
    const pay = (b, portion) => {
      const i = d.taxBills.indexOf(b);
      const r = payTaxBill(b, portion);
      d.taxBills[i] = r.bill;
      left -= r.applied;
    };
    bills.forEach(b => left > 0 && pay(b, Math.min(left, taxBillPrincipal(b))));
    d.taxBills
      .filter(b => bills.some(x => x.id === b.id))
      .forEach(b => left > 0 && pay(b, Math.min(left, taxBillOwed(b))));
    const used = amount - left;
    if (used === 0) throw new LedgerError('There are no taxes owed.');
    d[fund] -= used;
    log(d, {
      type: 'pay_taxes',
      label: `Tax payment from ${source === 'bucket' ? 'Tax Bucket' : 'cash'}`,
      cashDelta: fund === 'cash' ? -used : 0,
      bucketDelta: fund === 'taxBucket' ? -used : 0,
    });
    return { paid: used };
  },

  /** Purchase with cash and optional financing. Creates the linked loan; caller records the asset. */
  buy(d, { kind, assetId, label, price, cashPart, cashOnly = false }) {
    assertActive(d);
    const q = quoteBuy(d, { kind, price, cashPart, cashOnly });
    if (!q.ok) throw new LedgerError(q.errors[0]);
    d.cash -= q.cashPart;
    let loanId = null;
    if (q.borrow > 0) {
      loanId = openLoan(d, {
        kind: kind === 'luxury' ? 'unsecured' : 'secured',
        assetId: kind === 'luxury' ? null : assetId,
        label,
        amount: q.borrow,
      }).id;
    }
    log(d, { type: 'buy', label: `Bought ${label}`, cashDelta: -q.cashPart, borrowed: q.borrow });
    return { cashPart: q.cashPart, borrowed: q.borrow, loanId, rateBps: q.rateBps };
  },

  /** Sell to the game at a quoted value (used for items the ledger does not hold). */
  sell(d, { assetId, label, value, basis, residualExit = false }) {
    assertActive(d);
    return settleSale(d, { assetId, label, value, basis, residualExit });
  },

  /** Borrow against a retained asset (secured, up to 50% of value less linked debt). */
  advance(d, { assetId, label, value, amount }) {
    assertActive(d);
    if (!(amount > 0)) throw new LedgerError('Enter a positive amount.');
    const asset = d.assets.find(a => a.id === assetId);
    if (asset && !advanceableAssets(d).some(a => a.id === assetId)) {
      throw new LedgerError('This holding cannot secure a loan.');
    }
    const q = quoteAdvance(d, { assetId, value });
    if (q.holds.length) throw new LedgerError(q.holds[0].message);
    if (amount > q.max) throw new LedgerError('That is more than this asset can support.');
    const name = asset ? asset.title : label;
    const existing = d.loans.find(l => l.assetId === assetId && l.kind === 'secured');
    if (existing) drawOnLoan(d, existing, amount);
    else openLoan(d, { kind: 'secured', assetId, label: `Advance on ${name}`, amount });
    d.cash += amount;
    log(d, { type: 'advance', label: `Borrowed against ${name}`, cashDelta: amount, borrowed: amount });
    return { cash: d.cash };
  },

  /**
   * Buy from the green or diamond menu on an unused matching landing. One committed
   * purchase uses the landing. face is the stored launch/outcome die where the card has one.
   */
  acquire(d, { entryId, assetId, cashPart, face = null, targetId = null, optionBps = BPS, confirmed = false }) {
    assertActive(d);
    const entry = catalogEntry(entryId);
    if (!entry) throw new LedgerError('Unknown card.');
    const q = quoteAcquire(d, { entryId, cashPart, targetId, optionBps });
    if (!q.ok) throw new LedgerError(q.errors[0]);
    const activation = isActivation(entry);
    const needsTarget = activation || ['attach', 'attach_rental', 'service'].includes(entry.parentMode);
    if (needsTarget && !targetId) throw new LedgerError(activation || entry.parentMode === 'service' ? 'Choose the business.' : 'Choose the asset to upgrade.');
    const needsFace = activation || Array.isArray(entry.launchTable);
    if (needsFace && !(Number.isInteger(face) && face >= 1 && face <= 6)) throw new LedgerError('Enter the die roll (1–6).');
    if (entry.entryOptionsBps && !entry.entryOptionsBps.includes(optionBps)) throw new LedgerError('Choose an ownership option.');
    if (entry.type === 'companion' && !confirmed) {
      throw new LedgerError('Confirm suitable housing and a backup caregiver first.');
    }

    const opportunityId = d.requireLanding ? `land-${d.turn}` : `buy-${assetId}`;
    const due = dueNow(d);
    consumeLanding(d, entry);
    const lap = currentLapNumber(d);
    if (entry.kind === 'investment' && !activation) {
      observe(d, { opportunity: opportunityId, dimension: 'investment', outcome: 'acquire', label: `Invested: ${entry.title}` });
      observe(d, { opportunity: opportunityId, dimension: 'risk_appetite', outcome: riskOutcome(entry), label: `Risk level of ${entry.title}` });
    }
    if (entry.kind === 'luxury' && !activation) observe(d, { opportunity: opportunityId, dimension: 'luxury', outcome: 'purchase', label: `Bought ${entry.title}` });
    if (activation) observe(d, { opportunity: opportunityId, dimension: 'purposeful_promotion', outcome: 'apply_relevant_use', label: `Promoted a business with ${entry.title}` });
    if (['YSH_SPONSOR', 'LX45'].includes(entry.id)) observe(d, { opportunity: `${opportunityId}-community`, dimension: 'community', outcome: 'participate', label: entry.title });
    if (due > 0) {
      const after = d.cash - q.funding.cashPart;
      observe(d, {
        opportunity: `${opportunityId}-due`,
        dimension: 'avoidable_overextension',
        outcome: after < due ? 'commit_despite_displaced_due_obligation' : 'preserve_due_obligation',
        label: after < due ? `Bought ${entry.title} with bills still due` : `Bought ${entry.title} and kept cash for bills due`,
      });
    }
    const price = q.price;
    d.cash -= q.funding.cashPart;
    const borrowed = q.funding.borrow;
    if (borrowed > 0) {
      const unsecured = fundingKind(entry) === 'luxury';
      openLoan(d, {
        kind: unsecured ? 'unsecured' : 'secured',
        assetId: unsecured ? null : entry.type === 'upgrade' ? targetId : assetId,
        label: entry.title,
        amount: borrowed,
      });
    }
    if (q.discount > 0 && entry.kind === 'luxury') d.discountLaps.push(lap);
    if (q.discount > 0 && entry.id === 'YSH_CLINIC') d.career.referral.used = true;

    const result = { entryId: entry.id, assetId: null, price, discount: q.discount, borrowed, face, rep: 0, career: 0 };
    const base = {
      id: assetId,
      cardId: entry.id,
      kind: entry.kind,
      title: entry.title,
      status: 'active',
      acquiredAt: d.progress,
      basis: price,
      exposure: [...entry.exposure],
      stages: [],
    };
    const add = holding => {
      d.assets.push({ ...base, ...holding });
      result.assetId = assetId;
    };

    if (activation) {
      const target = d.assets.find(a => a.id === targetId);
      const targetEntry = catalogEntry(target.cardId);
      const prepared = preparedFor(d, targetEntry ? pathForGroup(targetEntry.group) : null);
      const r = activationResult(price, face, prepared);
      result.prepared = prepared;
      d.cash += r.receipts;
      recordIncome(d, 'business', r.profit);
      d.activationLaps.push(lap);
      result.rep = awardFamily(d, 'activation', r.repCeiling);
      // Authored producers: merchandising launches create inventory orders; breakouts create prepaid orders.
      const inv = authored.inventory_orders;
      if (inv.producer_entries.includes(entry.id) && (target.exposure || []).includes('inventory')) {
        const stock = divHalfUp(price * inv.inventory_value_bps_of_budget, BPS);
        const sold = Math.min(1, r.receipts / Math.max(1, price));
        d.inventoryOrders.push({
          id: `ORD${d.nextId++}`, targetId, inventoryValue: stock,
          unsold: Math.min(assetValue(d, target), Math.round(stock * (1 - sold))),
          poor: inv.poor_result_faces.includes(face), openUntil: d.turn + inv.record_open_own_turns,
        });
      }
      const pre = authored.customer_prepayments;
      if (pre.producer_entries.includes(entry.id) && pre.faces.includes(face)) {
        const amount = divHalfUp(price * pre.prepayment_bps_of_budget, BPS);
        d.cash += amount; // customer money held as a liability until earned
        d.prepayments.push({ id: `PRE${d.nextId++}`, targetId, amount, unearned: amount, fulfilTurn: d.turn + pre.fulfil_after_own_turns });
        result.prepayments = amount;
      }
      Object.assign(result, { receipts: r.receipts, profit: r.profit, outcome: r.label, target: target.title });
    } else if (entry.kind === 'investment') {
      switch (entry.type) {
        case 'business':
        case 'property':
        case 'company':
        case 'company_property':
        case 'market_position': {
          const value = launchValue(price, entry.launchTable, face);
          const holding = isMarketProfile(entry.profile)
            ? { holding: 'market', profile: entry.profile, launchFace: face, value, circuitsDrawn: 0, draws: [] }
            : {
                holding: 'growth',
                profile: entry.profile,
                launchFace: face,
                rateBps: value > 0 ? continuingRate(entry.profile, entry.launchTable, face) : 0,
                anchorValue: value,
                anchorProgress: d.progress,
              };
          add({ ...holding, ownershipBps: optionBps, failed: value === 0, ...(ENABLED_VENTURES.includes(entry.id) ? { units: 10000, ventureId: assetId } : {}) });
          Object.assign(result, { value, failed: value === 0 });
          break;
        }
        case 'upgrade': {
          const parent = d.assets.find(a => a.id === targetId);
          const before = assetValue(d, parent);
          const increment = launchValue(price, entry.launchTable, face);
          parent.anchorValue = before + increment;
          parent.anchorProgress = d.progress;
          parent.basis += price;
          parent.rateBps = continuingRate(entry.profile, entry.launchTable, face);
          parent.profile = entry.profile;
          parent.stages.push(entry.id);
          entry.exposure.forEach(t => !parent.exposure.includes(t) && parent.exposure.push(t));
          Object.assign(result, { assetId: parent.id, parentValueBefore: before, value: parent.anchorValue, target: parent.title });
          break;
        }
        case 'event': {
          // Receipts follow the event's listed delivery; a referral only lowers what was paid.
          const r = eventResult(entry.price, entry.launchTable, face);
          r.profit = r.receipts - price;
          d.cash += r.receipts;
          recordIncome(d, 'business', r.profit);
          d.milestones.push(entry.id);
          Object.assign(result, { receipts: r.receipts, profit: r.profit, rep: entry.rep, career: entry.career });
          break;
        }
        case 'community_expense':
          d.milestones.push(entry.id);
          result.rep = entry.rep;
          break;
        case 'fixed_contract':
          if (entry.life) add({ holding: 'life', premium: entry.life.premium, face: entry.life.face, loan: null });
          else add({ holding: 'annuity', terms: buyAnnuity(entry.annuity, d.progress / d.boardSize), paymentsMade: 0 });
          break;
        case 'protection':
          add({ holding: 'plan', plan: entry.plan, uses: entry.uses, usesBought: entry.uses });
          break;
        case 'service':
          add({ holding: 'service_credit', targetId, components: entry.service.components, bps: entry.service.bps, cap: entry.service.cap, uses: entry.service.uses });
          break;
        case 'representative':
          add({ holding: 'representative' });
          break;
        default:
          throw new LedgerError('This card is not available yet.');
      }
    } else {
      switch (entry.type) {
        case 'owned_good':
          add({ holding: 'lux_good', resale: entry.initialResale, declineBps: entry.declineBps, discount: entry.discount });
          break;
        case 'service':
        case 'community_event':
          add({ holding: 'lux_service', rewardFamily: entry.rewardFamily, repMax: entry.repMax, completedAt: null });
          if (authored.event_bookings.producer_entries.includes(entry.id)) {
            d.bookings.push({
              id: `BK${d.nextId++}`, serviceId: assetId, price,
              deposit: divHalfUp(price * authored.event_bookings.refundable_deposit_bps_of_price, BPS),
              prepayments: authored.event_bookings.customer_prepayments_cents,
            });
          }
          break;
        case 'companion':
          add({ holding: 'companion', renewalCare: entry.renewalCare, pendingCare: null });
          break;
        case 'experience':
          d.experienceTurns[entry.id] = d.progress;
          break;
        case 'gift':
          break;
        default:
          throw new LedgerError('This item is not available yet.');
      }
    }

    const experiencePath = entry.kind === 'investment' ? pathForGroup(entry.group) : null;
    if (experiencePath) d.career.experience.push({ path: experiencePath, turn: d.turn, source: entry.id });
    d.purchases.push({
      entryId: entry.id,
      title: entry.title,
      kind: entry.kind,
      group: entry.group,
      price,
      borrowed,
      progress: d.progress,
      assetId: result.assetId,
      face,
      rep: result.rep,
    });
    log(d, {
      type: 'acquire',
      label: `Bought ${entry.title}`,
      cashDelta: -q.funding.cashPart + (result.receipts || 0),
      borrowed,
      detail: { entryId: entry.id, face },
    });
    return result;
  },

  /** Sell an owned holding to the game at its current value. */
  sell_asset(d, { assetId, residualExit = false }) {
    assertActive(d);
    const a = d.assets.find(x => x.id === assetId);
    if (!a || !isActive(a) || !['growth', 'market', 'lux_good'].includes(a.holding)) {
      throw new LedgerError('This holding cannot be sold.');
    }
    const value = assetValue(d, a);
    const r = settleSale(d, { assetId, label: a.title, value, basis: a.basis, residualExit });
    a.status = 'sold';
    a.closedValue = value;
    return { ...r, title: a.title };
  },

  policy_loan(d, { assetId, amount }) {
    assertActive(d);
    const a = d.assets.find(x => x.id === assetId && x.holding === 'life' && isActive(x));
    if (!a) throw new LedgerError('That policy is not active.');
    const h = holds(d).filter(x => x.code !== 'score');
    const q = policyLoanQuote(d, a, h);
    if (q.waiting) throw new LedgerError('Policy loans open after one full lap of ownership.');
    if (h.length) throw new LedgerError(h[0].message);
    if (!(amount > 0) || amount > q.max) throw new LedgerError(`You can borrow up to ${formatCents(q.max)}.`);
    a.loan = {
      principal: (a.loan ? a.loan.principal : 0) + amount,
      anchorBalance: q.balance + amount,
      anchorProgress: d.progress,
    };
    d.cash += amount;
    log(d, { type: 'policy_loan', label: `Policy loan on ${a.title}`, cashDelta: amount, borrowed: amount });
    return { balance: a.loan.anchorBalance };
  },

  policy_pay(d, { assetId, amount }) {
    assertActive(d);
    const a = d.assets.find(x => x.id === assetId && x.holding === 'life' && isActive(x));
    if (!a || !a.loan) throw new LedgerError('There is no policy loan to pay.');
    const balance = policyBalance(d, a);
    const pay = Math.min(amount, balance);
    if (!(pay > 0)) throw new LedgerError('Enter a positive amount.');
    if (pay > d.cash) throw new LedgerError('Not enough Available Cash.');
    const interest = Math.max(0, balance - a.loan.principal);
    const principalPaid = Math.max(0, pay - interest);
    d.cash -= pay;
    const left = balance - pay;
    a.loan = left > 0 ? { principal: a.loan.principal - principalPaid, anchorBalance: left, anchorProgress: d.progress } : null;
    log(d, { type: 'policy_pay', label: `Paid policy loan on ${a.title}`, cashDelta: -pay });
    return { paid: pay, interestPaid: Math.min(pay, interest), balance: left };
  },

  policy_cancel(d, { assetId }) {
    assertActive(d);
    const a = d.assets.find(x => x.id === assetId && x.holding === 'life' && isActive(x));
    if (!a) throw new LedgerError('That policy is not active.');
    const r = closePolicy(d, a, 'cancelled');
    log(d, { type: 'policy_cancel', label: `Cancelled ${a.title}`, cashDelta: r.cash });
    return r;
  },

  annuity_cancel(d, { assetId }) {
    assertActive(d);
    const a = d.assets.find(x => x.id === assetId && x.holding === 'annuity');
    if (!a) throw new LedgerError('That annuity is not active.');
    const q = annuityCancelQuote(d, a);
    if (!q.allowed) throw new LedgerError('Payments have started; the remaining schedule is locked.');
    d.cash += q.proceeds;
    recordIncome(d, 'contractGains', Math.max(0, q.proceeds - a.terms.premium));
    a.status = 'cancelled';
    a.closedValue = q.value;
    log(d, { type: 'annuity_cancel', label: `Cancelled ${a.title}`, cashDelta: q.proceeds });
    return q;
  },

  /** Deliver a paid service on a later turn; earned REP follows the family high-water mark. */
  complete_service(d, { assetId, choice = null }) {
    assertActive(d);
    const a = d.assets.find(x => x.id === assetId && x.holding === 'lux_service' && isActive(x));
    if (!a) throw new LedgerError('That service is not open.');
    if (d.progress <= a.acquiredAt) throw new LedgerError('Delivery happens on a later turn. Roll first.');
    if (a.blockedUntilTurn && d.turn <= a.blockedUntilTurn) throw new LedgerError(`Rescheduled: deliver it after turn ${a.blockedUntilTurn}.`);
    const entry = catalogEntry(a.cardId);
    if (entry.completion && entry.completion.choices && !choice) throw new LedgerError('Make a choice first.');
    const rep = a.repMax ? awardFamily(d, a.rewardFamily, a.repMax) : 0;
    a.status = 'completed';
    a.completedAt = d.progress;
    a.choice = choice;
    log(d, { type: 'service_complete', label: `Completed ${a.title}`, cashDelta: 0 });
    return { rep };
  },

  /** Care for a companion's new lap: pay cash, use credit, or move it to trusted household care. */
  companion_care(d, { assetId, method, cashPart = null }) {
    assertActive(d);
    const a = d.assets.find(x => x.id === assetId && x.holding === 'companion' && isActive(x));
    if (!a || !a.pendingCare) throw new LedgerError('No care is due for this companion.');
    const amount = a.pendingCare.amount;
    if (method === 'rehome') {
      a.status = 'rehomed';
      a.pendingCare = null;
      log(d, { type: 'companion', label: `${a.title} moved to trusted household care`, cashDelta: 0 });
      return { paid: 0 };
    }
    const cp = method === 'cash' ? amount : Math.max(0, Math.min(amount, cashPart ?? 0));
    const q = quoteBuy(d, { kind: 'luxury', price: amount, cashPart: cp });
    if (!q.ok) throw new LedgerError(q.errors[0]);
    d.cash -= q.cashPart;
    if (q.borrow > 0) openLoan(d, { kind: 'unsecured', label: `${a.title} care`, amount: q.borrow });
    a.pendingCare = null;
    log(d, { type: 'companion', label: `${a.title} care`, cashDelta: -q.cashPart, borrowed: q.borrow });
    return { paid: amount, borrowed: q.borrow };
  },

  /**
   * A legacy fixed curveball expense with optional plan help on its eligible component.
   * Legal Support pays 80% of eligible legal fees (cap $25,000); Health Support pays 80% of
   * health expense (cap $20,000). Settlements and other components are never covered.
   */
  legacy_expense(d, { amount, label, legalFee = 0, healthFee = 0, useLegal = false, useHealth = false, useToken = false }) {
    assertActive(d);
    if (!(amount > 0)) throw new LedgerError('Enter a positive amount.');
    const consume = plan => {
      const p = d.assets.find(a => isActive(a) && a.holding === 'plan' && a.plan === plan && a.uses > 0);
      if (!p) throw new LedgerError(`No ${plan} support uses left.`);
      p.uses -= 1;
    };
    let assistance = 0;
    if (useLegal && legalFee > 0) {
      consume('legal');
      assistance += legalAssistance(Math.min(legalFee, amount));
    }
    if (useHealth && healthFee > 0) {
      consume('health');
      assistance += Math.min(HEALTH_ASSIST_LIMITS.cap, divHalfUp(Math.min(healthFee, amount) * HEALTH_ASSIST_LIMITS.bps, BPS));
    }
    assistance = Math.min(assistance, amount);
    // An emergency token (Y03) pays the remaining mandatory expense last, up to its limit.
    let tokenPaid = 0;
    if (useToken) {
      if (TOKEN_EXCLUDED.some(x => label.startsWith(x))) throw new LedgerError('The Emergency Fund cannot pay taxes, debt or market losses.');
      const token = d.assets.find(a => isActive(a) && a.holding === 'token' && a.uses > 0);
      if (!token) throw new LedgerError('No Emergency Fund available.');
      tokenPaid = Math.min(token.limit, amount - assistance);
      token.uses -= 1;
      token.status = 'used';
    }
    const paid = amount - assistance - tokenPaid;
    d.cash -= paid;
    if (RECOVERABLE_LOSSES.some(x => label.startsWith(x)) && paid > 0) {
      d.losses.push({ id: `loss-${d.seq + 1}`, label, amount: paid, recovered: 0 });
    }
    log(d, { type: 'expense', label, cashDelta: -paid, detail: { assistance, tokenPaid } });
    return { assistance: assistance + tokenPaid, paid, tokenPaid };
  },

  /** Complete the purple offer on a chosen path (internships are accepted here, not awarded). */
  career_complete(d, { pathId, choiceId }) {
    assertActive(d);
    const c = d.career;
    const offer = c.offer;
    if (!offer || offer.status !== 'offered') throw new LedgerError('There is no career opportunity waiting.');
    const p = careerPath(pathId);
    if (!p) throw new LedgerError('Choose a career path.');
    const choice = familyChoices(offer.family, pathId).find(x => x.id === choiceId);
    if (!choice) throw new LedgerError('Choose one of the options.');
    const allowed = pathAllowed(d, offer.family, pathId);
    if (!allowed.ok) throw new LedgerError(allowed.reason);
    if (offer.family === 'resume_workshop' && choiceId === 'experience' && !c.experience.length) {
      throw new LedgerError('You have no experience cards yet. Use the beginner template.');
    }
    offer.status = 'done';

    if (offer.family === 'internship') {
      if (c.internship) throw new LedgerError('You already have an internship in progress.');
      observe(d, { opportunity: offer.id, dimension: 'development', outcome: 'complete', label: `Accepted an internship: ${p.name}` });
      c.internship = { id: offer.id, path: pathId, assignment: choiceId, label: choice.label, competency: choice.competency, state: 'active', dueTurn: d.turn + 1, extended: false };
      careerRecord(d, { family: 'internship', path: pathId, status: 'accepted', choice: choice.label, rep: 0, career: 0 });
      log(d, { type: 'career', label: `Internship accepted: ${p.name}`, cashDelta: 0 });
      return { accepted: true, rep: 0, career: 0 };
    }

    const award = awardCareer(d, offer.family, pathId);
    observe(d, { opportunity: offer.id, dimension: 'development', outcome: 'complete', label: `${careerFamily(offer.family).name}: ${p.name}` });
    if (offer.family === 'community_service') observe(d, { opportunity: offer.id, dimension: 'community', outcome: 'participate', label: 'Community service' });
    if (choice.competency) c.competencies.push(choice.competency);
    if (choice.contact) c.contacts.push(`${choice.contact}:${pathId}`);
    if (offer.family === 'graduation') c.graduated = true;
    let referral = false;
    if (offer.family === 'mentoring' && award.rewarded) {
      c.mentorVisits[pathId] = [...(c.mentorVisits[pathId] || []), d.turn];
      if (pathId === REFERRAL.source_path && !(c.referral && !c.referral.used)) {
        c.referral = { used: false, issuedTurn: d.turn };
        referral = true;
      }
    }
    careerRecord(d, { family: offer.family, path: pathId, status: 'completed', choice: choice.label, rep: award.rep, career: award.career });
    log(d, { type: 'career', label: `${careerFamily(offer.family).name}: ${p.name}`, cashDelta: 0 });
    return { ...award, referral };
  },

  career_decline(d) {
    assertActive(d);
    const offer = d.career.offer;
    if (!offer || offer.status !== 'offered') throw new LedgerError('There is no career opportunity waiting.');
    offer.status = 'declined';
    careerRecord(d, { family: offer.family, path: null, status: 'declined', rep: 0, career: 0 });
    observe(d, { opportunity: offer.id, dimension: 'development', outcome: 'decline', label: `Declined ${careerFamily(offer.family).name}` });
    if (offer.family === 'community_service') observe(d, { opportunity: offer.id, dimension: 'community', outcome: 'decline', label: 'Declined community service' });
    return { rep: 0, career: 0 };
  },

  /** Internship follow-up on the due turn: complete, extend once, withdraw, or the single repair. */
  internship_action(d, { action }) {
    assertActive(d);
    const c = d.career;
    const i = c.internship;
    if (!i) throw new LedgerError('There is no internship in progress.');
    const due = d.turn >= i.dueTurn;
    const finish = status => {
      careerRecord(d, { family: 'internship', path: i.path, status, choice: i.label, rep: 0, career: 0 });
      c.internship = null;
    };
    const opp = `intern-${i.id}`;
    if (action === 'withdraw') observe(d, { opportunity: opp, dimension: 'follow_through', outcome: 'communicated_withdrawal', label: 'Withdrew from an internship with notice' });
    if (action === 'decline_repair') observe(d, { opportunity: opp, dimension: 'recovery', outcome: 'decline_feasible_recovery', label: 'Closed an internship repair' });
    if (action === 'withdraw' || action === 'decline_repair') {
      finish(action === 'withdraw' ? 'withdrawn' : 'closed_unfinished');
      return { rep: 0, career: 0 };
    }
    if (!due) throw new LedgerError('The follow-up is on your next turn. Roll first.');
    if (action === 'extend') {
      if (i.state !== 'active' || i.extended) throw new LedgerError('The one extension has already been used.');
      i.state = 'extended';
      i.extended = true;
      i.dueTurn = d.turn + 1;
      return { rep: 0, career: 0 };
    }
    if (action === 'complete' || action === 'repair') {
      if (action === 'repair' && i.state !== 'repair') throw new LedgerError('No repair is open.');
      if (action === 'complete' && i.state === 'repair') throw new LedgerError('Use the repair option.');
      const award = awardCareer(d, 'internship', i.path);
      if (action === 'repair') observe(d, { opportunity: opp, dimension: 'recovery', outcome: 'complete_recovery', label: 'Repaired a missed internship follow-up' });
      else observe(d, { opportunity: opp, dimension: 'follow_through', outcome: 'complete', label: 'Completed an internship' });
      c.competencies.push(`internship:${i.path}:${i.competency}`);
      careerRecord(d, { family: 'internship', path: i.path, status: 'completed', choice: i.label, rep: award.rep, career: award.career });
      c.internship = null;
      log(d, { type: 'career', label: 'Internship completed', cashDelta: 0 });
      return award;
    }
    throw new LedgerError('Unknown action.');
  },

  /**
   * Coach J-Bo advice for one decision. The first delivery for a decision id spends one of the
   * game's three credits; asking again for the same decision replays it for free.
   */
  coach_advice(d, { decisionId, advice }) {
    assertActive(d);
    if (d.coach.cache[decisionId]) return { ...d.coach.cache[decisionId], replay: true, credits: d.coach.credits };
    if (!advice || !advice.recommendation) throw new LedgerError('Coach J-Bo has no advice for this yet. No credit was used.');
    if (d.coach.credits <= 0) throw new LedgerError('No Coach J-Bo credits left this game.');
    d.coach.credits -= 1;
    d.coach.cache[decisionId] = advice;
    log(d, { type: 'coach', label: 'Coach J-Bo advice', cashDelta: 0 });
    return { ...advice, replay: false, credits: d.coach.credits };
  },

  /**
   * Seller side of a committed share transfer (founder or partner): prorated basis, 20% gain
   * tax, the proportional payoff of loans linked to this holding, then net cash. The company
   * receives nothing and the buyer takes on no debt.
   */
  venture_settle_sale(d, { ventureId, units, gross }) {
    assertActive(d);
    const a = d.assets.find(x => isActive(x) && x.ventureId === ventureId && (x.holding === 'growth' || x.holding === 'venture_stake'));
    if (!a) throw new LedgerError('You hold no shares in this company.');
    const owned = a.units;
    if (!(units > 0) || units > owned) throw new LedgerError('More units than you own.');
    const basisSold = divHalfUp(a.basis * units, owned);
    const tax = divHalfUp(Math.max(0, gross - basisSold) * GAIN_TAX_BPS, BPS);
    const debt = linkedDebt(d, a.id);
    const payoff = divHalfUp(debt * units, owned);
    let left = payoff;
    d.loans.filter(l => l.assetId === a.id).forEach(l => {
      if (left > 0) left -= allocatePayment(d, Math.min(left, loanBalance(d, l)), l.id);
    });
    pruneLoans(d);
    d.cash += gross - tax - payoff;
    a.units -= units;
    a.basis -= basisSold;
    if (a.units === 0) {
      a.status = 'sold';
      a.closedValue = gross;
    }
    log(d, { type: 'venture_sale', label: `Sold ${units / 100}% of ${a.title}`, cashDelta: gross - tax - payoff });
    return { gross, tax, payoff, net: gross - tax - payoff, unitsLeft: a.units };
  },

  /**
   * Buyer side of a committed share transfer. Eligibility and cash were checked before the
   * shared transfer committed, so this applies it exactly once (op id = transfer id).
   */
  venture_buy(d, { ventureId, units, gross, companyValue, title }) {
    assertActive(d);
    if (d.requireLanding && d.opportunity && !d.opportunity.used && d.opportunity.category === 'green') d.opportunity.used = true;
    d.cash -= gross;
    const existing = d.assets.find(x => isActive(x) && x.holding === 'venture_stake' && x.ventureId === ventureId);
    if (existing) {
      existing.units += units;
      existing.basis += gross;
      existing.companyValue = companyValue;
    } else {
      d.assets.push({
        id: `stake-${ventureId}`, cardId: 'YSH_COMPLEX', kind: 'investment', title, holding: 'venture_stake', status: 'active',
        acquiredAt: d.progress, basis: gross, exposure: ['operating_business', 'rental_property'], stages: [], ventureId, units, companyValue,
        profile: 'house_locked',
      });
    }
    observe(d, { opportunity: `venture-${ventureId}-${d.turn}`, dimension: 'investment', outcome: 'acquire', label: `Bought ${units / 100}% of ${title}` });
    observe(d, { opportunity: `venture-${ventureId}-${d.turn}`, dimension: 'risk_appetite', outcome: 'choose_high', label: 'Shared sports complex' });
    log(d, { type: 'venture_buy', label: `Bought ${units / 100}% of ${title}`, cashDelta: -gross });
    return { units, gross };
  },

  /** A partner's view of the founder's published company value (no cash effect). */
  venture_sync(d, { ventureId, companyValue, stopped = false, failed = false }) {
    assertActive(d);
    const a = d.assets.find(x => isActive(x) && x.holding === 'venture_stake' && x.ventureId === ventureId);
    if (!a) return { synced: false };
    a.companyValue = companyValue;
    a.companyStopped = stopped;
    a.companyFailed = failed;
    return { synced: true };
  },

  /** Answer the drawn yellow card. Its base benefit has already posted. */
  yellow_choose(d, { choiceId }) {
    assertActive(d);
    const r = resolveYellow(d, choiceId);
    log(d, { type: 'yellow_choice', label: `Chose: ${r.choice}`, cashDelta: 0 });
    return r;
  },

  /** Complete an optional follow-up during its due turn; the reward posts once. */
  task_complete(d, { taskId }) {
    assertActive(d);
    const t = d.tasks.find(x => x.id === taskId);
    if (!t || t.status !== 'open') throw new LedgerError('That task is not open.');
    if (d.turn < t.dueTurn) throw new LedgerError('This task is due on your next turn. Roll first.');
    if (t.mandatory) throw new LedgerError('This commitment ends on its own.');
    t.status = 'completed';
    t.completedTurn = d.turn;
    observe(d, { opportunity: `task-${t.id}`, dimension: 'follow_through', outcome: 'complete', label: `Completed: ${t.label}` });
    if (t.reward > 0) postCashIncome(d, t.reward, t.taxClass);
    if (t.cardId === 'Y10') {
      d.perks.push({ id: `PERK${d.nextId++}`, label: 'Sponsor gear package', value: authored.sponsor_perk.taxable_value_cents, taxRecorded: false });
    }
    let points = { rep: 0, career: 0 };
    if (t.onComplete && t.onComplete.length) {
      const ctx = scenarioContext(d, { cardId: t.cardId, id: t.eventId, targetId: t.targetId, recordId: t.recordId, saved: t.saved }, { taskCompleted: true });
      applyEffects(d, t.onComplete, ctx, true);
      points = ctx.points;
    }
    log(d, { type: 'task_complete', label: `Completed: ${t.title}`, cashDelta: t.reward });
    return { reward: t.reward, points };
  },

  /** Respond to the drawn curveball. elect: which owned protections to use. */
  scenario_respond(d, { choiceId, elect = {}, preview = false }) {
    assertActive(d);
    return respondScenario(d, choiceId, elect, preview);
  },

  /** Pay an event bill (settlement, advance claim, shortfall) from Available Cash. */
  pay_payable(d, { payableId, amount }) {
    assertActive(d);
    const p = d.payables.find(x => x.id === payableId && x.amount > 0);
    if (!p) throw new LedgerError('That bill is already paid.');
    const x = Math.min(amount, p.amount);
    if (!(x > 0)) throw new LedgerError('Enter a positive amount.');
    if (x > d.cash) throw new LedgerError('Not enough Available Cash.');
    d.cash -= x;
    p.amount -= x;
    if (p.amount === 0) p.overdue = false;
    log(d, { type: 'pay_payable', label: `Paid ${p.label}`, cashDelta: -x });
    return { paid: x, remaining: p.amount };
  },

  /** Accept one transfer offer: signing payment and moving cost post together. */
  portal_accept(d, { offerId }) {
    assertActive(d);
    const p = d.portal;
    if (!p || p.stage !== 'offers') throw new LedgerError('There is no transfer offer open.');
    const o = p.offers.find(x => x.id === offerId && x.expiresTurn >= d.turn);
    if (!o) throw new LedgerError('That offer has expired.');
    if (d.cash + o.nil_signing_cash_cents < o.uncovered_move_cost_cents) throw new LedgerError('Not enough cash to cover the move after the signing payment.');
    postCashIncome(d, o.nil_signing_cash_cents, 'nil');
    d.cash -= o.uncovered_move_cost_cents;
    const task = {
      id: `T${d.nextId++}`, cardId: 'B05', title: 'Transfer', label: 'Academic transfer paperwork', kind: 'transfer_academic',
      slots: o.academic_task_slots, createdTurn: d.turn, dueTurn: d.turn + o.academic_task_due_own_turns, reward: 0, mandatory: false, status: 'open',
    };
    d.tasks.push(task);
    // The fit follow-up comes after the paperwork's own due turn, so finishing it can count.
    Object.assign(p, { stage: 'placed', placed: o.id, followTurn: task.dueTurn + 1, academicTaskId: task.id, offers: [] });
    log(d, { type: 'portal', label: `Transferred: ${o.title}`, cashDelta: o.nil_signing_cash_cents - o.uncovered_move_cost_cents });
    return { signing: o.nil_signing_cash_cents, moveCost: o.uncovered_move_cost_cents };
  },

  /** Leave the transfer process (information mode keeps your current place). */
  portal_stay(d) {
    assertActive(d);
    if (!d.portal) throw new LedgerError('There is no transfer process open.');
    d.behaviors.push({ turn: d.turn, cardId: 'B05', tag: d.portal.mode === 'information' ? 'informed_stay' : 'portal_withdrawn' });
    d.portal = null;
    return { stayed: true };
  },

  /** Host content settings, fixed once the first roll happens. */
  set_setting(d, { key, value }) {
    if (d.turn > 0) throw new LedgerError('Content settings are fixed once the game starts.');
    if (!['familyExpansionContent'].includes(key)) throw new LedgerError('Unknown setting.');
    d.settings[key] = Boolean(value);
    return { [key]: d.settings[key] };
  },

  /** Release an optional task to free a slot; its unearned reward is forgone. */
  task_release(d, { taskId }) {
    assertActive(d);
    const t = d.tasks.find(x => x.id === taskId);
    if (!t || t.status !== 'open') throw new LedgerError('That task is not open.');
    t.status = 'released';
    observe(d, { opportunity: `task-${t.id}`, dimension: 'follow_through', outcome: 'communicated_withdrawal', label: `Released: ${t.label}` });
    log(d, { type: 'task_release', label: `Released: ${t.title}`, cashDelta: 0 });
    return { released: true };
  },

  /**
   * Finish & Reveal. Resolves the last deadline, applies the initial late charge to any
   * unpaid not-yet-overdue tax bill, and freezes the result. Holdings are valued from the
   * ledger at the cutoff; points and other liabilities come from the caller.
   */
  finish(d, { external = {} }) {
    if (d.snapshot) return d.snapshot;
    // No new offers at Finish: a waiting card takes its cost-free branch; open tasks lapse unearned.
    if (d.yellow && d.yellow.status === 'pending') resolveYellow(d, defaultChoice(yellowCard(d.yellow.cardId)));
    d.tasks.forEach(t => {
      if (t.status === 'open') t.status = 'expired';
    });
    if (d.career.internship) {
      careerRecord(d, { family: 'internship', path: d.career.internship.path, status: 'closed_unfinished', rep: 0, career: 0 });
      d.career.internship = null;
    }
    if (d.career.offer && d.career.offer.status === 'offered') d.career.offer.status = 'declined';
    if (d.scenario && d.scenario.status === 'pending') respondScenario(d, defaultResponse(curveball(d.scenario.cardId)), {}, false, true);
    // Committed follow-ups settle with their stored outcome; task-gated rewards are not earned.
    d.scheduled.forEach(item => {
      const ctx = scenarioContext(d, { cardId: item.cardId, id: item.scenarioId, targetId: item.targetId, recordId: item.recordId, saved: item.saved }, { lossId: item.lossId });
      applyEffects(d, item.effects, ctx, true);
    });
    d.scheduled = [];
    d.portal = null;
    // Earned receivables settle once; prepaid orders are fulfilled; delivered perks are taxed.
    d.receivables.forEach(r => {
      if (r.amount > 0) {
        const x = r.amount;
        r.amount = 0;
        postCashIncome(d, x, 'nil');
      }
    });
    d.prepayments.forEach(p => {
      if (p.unearned > 0) {
        recordIncome(d, 'business', p.unearned);
        p.unearned = 0;
      }
    });
    d.perks.forEach(p => {
      if (!p.taxRecorded) {
        recordIncome(d, 'nil', p.value);
        p.taxRecorded = true;
      }
    });
    // Income in an unfinished lap still gets one provisional bill.
    const lap = incomeLap(d);
    if (!d.closedLaps.includes(lap) && d.taxIncome[lap]) rebill(d, lap);
    evaluateDeadline(d);
    d.taxBills.forEach((b, i) => {
      if (b.originalOverdue === null) d.taxBills[i] = chargeTaxBill(b, 'finish').bill;
    });
    d.loans.forEach(l => postAccrual(d, l, lap));
    const held = holdingsValue(d);
    const snapshot = {
      rulesetId: d.rulesetId,
      progress: d.progress,
      completedLaps: completedLaps(d),
      cash: d.cash,
      taxBucket: d.taxBucket,
      ordinaryDebt: totalBorrowing(d),
      taxesOwed: taxesOwed(d),
      creditScore: d.creditScore,
      creditBonus: band(d.creditScore).creditBonus,
      ledgerSequence: d.seq,
      eventLiabilities: eventLiabilities(d),
      reveal: classify(d.observations, d.setbacks),
      evidence: { observations: clone(d.observations), setbacks: clone(d.setbacks) },
      points: { rep: displayRep(d), career: d.points.career },
      external: clone(external),
      holdings: d.assets
        .filter(isActive)
        .map(a => ({ id: a.id, cardId: a.cardId, title: a.title, holding: a.holding, value: assetValue(d, a) })),
    };
    snapshot.score = scoreBreakdown({
      assetsValue: held.assetsValue,
      luxuryResale: held.luxuryResale,
      policyDebt: held.policyDebt,
      ...external,
      otherLiabilities: eventLiabilities(d) + (external.otherLiabilities || 0),
      rep: displayRep(d),
      career: d.points.career,
      cash: d.cash,
      taxBucket: d.taxBucket,
      ordinaryDebt: snapshot.ordinaryDebt,
      taxesOwed: snapshot.taxesOwed,
      creditScore: d.creditScore,
    });
    d.snapshot = snapshot;
    log(d, { type: 'finish', label: 'Finish & Reveal', cashDelta: 0 });
    return snapshot;
  },
};

/** Apply one operation. Returns { state, result }. Throws LedgerError on rejection. */
export function applyOp(state, op) {
  const { id, type, ...payload } = op;
  if (!id) throw new LedgerError('operation id required');
  const key = JSON.stringify([type, payload]);
  const prior = state.receipts[id];
  if (prior) {
    if (prior.key !== key) throw new LedgerError('operation id reused for a different action', 'conflict');
    return { state, result: clone(prior.result), replayed: true };
  }
  if (type === 'finish' && state.snapshot) return { state, result: clone(state.snapshot), replayed: true };
  const handler = handlers[type];
  if (!handler) throw new LedgerError(`unknown operation ${type}`);

  const draft = clone(state);
  const result = handler(draft, payload);
  // Handlers that award REP / Career report them as result.rep / result.career.
  if (result && type !== 'roll' && (result.rep || result.career) && !result.points) addPoints(draft, result.rep || 0, result.career || 0, type);
  draft.receipts[id] = { key, result: clone(result) };
  draft.receiptOrder.push(id);
  if (draft.receiptOrder.length > RECEIPT_LIMIT) {
    draft.receiptOrder.splice(0, draft.receiptOrder.length - RECEIPT_LIMIT).forEach(old => {
      delete draft.receipts[old];
    });
  }
  return { state: draft, result: clone(result), replayed: false };
}

/**
 * Quote one curveball response for the choice screen. Numbers come from a preview that
 * skips chance tables (so a stored roll is never revealed); availability comes from a
 * full trial on a copy. Nothing here changes the real ledger.
 */
export function quoteScenario(s, choiceId, elect = {}) {
  let available = true;
  let reason = null;
  try {
    applyOp(s, { id: `quote-check-${choiceId}`, type: 'scenario_respond', choiceId, elect });
  } catch (e) {
    available = false;
    reason = e.message;
  }
  try {
    const { state, result } = applyOp(s, { id: `quote-${choiceId}`, type: 'scenario_respond', choiceId, elect, preview: true });
    const before = new Set(s.payables.map(p => p.id));
    return {
      available,
      reason,
      cashDelta: state.cash - s.cash,
      assistance: result.assistance,
      newBills: state.payables.filter(p => !before.has(p.id) && p.amount > 0),
      lines: result.lines,
      chance: result.unknown,
      points: result.points,
    };
  } catch (e) {
    return { available: false, reason: e.message, cashDelta: 0, assistance: 0, newBills: [], lines: [], chance: false, points: { rep: 0, career: 0 } };
  }
}

/** What a founder publishes for their shared company (null if they have none). */
export function founderVenture(s) {
  const a = s.assets.find(x => x.holding === 'growth' && x.ventureId && (isActive(x) || x.status === 'sold'));
  if (!a) return null;
  return {
    ventureId: a.ventureId,
    title: a.title,
    value: isActive(a) ? companyValueOf(s, a) : a.closedValue || 0,
    rateBps: a.rateBps,
    progress: s.progress,
    units: a.units,
    failed: Boolean(a.failed) || (isActive(a) && companyValueOf(s, a) === 0),
    stopped: Boolean(s.snapshot),
  };
}

/** Can this player buy listed shares right now? Returns { ok, reason }. */
export function ventureBuyStatus(s, { gross, sellerId, selfId, founderStopped }) {
  if (s.snapshot) return { ok: false, reason: 'Your game is finished.' };
  if (founderStopped) return { ok: false, reason: 'The founder has finished; no new purchases.' };
  if (sellerId === selfId) return { ok: false, reason: 'These are your own shares.' };
  const missing = PARTNER_REQUIREMENTS.filter(id => !s.milestones.includes(id));
  if (missing.length) return { ok: false, reason: 'Sponsor a youth team and host a clinic first.' };
  if (s.requireLanding && !(s.opportunity && !s.opportunity.used && s.opportunity.category === 'green')) {
    return { ok: false, reason: 'Land on a green space to buy shares.' };
  }
  if (gross > s.cash) return { ok: false, reason: 'Shares are cash only and you need more Available Cash.' };
  return { ok: true };
}

let opCounter = 0;
export function newOpId(prefix = 'op') {
  opCounter += 1;
  return `${prefix}-${Date.now().toString(36)}-${opCounter}-${Math.random().toString(36).slice(2, 7)}`;
}
