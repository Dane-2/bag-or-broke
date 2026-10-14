// Port of the RevealTests in bobupdates/test_career_reveal.py, plus ledger evidence checks.
import { classify, PROFILES, revealTitle } from '../reveal';
import { createLedger, applyOp } from '../ledger';

function evidence(mapping) {
  return Object.entries(mapping).flatMap(([dimension, outcomes]) =>
    outcomes.map((outcome, i) => ({
      event_id: `${dimension}_${i}`, opportunity_id: `${dimension}_${i}`, dimension, outcome,
      actionable: true, choice_exposed: true, forced: false, reversed: false,
    }))
  );
}
const x4 = v => Array(4).fill(v);
const setbacks = [1, 2].map(i => ({ event_id: `s${i}`, external: true, adverse: true, committed: true }));

test('the eight source codes are preserved', () => {
  expect(new Set(PROFILES.map(p => p.code))).toEqual(new Set(['I-L-A-R', 'I-L-C-R', 'S-N-A-R', 'I-N-A-V', 'S-L-C-V', 'I-L-A-C', 'S-N-C-V', 'S-N-A-V']));
});

test('low evidence assigns no archetype', () => {
  const r = classify(evidence({ investment: Array(3).fill('acquire') }));
  expect(r.state).toBe('insufficient_evidence');
  expect(revealTitle(r)).toMatch(/Not enough evidence/);
});

test.each([
  ['I-L-A-R', { investment: x4('acquire'), planning: x4('review_or_prepare'), follow_through: x4('complete'), risk_appetite: x4('choose_low') }],
  ['I-L-C-R', { community: x4('participate'), development: x4('complete'), follow_through: x4('complete'), planning: x4('review_or_prepare') }],
  ['S-N-A-R', { luxury: x4('purchase'), planning: x4('proceed_without_optional_preparation'), follow_through: x4('ignore'), investment: x4('acquire') }],
  ['I-N-A-V', { investment: x4('acquire'), risk_appetite: x4('choose_high'), follow_through: x4('complete'), planning: x4('proceed_without_optional_preparation') }],
  ['I-L-A-C', { investment: ['acquire', 'decline', 'acquire', 'decline'], development: x4('complete'), planning: x4('review_or_prepare'), follow_through: x4('complete') }],
  ['S-N-C-V', { luxury: x4('purchase'), investment: x4('decline'), development: x4('decline'), planning: x4('review_or_prepare') }],
  ['S-N-A-V', { avoidable_overextension: x4('commit_despite_displaced_due_obligation'), avoidable_nonpayment: x4('leave_unpaid_with_sufficient_available_cash'), recovery: x4('decline_feasible_recovery'), luxury: x4('decline') }],
])('%s', (code, mapping) => {
  const r = classify(evidence(mapping));
  expect(r.profiles[0].code).toBe(code);
  expect(r.financialEffect).toBe(0);
});

test('Survivor needs the response evidence and two external setbacks', () => {
  const records = evidence({ recovery: x4('complete_recovery'), follow_through: x4('complete'), planning: x4('review_or_prepare'), risk_appetite: x4('choose_low') });
  expect(classify(records).profiles).toHaveLength(0);
  expect(classify(records, setbacks).profiles[0].code).toBe('S-L-C-V');
});

test('Flexer is not automatically a nonpayer', () => {
  const r = classify(evidence({ luxury: x4('purchase'), investment: x4('decline'), development: x4('decline'), planning: x4('review_or_prepare') }));
  expect(r.metrics.avoidable_nonpayment).toBeUndefined();
});

test('chance, forced, unaffordable, reversed and unexposed observations do not count', () => {
  const records = evidence({ avoidable_nonpayment: Array(5).fill('leave_unpaid_with_sufficient_available_cash') });
  records[0].cause = 'chance_only';
  records[1].forced = true;
  records[2].actionable = false;
  records[3].reversed = true;
  records[4].choice_exposed = false;
  expect(classify(records).uniqueChoiceEvents).toBe(0);
});

test('refresh duplicates do not farm evidence', () => {
  const records = evidence({ planning: x4('review_or_prepare') });
  const r = classify(Array(20).fill(records).flat());
  expect([r.uniqueChoiceEvents, r.metrics.planning.n]).toEqual([4, 4]);
});

test('conflicting duplicate and unknown outcome are rejected', () => {
  const records = evidence({ planning: ['review_or_prepare'] });
  expect(() => classify([...records, { ...records[0], outcome: 'proceed_without_optional_preparation' }])).toThrow();
  expect(() => classify(evidence({ planning: ['AI says brilliant'] }))).toThrow();
});

test('only actionable opportunities normalize the mean', () => {
  const unavailable = evidence({ investment: Array(30).fill('acquire') }).map(e => ({ ...e, actionable: false }));
  const r = classify([...evidence({ investment: ['acquire', 'decline'] }), ...unavailable]);
  expect([r.metrics.investment.mean, r.metrics.investment.n]).toEqual([0.5, 2]);
});

test('overlapping patterns are shown as mixed', () => {
  const r = classify(evidence({ investment: x4('acquire'), development: x4('complete'), planning: x4('review_or_prepare'), follow_through: x4('complete') }));
  expect(r.state).toBe('mixed');
  expect(r.profiles).toHaveLength(2);
});

test('unknown dimensions are not zero; 24 events are supported evidence', () => {
  const six = v => Array(6).fill(v);
  const r = classify(evidence({ investment: six('acquire'), planning: six('review_or_prepare'), follow_through: six('complete'), risk_appetite: six('choose_low') }));
  expect(r.metrics.development).toBeUndefined();
  expect(r.evidenceStrength).toBe('supported');
});

describe('ledger evidence', () => {
  let n = 0;
  const run = (s, type, payload = {}) => applyOp(s, { id: `r${++n}`, type, ...(type === 'roll' && !payload.draws ? { draws: Array(60).fill(3), ...payload } : payload) });

  test('a purchase on a green landing records investment and risk; passing records a decline', () => {
    let s = createLedger({ openingCash: 5000000, landingEvents: false });
    s = run(s, 'roll', { steps: 1 }).state; // space 1 green
    s = run(s, 'acquire', { entryId: 'I13', assetId: 'coin', cashPart: 500000, face: 4 }).state;
    expect(s.observations.map(o => [o.dimension, o.outcome])).toEqual([['investment', 'acquire'], ['risk_appetite', 'choose_high']]);
    s = run(s, 'roll', { steps: 4 }).state; // space 5 green, unused
    s = run(s, 'roll', { steps: 1 }).state;
    expect(s.observations.some(o => o.dimension === 'investment' && o.outcome === 'decline')).toBe(true);
  });

  test('setting aside tax is preparation; the snapshot carries the reveal', () => {
    let s = createLedger({ openingCash: 0, landingEvents: false });
    s = run(s, 'income', { amount: 1000000, taxClass: 'nil', setAside: 200000 }).state;
    expect(s.observations[0]).toEqual(expect.objectContaining({ dimension: 'planning', outcome: 'review_or_prepare' }));
    const snap = run(s, 'finish', { external: {} }).result;
    expect(snap.reveal.state).toBe('insufficient_evidence');
    expect(snap.reveal.financialEffect).toBe(0);
  });

  test('paying lap bills on time is recorded at the deadline', () => {
    let s = createLedger({ openingCash: 1000000, landingEvents: false });
    s = run(s, 'income', { amount: 1000000, taxClass: 'nil' }).state;
    for (let i = 0; i < 7; i++) s = run(s, 'roll', { steps: i < 6 ? 6 : 4 }).state;
    s = run(s, 'pay_taxes', { amount: s.taxBills[0].assessed }).state;
    s = run(s, 'roll', { steps: 1 }).state;
    expect(s.observations.some(o => o.dimension === 'avoidable_nonpayment' && o.outcome === 'pay_required_amount')).toBe(true);
  });
});
