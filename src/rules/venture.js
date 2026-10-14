// Shared sports-complex company (shared_ownership.json). Port of the Company model in
// bobupdates/engine_investments.py. Ownership is 10,000 units of the whole company; the
// founder's board progress is the only clock; a secondary sale moves no money to the company.
import shared from './config/shared_ownership.json';
import { accrue } from './holdings';
import { BPS, divHalfUp } from './money';

export const COMPANY_UNITS = shared.company_units; // 10000
export const MIN_UNITS = shared.minimum_transfer_units; // 100
export const GAIN_TAX_BPS = shared.seller_settlement.gain_tax_bps; // 2000
export const ENABLED_VENTURES = shared.enabled_human_ventures; // ['YSH_COMPLEX']
export const PARTNER_REQUIREMENTS = shared.partner.required_completions;

export function createCompany({ id, founder, value, rateBps, basis, securedDebt = 0, progress = 0, boardSize = 40 }) {
  return {
    id,
    founder,
    value,
    rateBps,
    progress,
    boardSize,
    revision: 0,
    owners: { [founder]: COMPANY_UNITS },
    basis: { [founder]: basis },
    securedDebt: { [founder]: securedDebt },
    listings: {},
    frozen: {},
    stopped: false,
    failed: value === 0,
  };
}

/** Advance the company to the founder's progress once. */
export function settle(c, founderProgress) {
  if (founderProgress < c.progress) throw new Error('clock cannot reverse');
  if (c.stopped || c.failed || founderProgress === c.progress) return c;
  return { ...c, value: accrue(c.value, c.rateBps, founderProgress - c.progress, c.boardSize), progress: founderProgress, revision: c.revision + 1 };
}

export function publishListing(c, seller, units) {
  if (c.stopped || c.failed || c.frozen[seller]) throw new Error('closed offering');
  if (units < MIN_UNITS || units % MIN_UNITS || units > (c.owners[seller] || 0)) throw new Error('invalid units');
  return { ...c, listings: { ...c.listings, [seller]: units }, revision: c.revision + 1 };
}

/** Price, prorated basis, linked secured payoff and gain tax for a sale of `units`. */
export function quote(c, seller, units) {
  if (c.stopped || c.failed || c.frozen[seller] || units < MIN_UNITS || units % MIN_UNITS) throw new Error('unavailable');
  const owned = c.owners[seller] || 0;
  if (units > Math.min(owned, c.listings[seller] || 0)) throw new Error('not offered');
  const gross = divHalfUp(c.value * units, COMPANY_UNITS);
  const basis = divHalfUp((c.basis[seller] || 0) * units, owned);
  const debt = divHalfUp((c.securedDebt[seller] || 0) * units, owned);
  const gainTax = divHalfUp(Math.max(0, gross - basis) * GAIN_TAX_BPS, BPS);
  return { seller, units, gross, basis, debtPayoff: debt, gainTax, sellerNet: gross - gainTax - debt, revision: c.revision, progress: c.progress };
}

/** Apply a validated transfer. Throws on a stale quote; never mutates the input. */
export function transfer(c, buyer, q, buyerCash) {
  if (buyer === q.seller || c.frozen[buyer] || c.stopped || c.failed) throw new Error('ineligible transfer');
  const expected = quote(c, q.seller, q.units);
  if (JSON.stringify(expected) !== JSON.stringify(q)) throw new Error('stale quote');
  if (buyerCash < q.gross) throw new Error('cash required');
  const owners = { ...c.owners, [q.seller]: c.owners[q.seller] - q.units, [buyer]: (c.owners[buyer] || 0) + q.units };
  const basis = { ...c.basis, [q.seller]: c.basis[q.seller] - q.basis, [buyer]: (c.basis[buyer] || 0) + q.gross };
  const securedDebt = { ...c.securedDebt, [q.seller]: (c.securedDebt[q.seller] || 0) - q.debtPayoff };
  const listings = { ...c.listings, [q.seller]: c.listings[q.seller] - q.units };
  return { ...c, owners, basis, securedDebt, listings, revision: c.revision + 1 };
}

/** A value incident hits the whole company once; stakes derive from it. */
export function shock(c, lossBps, founderProgress) {
  if (c.stopped) throw new Error('company finished');
  const settled = settle(c, founderProgress);
  const value = divHalfUp(settled.value * (BPS - lossBps), BPS);
  return { ...settled, value, revision: settled.revision + 1, failed: value === 0, listings: value === 0 ? {} : settled.listings };
}

/** A player's finish freezes their stake; the founder's finish stops the company. */
export function finish(c, player, founderProgress) {
  if (c.frozen[player]) return { company: c, snapshot: c.frozen[player] };
  const settled = settle(c, founderProgress);
  const snapshot = {
    units: settled.owners[player] || 0,
    stakeValue: divHalfUp(settled.value * (settled.owners[player] || 0), COMPANY_UNITS),
    securedDebt: settled.securedDebt[player] || 0,
    revision: settled.revision,
  };
  const listings = { ...settled.listings };
  delete listings[player];
  const next = { ...settled, frozen: { ...settled.frozen, [player]: snapshot }, listings };
  if (player === c.founder) Object.assign(next, { stopped: true, listings: {} });
  return { company: next, snapshot };
}

export const stakeValue = (companyValue, units) => divHalfUp(companyValue * units, COMPANY_UNITS);
