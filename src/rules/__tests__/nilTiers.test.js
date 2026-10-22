// BOB-NIL-RESET-2026-01 release checks: mapping, separation from cash, no double counting.
import tiers from '../../data/tiers';
import { createLedger, applyOp, availableUnsecured, taxesOwed } from '../ledger';
import { scoreBreakdown } from '../portfolio';

const $ = d => Math.round(d * 100);
let n = 0;
const run = (s, type, payload = {}) => applyOp(s, { id: `t${++n}`, type, ...payload });

const APPROVED = [
  [1, 'Walk-On / Roster Player', 10000],
  [2, 'Reserve / Depth Player', 50000],
  [3, 'Emerging Starter', 125000],
  [4, '3-Star / Established Player', 200000],
  [5, '4-Star / Impact Player', 350000],
  [6, '5-Star / Elite Prospect', 750000],
];

test.each(APPROVED)('roll %i maps to %s with a %i annual valuation', (roll, label, valuation) => {
  expect(tiers[roll].label).toBe(label);
  expect(tiers[roll].annualValuation).toBe(valuation);
  const s = createLedger({ openingCash: $(tiers[roll].amount + 2500), nilTierId: roll });
  expect(s.nilTier).toEqual(expect.objectContaining({ roll, label, annualValuation: $(valuation) }));
});

test('opening cash keeps the legacy capital; valuation is never wallet cash', () => {
  expect(Object.values(tiers).map(t => t.amount)).toEqual([10000, 25000, 50000, 75000, 100000, 150000]);
  const s = createLedger({ openingCash: $(152500), nilTierId: 6 });
  expect(s.cash).toBe($(152500));
  expect(s.nilPaidToDate).toBe(0);
});

test.each([5, 10])('valuation changes no cash, taxable income, borrowing or score (%i-lap game)', laps => {
  const play = tierId => {
    let s = createLedger({ openingCash: $(52500), totalLaps: laps, nilTierId: tierId, landingEvents: false });
    const end = laps * 40;
    while (s.progress < end) s = run(s, 'roll', { steps: Math.min(6, end - s.progress), draws: Array(60).fill(3) }).state;
    return s;
  };
  const low = play(1);
  const high = play(6);
  expect(high.cash).toBe(low.cash);
  expect(taxesOwed(high)).toBe(taxesOwed(low));
  expect(availableUnsecured(high)).toBe(availableUnsecured(low));
  const score = s => scoreBreakdown({ cash: s.cash, taxBucket: s.taxBucket, creditScore: s.creditScore }).gameValue;
  expect(score(high)).toBe(score(low));
  expect(high.nilPaidToDate).toBe(0);
});

test('setup, reloads and lap completion create no NIL credits', () => {
  let s = createLedger({ openingCash: $(12500), nilTierId: 6, landingEvents: false });
  const reloaded = JSON.parse(JSON.stringify(s));
  expect(reloaded.cash).toBe(s.cash);
  for (let i = 0; i < 7; i++) s = run(s, 'roll', { steps: i < 6 ? 6 : 4 }).state;
  expect(s.cash).toBe($(12500 + 2500)); // only the existing $2,500 lap award
  expect(s.nilPaidToDate).toBe(0);
});

test('NIL paid to date counts actual NIL payments only', () => {
  let s = createLedger({ openingCash: 0, nilTierId: 3 });
  s = run(s, 'income', { amount: $(10000), taxClass: 'nil' }).state;
  s = run(s, 'adjust_cash', { amount: $(5000), label: 'Gift (not NIL)' }).state;
  expect(s.nilPaidToDate).toBe($(10000));
});
