// Coach J-Bo: three credits per game, cached per decision, advice from visible facts only.
import { createLedger, applyOp, quoteScenario, dueNow } from '../ledger';
import { adviseScenario, adviseYellow, adviseLanding, STARTING_CREDITS } from '../coach';

const $ = d => Math.round(d * 100);
let n = 0;
const run = (s, type, payload = {}) => applyOp(s, { id: `c${++n}`, type, ...payload });

const withScenario = (cash, cardId, faces = {}) => {
  const s = { ...createLedger({ openingCash: $(cash), landingEvents: false }), requireLanding: false };
  s.turn = 1;
  s.sponsorRelations.push({ cardId: 'Y04', createdTurn: 1, expiresTurn: 4 });
  s.scenario = { id: 'S-1', cardId, color: 'red', turn: 1, status: 'pending', faces, saved: {}, cashBefore: s.cash };
  return s;
};

test('three credits; the same decision replays free; none left is refused', () => {
  let s = createLedger({ openingCash: 0 });
  expect(s.coach.credits).toBe(STARTING_CREDITS);
  const advice = { recommendation: 'X', reasons: [], tradeoff: '', alternative: null };
  s = run(s, 'coach_advice', { decisionId: 'd1', advice }).state;
  const replay = run(s, 'coach_advice', { decisionId: 'd1', advice });
  expect(replay.result.replay).toBe(true);
  expect(replay.state.coach.credits).toBe(2);
  s = run(run(s, 'coach_advice', { decisionId: 'd2', advice }).state, 'coach_advice', { decisionId: 'd3', advice }).state;
  expect(s.coach.credits).toBe(0);
  expect(() => run(s, 'coach_advice', { decisionId: 'd4', advice })).toThrow('No Coach J-Bo credits');
});

test('failed delivery spends nothing', () => {
  const s = createLedger({ openingCash: 0 });
  expect(() => run(s, 'coach_advice', { decisionId: 'd1', advice: null })).toThrow('No credit was used');
  expect(s.coach.credits).toBe(STARTING_CREDITS);
});

test('scenario advice compares expected cost from the published table, not the stored roll', () => {
  const lucky = withScenario(100000, 'R03', { R03_CHALLENGE: 6 });
  const unlucky = withScenario(100000, 'R03', { R03_CHALLENGE: 1 });
  const a = adviseScenario(lucky, id => quoteScenario(lucky, id, {}), dueNow);
  const b = adviseScenario(unlucky, id => quoteScenario(unlucky, id, {}), dueNow);
  expect(a).toEqual(b);
  expect(a.recommendation).toBeTruthy();
  expect(a.tradeoff).toBeTruthy();
});

test('advice avoids responses that cost REP', () => {
  const s = withScenario(1000, 'B01');
  const a = adviseScenario(s, id => quoteScenario(s, id, {}), dueNow);
  expect(a.choiceId).not.toBe('post');
});

test('yellow advice takes a follow-up only when slots are free', () => {
  const s = createLedger({ openingCash: 0 });
  s.yellow = { id: 'Y-1', cardId: 'Y01', turn: 1, status: 'pending', base: {} };
  expect(adviseYellow(s).choiceId).toBe('expand');
  s.tasks = [1, 2].map(i => ({ id: `t${i}`, status: 'open', slots: 1, dueTurn: 9 }));
  expect(adviseYellow(s).choiceId).toBe('bank');
});

test('landing advice puts bills first when cash is tight', () => {
  const s = createLedger({ openingCash: $(1000) });
  s.payables.push({ id: 'p', amount: $(5000), dueTurn: 1, overdue: false });
  expect(adviseLanding(s, 'investment', dueNow).recommendation).toMatch(/Pay what you owe/);
});
