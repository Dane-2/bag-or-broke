// Career & Professional Development: Packet 3 acceptance checks and the worked
// mentorship-to-clinic connection.
import { createLedger, applyOp } from '../ledger';
import { eligibleFamilies, familyChoices, PATHS, preparedFor } from '../career';

const $ = d => Math.round(d * 100);
let n = 0;
// Rolls carry stored dice for any market moves or curveball tables they trigger.
const withDice = (type, payload) => (type === 'roll' && !payload.draws ? { draws: Array(60).fill(3), ...payload } : payload);
const run = (state, type, payload = {}, id = `c${++n}`) => applyOp(state, { id, type, ...withDice(type, payload) });
const exec = (state, type, payload, id) => run(state, type, payload, id).state;

const PURPLE = [7, 14, 19, 23, 33, 37];
const YELLOW = [2, 8, 10, 21, 27, 35];

/** Roll to the next purple space and draw `familyId` there. */
function landOn(s, familyId) {
  let state = s;
  const pos = () => state.progress % 40;
  const target = PURPLE.find(i => i > pos()) ?? PURPLE[0] + 40;
  let remaining = target - pos();
  while (remaining > 6) {
    const step = [6, 5, 4, 3, 2, 1].find(x => x <= remaining - 1 && !PURPLE.concat(YELLOW).includes((state.progress + x) % 40));
    state = exec(state, 'roll', { steps: step });
    remaining -= step;
  }
  const pool = eligibleFamilies({ ...state, turn: state.turn + 1 });
  const pick = pool.findIndex(f => f.id === familyId);
  if (pick < 0) throw new Error(`${familyId} not eligible`);
  const r = run(state, 'roll', { steps: remaining, pick });
  expect(r.result.purple.family).toBe(familyId);
  return r.state;
}

const SPORTS = 'sports_business_management';
const MEDIA = 'media_marketing_communications';

test('thirteen paths, each with two internship assignments and mentoring focuses', () => {
  expect(PATHS).toHaveLength(13);
  PATHS.forEach(p => {
    expect(familyChoices('internship', p.id).map(c => c.id)).toEqual(['A', 'B']);
    expect(familyChoices('mentoring', p.id).map(c => c.id)).toEqual(['operations', 'promotion']);
  });
});

test('the purple offer is stored with the roll; a retry cannot reroll it', () => {
  const s = landOn(createLedger({ openingCash: 0 }), 'leadership_retreat');
  const offer = s.career.offer;
  expect(offer.family).toBe('leadership_retreat');
});

test('activities award on completion; once per family per lap across paths', () => {
  let s = landOn(createLedger({ openingCash: 0 }), 'leadership_retreat');
  const r = run(s, 'career_complete', { pathId: SPORTS, choiceId: 'role0' });
  expect([r.result.rep, r.result.career]).toEqual([2, 2]);
  s = r.state;
  expect(s.career.competencies).toContain(`team_coordination:${SPORTS}`);
  expect(eligibleFamilies(s).some(f => f.id === 'leadership_retreat')).toBe(false);
});

test('veterans service: 0 REP, 1 Career', () => {
  const s = landOn(createLedger({ openingCash: 0 }), 'community_service');
  const r = run(s, 'career_complete', { pathId: MEDIA, choiceId: 'role1' });
  expect([r.result.rep, r.result.career]).toEqual([0, 1]);
});

test('internship: accept awards 0; completing on the next turn awards 3/3 once', () => {
  let s = landOn(createLedger({ openingCash: 0 }), 'internship');
  const accept = run(s, 'career_complete', { pathId: SPORTS, choiceId: 'A' });
  expect([accept.result.rep, accept.result.career]).toEqual([0, 0]);
  s = accept.state;
  expect(() => run(s, 'internship_action', { action: 'complete' })).toThrow('next turn');
  expect(eligibleFamilies(s).some(f => f.id === 'internship')).toBe(false);
  s = exec(s, 'roll', { steps: 1 });
  const done = run(s, 'internship_action', { action: 'complete' });
  expect([done.result.rep, done.result.career]).toEqual([3, 3]);
  expect(done.state.career.internship).toBe(null);
  expect(done.state.career.competencies).toContain(`internship:${SPORTS}:event_scheduling`);
});

test('internship: one extension, and one repair after a missed follow-up', () => {
  let s = exec(landOn(createLedger({ openingCash: 0 }), 'internship'), 'career_complete', { pathId: MEDIA, choiceId: 'A' });
  s = exec(s, 'roll', { steps: 1 });
  s = exec(s, 'internship_action', { action: 'extend' });
  expect(() => run(s, 'internship_action', { action: 'extend' })).toThrow();
  s = exec(s, 'roll', { steps: 1 }); // due now
  s = exec(s, 'roll', { steps: 1 }); // moved on without responding -> repair offered
  expect(s.career.internship.state).toBe('repair');
  const r = run(s, 'internship_action', { action: 'repair' });
  expect([r.result.rep, r.result.career]).toEqual([3, 3]);
});

test('an unanswered repair closes unfinished with no reward', () => {
  let s = exec(landOn(createLedger({ openingCash: 0 }), 'internship'), 'career_complete', { pathId: MEDIA, choiceId: 'B' });
  s = exec(s, 'roll', { steps: 1 });
  s = exec(s, 'roll', { steps: 1 });
  s = exec(s, 'roll', { steps: 1 });
  expect(s.career.internship).toBe(null);
  expect(s.career.history.some(h => h.status === 'closed_unfinished')).toBe(true);
});

test('graduation is not offered before three completed laps', () => {
  const s = createLedger({ openingCash: 0 });
  expect(eligibleFamilies(s).some(f => f.id === 'graduation')).toBe(false);
  expect(eligibleFamilies({ ...s, progress: 120 }).some(f => f.id === 'graduation')).toBe(true);
});

test('mentoring: fresh work required between rewarded visits in the same path', () => {
  let s = exec(landOn(createLedger({ openingCash: 0 }), 'mentoring'), 'career_complete', { pathId: MEDIA, choiceId: 'operations' });
  s = { ...s, progress: 40, closedLaps: [1] }; // next lap: family allowance refreshes
  s = landOn(s, 'mentoring');
  expect(() => run(s, 'career_complete', { pathId: MEDIA, choiceId: 'promotion' })).toThrow('new work');
  expect(() => run(s, 'career_complete', { pathId: SPORTS, choiceId: 'promotion' })).not.toThrow();
});

test('worked connection: sports mentoring referral makes the clinic $9,500; net cash +$2,000', () => {
  let s = exec(landOn(createLedger({ openingCash: $(20000) }), 'mentoring'), 'career_complete', { pathId: SPORTS, choiceId: 'operations' });
  expect(s.career.referral).toEqual(expect.objectContaining({ used: false }));
  s = { ...s, requireLanding: false };
  s.milestones.push('YSH_SPONSOR');
  const before = s.cash;
  const r = run(s, 'acquire', { entryId: 'YSH_CLINIC', assetId: 'clinic', cashPart: $(9500), face: 4 });
  expect(r.state.cash - before).toBe($(2000));
  expect(r.result.profit).toBe($(2000));
  expect(r.state.career.referral.used).toBe(true);
});

test('Prepared launch: only a matching promotion competency changes a launch roll of 1', () => {
  let s = { ...createLedger({ openingCash: $(50000) }), requireLanding: false };
  s = exec(s, 'acquire', { entryId: 'I4', assetId: 'channel', cashPart: $(10000), face: 3 });
  const unprepared = run(s, 'acquire', { entryId: 'LX31', assetId: 'l1', cashPart: $(10000), face: 1, targetId: 'channel' });
  expect(unprepared.result.receipts).toBe(0);
  s.career.competencies.push(`operations_planning:${MEDIA}`);
  expect(preparedFor(s, MEDIA)).toBe(false);
  s.career.competencies.push(`campaign_planning:${MEDIA}`);
  const prepared = run(s, 'acquire', { entryId: 'LX31', assetId: 'l2', cashPart: $(10000), face: 1, targetId: 'channel' });
  expect([prepared.result.receipts, prepared.result.rep]).toEqual([$(2500), 0]);
});
