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
import { catalogEntry, isActivation } from './catalog';
import {
  launchValue, continuingRate, isMarketProfile, marketDrawBps, eventResult, activationResult,
  assetValue, policyBalance, policyLoanQuote, annuityCancelQuote, holdingsValue, eligibility,
  productionDiscount, currentLapNumber, isActive, HEALTH_ASSIST_LIMITS,
} from './holdings';
import {
  yellowCard, eligibleYellow, yellowChoices, defaultChoice, createsSponsorRelationship,
  licensableContent, unrecoveredLoss, SPONSOR_RELATIONSHIP_TURNS, TOKEN_EXCLUDED, RECOVERABLE_LOSSES,
} from './nil';

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

export function createLedger({ openingCash, totalLaps = 5, boardSize = BOARD_SIZE }) {
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
  const discount = entry.kind === 'luxury' ? Math.min(scaled, productionDiscount(s, entry)) : 0;
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
  d.pendingDeadline = {
    lap,
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
  const debtFree = d.loans.every(l => loanBalance(d, l) === 0);
  const netReduction = nonneg(p.principalRepaid - p.newDraws);
  const before = d.creditScore;
  d.creditScore = creditCheckpoint(before, current, debtFree, netReduction, p.basis);

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
// Yellow NIL opportunities
// ---------------------------------------------------------------------------

function postCashIncome(d, amount, taxClass) {
  d.cash += amount;
  recordIncome(d, taxClass === 'business' ? 'business' : 'nil', amount);
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
function startOwnTurn(d) {
  if (d.yellow && d.yellow.status === 'pending') resolveYellow(d, defaultChoice(yellowCard(d.yellow.cardId)));
  const next = d.turn + 1;
  const missed = [];
  d.tasks.forEach(t => {
    if (t.status === 'open' && t.dueTurn < next) {
      t.status = 'missed';
      missed.push(t);
    }
  });
  d.turn = next;
  d.yellow = null;
  return missed;
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
    log(d, { type: 'income', label, cashDelta: amount - setAside, bucketDelta: setAside, taxClass });
    return { cash: d.cash, taxBucket: d.taxBucket };
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
    const missedTasks = startOwnTurn(d);
    const checkpoint = evaluateDeadline(d);

    const target = Math.min(d.progress + steps, finalProgress(d));
    const laps = [];
    const events = [];
    const dice = { list: draws, i: 0 };
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
    const yellow = landed && landed.category === 'yellow' ? clone(drawYellow(d, pick)) : null;
    log(d, {
      type: 'roll',
      label: final ? `Rolled ${steps} — reached the finish` : `Rolled ${steps} — space ${index}`,
      cashDelta: 0,
    });
    return { steps, checkpoint, closedLaps: laps, events, landed, final, progress: d.progress, yellow, missedTasks };
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
    const needsTarget = activation || entry.parentMode === 'attach' || entry.parentMode === 'attach_rental';
    if (needsTarget && !targetId) throw new LedgerError(activation ? 'Choose the business to promote.' : 'Choose the asset to upgrade.');
    const needsFace = activation || Array.isArray(entry.launchTable);
    if (needsFace && !(Number.isInteger(face) && face >= 1 && face <= 6)) throw new LedgerError('Enter the die roll (1–6).');
    if (entry.entryOptionsBps && !entry.entryOptionsBps.includes(optionBps)) throw new LedgerError('Choose an ownership option.');
    if (entry.type === 'companion' && !confirmed) {
      throw new LedgerError('Confirm suitable housing and a backup caregiver first.');
    }

    consumeLanding(d, entry);
    const lap = currentLapNumber(d);
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
    if (q.discount > 0) d.discountLaps.push(lap);

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
      const r = activationResult(price, face);
      d.cash += r.receipts;
      recordIncome(d, 'business', r.profit);
      d.activationLaps.push(lap);
      result.rep = awardFamily(d, 'activation', r.repCeiling);
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
          add({ ...holding, ownershipBps: optionBps, failed: value === 0 });
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
          const r = eventResult(price, entry.launchTable, face);
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
    t.status = 'completed';
    t.completedTurn = d.turn;
    if (t.reward > 0) postCashIncome(d, t.reward, t.taxClass);
    log(d, { type: 'task_complete', label: `Completed: ${t.title}`, cashDelta: t.reward });
    return { reward: t.reward };
  },

  /** Release an optional task to free a slot; its unearned reward is forgone. */
  task_release(d, { taskId }) {
    assertActive(d);
    const t = d.tasks.find(x => x.id === taskId);
    if (!t || t.status !== 'open') throw new LedgerError('That task is not open.');
    t.status = 'released';
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
  draft.receipts[id] = { key, result: clone(result) };
  draft.receiptOrder.push(id);
  if (draft.receiptOrder.length > RECEIPT_LIMIT) {
    draft.receiptOrder.splice(0, draft.receiptOrder.length - RECEIPT_LIMIT).forEach(old => {
      delete draft.receipts[old];
    });
  }
  return { state: draft, result: clone(result), replayed: false };
}

let opCounter = 0;
export function newOpId(prefix = 'op') {
  opCounter += 1;
  return `${prefix}-${Date.now().toString(36)}-${opCounter}-${Math.random().toString(36).slice(2, 7)}`;
}
