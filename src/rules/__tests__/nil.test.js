// Yellow NIL opportunities: Packet 5 worked examples and acceptance checks.
import { createLedger, applyOp, taxesOwed } from '../ledger';
import { eligibleYellow, openTaskSlots, YELLOW_CARDS } from '../nil';
import { holdingsValue } from '../holdings';

const $ = d => Math.round(d * 100);
let n = 0;
// Rolls carry stored dice for any market moves or curveball tables they trigger.
const withDice = (type, payload) => (type === 'roll' && !payload.draws ? { draws: Array(60).fill(3), ...payload } : payload);
const run = (state, type, payload = {}, id = `y${++n}`) => applyOp(state, { id, type, ...withDice(type, payload) });
const exec = (state, type, payload, id) => run(state, type, payload, id).state;

const YELLOW_SPACES = [2, 8, 10, 21, 27, 35];

/** Roll to the next yellow space, drawing `cardId` (throws if it is not eligible there). */
function landOn(s, cardId) {
  const pos = s.progress % 40;
  const next = YELLOW_SPACES.find(i => i > pos) ?? YELLOW_SPACES[0] + 40;
  let state = s;
  let remaining = next - pos;
  while (remaining > 6) {
    // Step on non-yellow spaces only.
    const step = [6, 5, 4, 3, 2, 1].find(x => x <= remaining - 1 && !YELLOW_SPACES.includes((state.progress + x) % 40));
    state = exec(state, 'roll', { steps: step });
    remaining -= step;
  }
  const pool = eligibleYellow({ ...state, turn: state.turn + 1 });
  const pick = pool.findIndex(c => c.id === cardId);
  if (pick < 0) throw new Error(`${cardId} not eligible`);
  const r = run(state, 'roll', { steps: remaining, pick });
  expect(r.result.yellow.cardId).toBe(cardId);
  return r.state;
}

test('12 yellow cards in the registry', () => expect(YELLOW_CARDS).toHaveLength(12));

test('cards without a producer never appear; others are eligible from the start', () => {
  const ids = eligibleYellow(createLedger({ openingCash: 0 })).map(c => c.id);
  expect(ids).toEqual(['Y01', 'Y03', 'Y04', 'Y05', 'Y06', 'Y07', 'Y12']);
});

test('Example 1 — Y01: the base survives either choice; the follow-up pays once when completed', () => {
  let s = landOn(createLedger({ openingCash: $(25000) }), 'Y01');
  expect(s.cash).toBe($(100000));
  expect(s.taxIncome[1].nil).toBe($(75000));
  s = exec(s, 'yellow_choose', { choiceId: 'expand' });
  expect(s.cash).toBe($(100000));
  const task = s.tasks[0];
  expect(() => run(s, 'task_complete', { taskId: task.id })).toThrow('next turn');
  s = exec(s, 'roll', { steps: 1 });
  s = exec(s, 'task_complete', { taskId: task.id });
  expect(s.cash).toBe($(110000));
  expect(() => run(s, 'task_complete', { taskId: task.id })).toThrow();
});

test('declining or missing the follow-up never removes the base', () => {
  let s = landOn(createLedger({ openingCash: $(25000) }), 'Y01');
  s = exec(s, 'yellow_choose', { choiceId: 'expand' });
  s = exec(s, 'roll', { steps: 1 });
  s = exec(s, 'roll', { steps: 1 });
  expect(s.tasks[0].status).toBe('missed');
  expect(s.cash).toBe($(100000));
});

test('an unanswered card takes its cost-free branch at the next roll', () => {
  let s = landOn(createLedger({ openingCash: 0 }), 'Y04');
  s = exec(s, 'roll', { steps: 1 });
  expect(s.yellowHistory[0].choice).toBe('Accept the completed sponsorship payment');
  expect(s.tasks).toHaveLength(0);
});

test('Example 3 — Y11: recovery cannot exceed the outstanding loss', () => {
  let s = createLedger({ openingCash: $(30000) });
  s = exec(s, 'legacy_expense', { amount: $(20000), label: 'NIL Contract Scam – Lose $15,000' });
  s.losses[0].recovered = $(5000);
  s = landOn(s, 'Y11');
  expect(s.cash).toBe($(25000));
  expect(s.losses[0].recovered).toBe($(20000));
  expect(eligibleYellow(s).some(c => c.id === 'Y11')).toBe(false);
  expect(s.taxIncome[1]?.nil || 0).toBe(0);
});

test('Example 4 — Y12: income only on accepted delivery; declining costs nothing', () => {
  let s = landOn(createLedger({ openingCash: $(1000) }), 'Y12');
  const declined = exec(s, 'yellow_choose', { choiceId: 'decline' });
  expect(declined.taxIncome[1]?.nil || 0).toBe(0);
  s = exec(s, 'yellow_choose', { choiceId: 'use' });
  expect(s.cash).toBe($(1000));
  expect(s.taxIncome[1].nil).toBe($(30000));
  expect(holdingsValue(s).assetsValue).toBe(0);
  expect(eligibleYellow(s).some(c => c.id === 'Y12')).toBe(false); // same lap
});

test('Y03 adds a token with no cash or value; it pays a covered expense after other help', () => {
  let s = landOn(createLedger({ openingCash: $(50000) }), 'Y03');
  expect(s.cash).toBe($(50000));
  expect(holdingsValue(s).assetsValue).toBe(0);
  expect(() => run(s, 'legacy_expense', { amount: $(15000), label: 'Pay Your Taxes – Lose $15,000', useToken: true })).toThrow();
  const r = run(s, 'legacy_expense', { amount: $(30000), label: 'Transfer Portal Chaos – Lose $30,000', useToken: true });
  expect([r.result.tokenPaid, r.result.paid]).toEqual([$(25000), $(5000)]);
});

test('three task slots: a full schedule still gets the base but no new optional task', () => {
  let s = createLedger({ openingCash: 0 });
  s.tasks = [1, 2, 3].map(i => ({ id: `t${i}`, status: 'open', slots: 1, dueTurn: 99 }));
  expect(openTaskSlots(s)).toBe(3);
  s = landOn(s, 'Y06');
  expect(s.cash).toBe($(15000));
  expect(() => run(s, 'yellow_choose', { choiceId: 'add' })).toThrow('slots are full');
});

test('Y10 needs a recent sponsor relationship; Y08 needs owned IP', () => {
  let s = createLedger({ openingCash: 0 });
  expect(eligibleYellow(s).some(c => c.id === 'Y10')).toBe(false);
  s = landOn(s, 'Y07');
  expect(eligibleYellow(s).some(c => c.id === 'Y10')).toBe(true);
  s.assets.push({ id: 'pod', cardId: 'I28', title: 'Podcast', holding: 'growth', status: 'active', acquiredAt: 0, exposure: ['owned_ip'], anchorValue: 100, anchorProgress: 0, rateBps: 0 });
  expect(eligibleYellow(s).some(c => c.id === 'Y08')).toBe(true);
});

test('cooldown: the same card is not drawn again within four own turns', () => {
  const s = landOn(createLedger({ openingCash: 0 }), 'Y07');
  expect(eligibleYellow({ ...s, turn: s.turn + 3 }).some(c => c.id === 'Y07')).toBe(false);
  expect(eligibleYellow({ ...s, turn: s.turn + 4 }).some(c => c.id === 'Y07')).toBe(true);
});

test('retrying the roll replays the same card without a second award', () => {
  const s = createLedger({ openingCash: 0 });
  const a = run(s, 'roll', { steps: 2, pick: 0 }, 'r1');
  const b = run(a.state, 'roll', { steps: 2, pick: 0 }, 'r1');
  expect(b.replayed).toBe(true);
  expect(b.state.cash).toBe(a.state.cash);
  expect(taxesOwed(b.state)).toBe(taxesOwed(a.state));
});

test('finish: open tasks lapse unearned', () => {
  let s = landOn(createLedger({ openingCash: 0 }), 'Y07');
  s = exec(s, 'yellow_choose', { choiceId: 'follow' });
  s = exec(s, 'finish', { external: {} });
  expect(s.tasks[0].status).toBe('expired');
});
