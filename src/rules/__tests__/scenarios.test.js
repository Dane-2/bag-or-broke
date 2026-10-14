// Red and blue curveballs: Packet 4 worked examples and acceptance checks.
import { createLedger, applyOp, eventLiabilities, holds } from '../ledger';
import { eligibleCurveballs, DISABLED, CURVEBALLS } from '../scenarios';
import { eligibleYellow } from '../nil';
import { assetValue, holdingsValue } from '../holdings';

const $ = d => Math.round(d * 100);
let n = 0;
const withDice = (type, payload) => (type === 'roll' && !payload.draws ? { draws: Array(60).fill(3), ...payload } : payload);
const run = (state, type, payload = {}, id = `s${++n}`) => applyOp(state, { id, type, ...withDice(type, payload) });
const exec = (state, type, payload, id) => run(state, type, payload, id).state;

/** A ledger with no landing gate and the given card waiting for a response. */
function pending(cash, cardId, extra = {}) {
  const s = { ...createLedger({ openingCash: $(cash), landingEvents: false }), requireLanding: false };
  s.turn = 1;
  s.scenario = { id: 'S-1', cardId, color: cardId[0] === 'R' ? 'red' : 'blue', turn: 1, status: 'pending', targetId: null, cashBefore: s.cash, targetValueBefore: 0, faces: {}, saved: {}, ...extra };
  return s;
}
const buyPlan = (s, entryId) => exec(s, 'acquire', { entryId, assetId: `plan-${++n}`, cashPart: { DEF_LEGAL_BASIC: $(7500), DEF_HEALTH_BASIC: $(5000) }[entryId] });

test('all 34 scenarios enabled now that every record has a producer', () => {
  expect(CURVEBALLS).toHaveLength(34);
  expect(Object.keys(DISABLED)).toHaveLength(0);
});

test('Example 1 — R03: one dispute, $23,000 with Legal Support, one use consumed', () => {
  let s = { ...createLedger({ openingCash: $(57500) }), requireLanding: false };
  s = buyPlan(s, 'DEF_LEGAL_BASIC');
  expect(s.cash).toBe($(50000));
  s.turn = 1;
  s.scenario = { id: 'S-1', cardId: 'R03', color: 'red', turn: 1, status: 'pending', faces: {}, saved: {}, cashBefore: s.cash };
  const r = run(s, 'scenario_respond', { choiceId: 'settle', elect: { legal: true } });
  expect(r.state.cash).toBe($(27000));
  expect(r.result.assistance).toBe($(12000));
  expect(r.state.assets.find(a => a.holding === 'plan').uses).toBe(0);
});

test('Example 2 — R14: targeted market loss, no extra cash deduction', () => {
  const s = pending(40000, 'R14');
  s.assets.push(
    { id: 'eq', cardId: 'OFF_STOCKS', title: 'Stocks', kind: 'investment', holding: 'market', status: 'active', acquiredAt: 0, basis: 0, value: $(100000), exposure: ['tradable_equity'], circuitsDrawn: 0, draws: [] },
    { id: 'cr', cardId: 'I13', title: 'Coin', kind: 'investment', holding: 'market', status: 'active', acquiredAt: 0, basis: 0, value: $(20000), exposure: ['crypto'], circuitsDrawn: 0, draws: [] },
    { id: 'li', cardId: 'INV_LIFE_INSURANCE_TIER_A', title: 'Policy', kind: 'investment', holding: 'life', status: 'active', acquiredAt: 0, basis: $(25000), premium: $(25000), face: $(100000), loan: null, exposure: [] },
  );
  const before = holdingsValue(s).assetsValue + s.cash;
  const after = run(s, 'scenario_respond', { choiceId: 'continue' }).state;
  expect(assetValue(after, after.assets[0])).toBe($(85000));
  expect(assetValue(after, after.assets[1])).toBe($(15000));
  expect(assetValue(after, after.assets[2])).toBe($(25000));
  expect(after.cash).toBe($(40000));
  expect(before - (holdingsValue(after).assetsValue + after.cash)).toBe($(20000));
});

test('Example 4 — B13: Health Support pays $16,000; the $1,500 shortfall becomes an event bill', () => {
  let s = { ...createLedger({ openingCash: $(7500) }), requireLanding: false };
  s = buyPlan(s, 'DEF_HEALTH_BASIC');
  expect(s.cash).toBe($(2500));
  s.turn = 1;
  s.scenario = { id: 'S-1', cardId: 'B13', color: 'blue', turn: 1, status: 'pending', faces: {}, saved: {}, cashBefore: s.cash };
  const after = run(s, 'scenario_respond', { choiceId: 'recover', elect: { health: true } }).state;
  expect(after.cash).toBe(0);
  expect(eventLiabilities(after)).toBe($(1500));
  expect(after.restrictions.find(r => r.kind === 'sport_appearance').untilTurn).toBe(4);
  expect(after.points.rep).toBe(0);
});

test('R11: $25,000 advance is not income; renegotiating replaces the $40,000 claim', () => {
  const s = pending(10000, 'R11');
  const keep = run(s, 'scenario_respond', { choiceId: 'keep' }).state;
  expect(keep.cash).toBe($(35000));
  expect(eventLiabilities(keep)).toBe($(40000));
  expect(keep.taxIncome[1]?.nil || 0).toBe(0);
  const reneg = run(s, 'scenario_respond', { choiceId: 'renegotiate' }).state;
  expect(reneg.cash).toBe($(30000));
  expect(eventLiabilities(reneg)).toBe($(30000));
});

test('R19: the income-share claim takes 25% of later NIL receipts and counts its minimum as a liability', () => {
  let s = exec(pending(0, 'R19'), 'scenario_respond', { choiceId: 'keep' });
  expect(s.cash).toBe($(20000));
  expect(eventLiabilities(s)).toBe($(20000));
  s = exec(s, 'income', { amount: $(10000), taxClass: 'nil' });
  expect(s.cash).toBe($(27500));
  expect(s.taxIncome[1].nil).toBe($(10000));
  s = exec(s, 'income', { amount: $(10000), taxClass: 'nil' });
  s = exec(s, 'income', { amount: $(10000), taxClass: 'nil' });
  // Three receipts paid $7,500; the $12,500 left of the $20,000 minimum becomes a bill.
  expect(s.incomeShare).toBe(null);
  expect(eventLiabilities(s)).toBe($(12500));
});

test('R04: scam loss is 25% of cash; reporting recovers 25% of it two turns later', () => {
  let s = exec(pending(40000, 'R04'), 'scenario_respond', { choiceId: 'report' });
  expect(s.cash).toBe($(30000));
  expect(eligibleYellow(s).some(c => c.id === 'Y04')).toBe(false); // new NIL contracts restricted
  s = exec(s, 'roll', { steps: 1 });
  s = exec(s, 'roll', { steps: 1 });
  expect(s.cash).toBe($(32500));
});

test('an unanswered card takes its cost-free response at the next roll', () => {
  let s = pending(10000, 'R03');
  s.sponsorRelations.push({ cardId: 'Y04', createdTurn: 1, expiresTurn: 4 });
  s = exec(s, 'roll', { steps: 1 });
  expect(s.scenarioHistory[0].choice).toBe('Preserve cash; accept a later obligation');
  expect(s.cash).toBe($(10000));
  expect(eventLiabilities(s)).toBe($(45000));
});

test('an overdue event bill blocks new financed purchases until paid', () => {
  let s = exec(pending(0, 'R11'), 'scenario_respond', { choiceId: 'keep' });
  s = exec(s, 'roll', { steps: 1 });
  s = exec(s, 'roll', { steps: 1 });
  expect(holds(s).map(h => h.code)).toContain('payable');
  s.cash = $(50000);
  s = exec(s, 'pay_payable', { payableId: s.payables[0].id, amount: $(40000) });
  expect(holds(s).map(h => h.code)).not.toContain('payable');
});

test('chance tables use the stored roll', () => {
  const s = pending(50000, 'R13', { faces: { R13_DEFENSE: 5 } });
  const r = run(s, 'scenario_respond', { choiceId: 'defend' });
  expect(r.state.cash).toBe($(40000));
  expect(eventLiabilities(r.state)).toBe(0);
  const lose = run(pending(50000, 'R13', { faces: { R13_DEFENSE: 1 } }), 'scenario_respond', { choiceId: 'defend' });
  expect(eventLiabilities(lose.state)).toBe($(50000));
});

test('B01: a harmful public response costs REP; benching alone does not', () => {
  const s = pending(0, 'B01');
  expect(run(s, 'scenario_respond', { choiceId: 'prepare' }).state.points.rep).toBe(0);
  expect(run(s, 'scenario_respond', { choiceId: 'post' }).state.points.rep).toBe(-1);
});

test('B03: campaign cash only after the task is completed', () => {
  let s = exec(pending(0, 'B03'), 'scenario_respond', { choiceId: 'one' });
  expect(s.cash).toBe(0);
  s = exec(s, 'roll', { steps: 1 });
  s = exec(s, 'task_complete', { taskId: s.tasks[0].id });
  expect(s.cash).toBe($(10000));
});

test('B05 transfer portal: search, accept an offer, then a fit follow-up', () => {
  let s = exec(pending(10000, 'B05'), 'scenario_respond', { choiceId: 'enter' });
  expect(s.portal.stage).toBe('searching');
  s = exec(s, 'roll', { steps: 1, draws: [6, ...Array(59).fill(3)] });
  expect(s.portal.offers.map(o => o.id)).toEqual(['O_ROLE', 'O_MONEY', 'O_BALANCED']);
  s = exec(s, 'portal_accept', { offerId: 'O_MONEY' });
  expect(s.cash).toBe($(10000 + 25000 - 7500));
  s = exec(s, 'roll', { steps: 1 });
  s = exec(s, 'task_complete', { taskId: s.tasks[0].id });
  s = exec(s, 'roll', { steps: 1, draws: [6, ...Array(59).fill(3)] });
  expect(s.portal).toBe(null);
  expect(s.cash).toBe($(27500 + 15000)); // breakthrough campaign
});

test('disabled scenarios are never drawn', () => {
  const s = createLedger({ openingCash: $(100000) });
  const ids = [...eligibleCurveballs(s, 'red'), ...eligibleCurveballs(s, 'blue')].map(c => c.id);
  ids.forEach(id => expect(DISABLED[id]).toBeUndefined());
  expect(ids).toEqual(expect.arrayContaining(['R04', 'R11', 'R19', 'B01', 'B08', 'B10']));
});

test('family-planning content follows the host setting', () => {
  const s = exec(createLedger({ openingCash: 0 }), 'set_setting', { key: 'familyExpansionContent', value: false });
  expect(eligibleCurveballs(s, 'blue').some(c => c.id === 'B10')).toBe(false);
});

test('Web Developer service discount applies to R10 technical recovery', () => {
  let s = { ...createLedger({ openingCash: $(100000) }), requireLanding: false };
  s = exec(s, 'acquire', { entryId: 'I4', assetId: 'ch', cashPart: $(10000), face: 3 });
  s = exec(s, 'acquire', { entryId: 'I37', assetId: 'web', cashPart: $(15000), targetId: 'ch' });
  s.turn = 1;
  s.scenario = { id: 'S-1', cardId: 'R10', color: 'red', turn: 1, status: 'pending', targetId: 'ch', faces: {}, saved: {}, cashBefore: s.cash, targetValueBefore: $(10000) };
  const before = s.cash;
  const r = run(s, 'scenario_respond', { choiceId: 'specialist', elect: { service: true } });
  expect(before - r.state.cash).toBe($(4000)); // $5,000 less 20%
  // The 2% write-down is fully restored by the paid recovery ($10,000 launch at +10% = $11,000).
  expect(assetValue(r.state, r.state.assets.find(a => a.id === 'ch'))).toBe($(11000));
});

describe('authored record producers (authored_producers.json)', () => {
  const base = (cash = 100000) => ({ ...createLedger({ openingCash: $(cash), landingEvents: false }), requireLanding: false });
  const RED = [4, 13, 20, 22, 30, 32, 38];
  const BLUE = [6, 16, 26, 31];
  /** Move forward (no landing events) to just before the next space of the card's color, then land there. */
  const draw = (s, cardId) => {
    const spaces = cardId[0] === 'R' ? RED : BLUE;
    let st = { ...s, settings: { ...s.settings, landingEvents: false } };
    const pos = () => st.progress % 40;
    const nextSpace = () => spaces.find(i => i > pos()) ?? spaces[0] + 40;
    while (nextSpace() - pos() > 6) st = exec(st, 'roll', { steps: Math.min(6, nextSpace() - pos() - 1) });
    st = { ...st, settings: { ...st.settings, landingEvents: true } };
    const steps = nextSpace() - pos();
    // The draw happens after the start-of-turn step, so evaluate the pool on a dry run first.
    const dry = run(st, 'roll', { steps, pick: 0 }).state;
    const pool = eligibleCurveballs({ ...dry, scenario: null, scenarioStats: st.scenarioStats }, cardId[0] === 'R' ? 'red' : 'blue');
    const pick = pool.findIndex(c => c.id === cardId);
    if (pick < 0) throw new Error(`${cardId} not eligible`);
    const out = run(st, 'roll', { steps, pick }).state;
    expect(out.scenario.cardId).toBe(cardId);
    return { ...out, settings: { ...out.settings, landingEvents: false } };
  };

  test('R02 / Y02: a paid-later invoice is collected and taxed on its due turn; R02 delays it', () => {
    let s = exec(base(0), 'invoice', { amount: $(20000), label: 'Camp appearance' });
    expect(s.cash).toBe(0);
    expect(eligibleCurveballs({ ...s, turn: s.turn + 1 }, 'red').some(c => c.id === 'R02')).toBe(true);
    s = draw(s, 'R02');
    const dueBefore = s.receivables[0].dueTurn;
    s = exec(s, 'scenario_respond', { choiceId: 'wait' });
    expect(s.receivables[0].dueTurn).toBe(Math.max(dueBefore, s.turn) + 2);
    while (s.receivables[0].amount > 0) s = exec(s, 'roll', { steps: 1 });
    expect(s.cash).toBe($(20000));
    expect(s.taxIncome[1].nil).toBe($(20000));
  });

  test('R06: a pop-up launch creates an inventory order; the replacement uses Business Coach', () => {
    let s = base(200000);
    s = exec(s, 'acquire', { entryId: 'I7', assetId: 'shop', cashPart: $(15000), face: 3 });
    s = exec(s, 'acquire', { entryId: 'I36', assetId: 'coach', cashPart: $(30000), targetId: 'shop' });
    s = exec(s, 'acquire', { entryId: 'LX32', assetId: 'popup', cashPart: $(15000), face: 1, targetId: 'shop' });
    expect(s.inventoryOrders[0]).toEqual(expect.objectContaining({ targetId: 'shop', inventoryValue: $(7500), poor: true }));
    s = draw(s, 'R06');
    const before = s.cash;
    const r = run(s, 'scenario_respond', { choiceId: 'replace', elect: { service: true } });
    expect(r.result.assistance).toBeGreaterThan(0);
    expect(before - r.state.cash).toBeLessThan(Math.round(assetValue(s, s.assets[0]) * 0.02) + 1);
  });

  test('R08: equipment-tagged businesses can break; the substitute restores half later', () => {
    let s = exec(base(), 'acquire', { entryId: 'I16', assetId: 'truck', cashPart: $(25000), face: 3 });
    expect(s.assets[0].exposure).toContain('equipment');
    s = draw(s, 'R08');
    s = exec(s, 'scenario_respond', { choiceId: 'substitute' });
    expect(assetValue(s, s.assets[0])).toBe(Math.round($(27500) * 0.95));
  });

  test('R09: the hometown celebration books a venue deposit; cancelling refunds it and cancels delivery', () => {
    let s = exec(base(), 'acquire', { entryId: 'LX45', assetId: 'party', cashPart: $(10000) });
    expect(s.bookings[0].deposit).toBe($(2000));
    s = draw(s, 'R09');
    const before = s.cash;
    s = exec(s, 'scenario_respond', { choiceId: 'cancel' });
    expect(s.cash - before).toBe($(2000));
    expect(s.assets.find(a => a.id === 'party').status).toBe('cancelled');
  });

  test('R12: a breakout launch holds customer prepayments as a liability until earned', () => {
    let s = exec(base(), 'acquire', { entryId: 'I7', assetId: 'shop', cashPart: $(15000), face: 3 });
    s = exec(s, 'acquire', { entryId: 'LX32', assetId: 'popup', cashPart: $(15000), face: 6, targetId: 'shop' });
    expect(eventLiabilities(s)).toBe($(3750));
    s = draw(s, 'R12');
    s = exec(s, 'scenario_respond', { choiceId: 'limit' });
    expect(eventLiabilities(s)).toBe(0);
  });

  test('R05: a 35% Team Elite stake records one overdue partner contribution', () => {
    let s = base(200000);
    s.milestones.push('YSH_SPONSOR', 'YSH_CLINIC');
    s = exec(s, 'acquire', { entryId: 'YSH_TEAM', assetId: 'team', cashPart: $(35000), face: 3, optionBps: 3500 });
    for (let i = 0; i < 7; i++) s = exec(s, 'roll', { steps: i < 6 ? 6 : 4 });
    expect(s.npcContributions).toHaveLength(1);
    s = draw(s, 'R05');
    expect(s.scenario.cardId).toBe('R05');
  });

  test('R17: hiring a representative speeds invoices; the risk is real', () => {
    let s = exec(base(), 'acquire', { entryId: 'RX01', assetId: 'rep', cashPart: $(2500) });
    s = exec(s, 'invoice', { amount: $(5000) });
    expect(s.receivables[0].dueTurn).toBe(s.turn + 1);
    s = draw(s, 'R17');
    s = exec(s, 'scenario_respond', { choiceId: 'restrict' });
    expect(s.assets.find(a => a.id === 'rep').status).toBe('terminated');
  });

  test('R16: the Y10 follow-up delivers a taxable perk recognized once', () => {
    let s = base(10000);
    s.turn = 1;
    s.tasks.push({ id: 't1', cardId: 'Y10', title: 'Brand Wants You Back', label: 'Story segment', slots: 1, dueTurn: 1, reward: $(5000), taxClass: 'nil', status: 'open' });
    s = exec(s, 'task_complete', { taskId: 't1' });
    expect(s.perks[0].taxRecorded).toBe(false);
    s = draw(s, 'R16');
    s = exec(s, 'scenario_respond', { choiceId: 'reserve' });
    expect(s.perks[0].taxRecorded).toBe(true);
    expect(s.taxBucket).toBe($(1000));
  });

  test('B07: missing the transfer paperwork sets academic risk; tutoring clears it', () => {
    let s = base();
    s.turn = 1;
    s.tasks.push({ id: 'ta', cardId: 'B05', title: 'Transfer', label: 'Academic transfer paperwork', kind: 'transfer_academic', slots: 1, dueTurn: 1, reward: 0, status: 'open' });
    s = exec(s, 'roll', { steps: 1 });
    expect(s.academicRisk).toBe(true);
    s = draw(s, 'B07');
    s = exec(s, 'scenario_respond', { choiceId: 'tutor' });
    s = exec(s, 'roll', { steps: 1 });
    s = exec(s, 'task_complete', { taskId: s.tasks.find(t => t.kind === 'academic_repair' && t.status === 'open').id });
    expect(s.academicRisk).toBe(false);
  });
});
