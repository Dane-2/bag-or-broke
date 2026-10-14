// Investment and luxury holdings: ports of bobupdates/test_investments.py return math plus
// the acceptance fixtures in Packet 1 (INV-A01–A07) and Packet 2 (LUX-T02–T06), and the
// worked life-insurance and annuity examples.
import { createLedger, applyOp, totalBorrowing, taxesOwed, landingStatus, quoteAcquire } from '../ledger';
import { launchValue, accrue, eventResult, assetValue, policyLoanQuote, annuityCancelQuote, holdingsValue } from '../holdings';
import { INVESTMENT_CATALOG, LUXURY_CATALOG, canonicalId, investmentEntry } from '../catalog';

const $ = d => Math.round(d * 100);
let n = 0;
const run = (state, type, payload = {}, id = `h${++n}`) => applyOp(state, { id, type, ...payload });
const exec = (state, type, payload, id) => run(state, type, payload, id).state;
const threes = Array(60).fill(3);

function advanceTo(state, units, draws = threes) {
  let s = state;
  while (s.progress < units) s = exec(s, 'roll', { steps: Math.min(6, units - s.progress), draws });
  return s;
}

/** A ledger that skips the landing requirement, for testing card mechanics directly. */
const open = (cash, opts = {}) => ({ ...createLedger({ openingCash: $(cash), ...opts , landingEvents: false }), requireLanding: false });
const buy = (s, entryId, extra = {}) => {
  const entry = investmentEntry(entryId) || LUXURY_CATALOG.find(e => e.id === entryId);
  return run(s, 'acquire', { entryId, assetId: `a-${entryId}-${++n}`, cashPart: entry ? entry.price : 0, ...extra });
};
const asset = (s, cardId) => s.assets.find(a => a.cardId === cardId);

describe('catalog', () => {
  test('62 enabled source entries + 5 Youth Sports stages + the authored representative, no aliases', () => {
    expect(INVESTMENT_CATALOG).toHaveLength(68);
    expect(INVESTMENT_CATALOG.some(e => /^I4[1-9]$|^I50$|^I32$/.test(e.id))).toBe(false);
    expect(INVESTMENT_CATALOG.some(e => ['RE_HOLDCO', 'RE_INSURANCE', 'DEF_UMBRELLA'].includes(e.id))).toBe(false);
  });
  test('aliases route to canonical records', () => {
    expect(canonicalId('I32')).toBe('YSH_SPONSOR');
    expect(canonicalId('I42')).toBe('YSH_SPONSOR');
    expect(canonicalId('I41')).toBe('I31');
  });
  test('69 luxury items, 14 vehicles, retired LX06-08 absent', () => {
    expect(LUXURY_CATALOG).toHaveLength(69);
    expect(LUXURY_CATALOG.filter(e => e.category === 'vehicles')).toHaveLength(14);
    expect(LUXURY_CATALOG.some(e => ['LX06', 'LX07', 'LX08'].includes(e.id))).toBe(false);
  });
});

describe('return math (engine_investments.py)', () => {
  const complex = [-10000, -2500, 0, 2500, 5000, 7500];
  test('complex failure', () => expect(launchValue(100000000, complex, 1)).toBe(0));
  test('complex upside', () => expect(launchValue(100000000, complex, 6)).toBe(175000000));
  test('zero never recovers', () => expect(accrue(0, 7500, 40)).toBe(0));
  test('negative rate continues', () => expect(accrue(75000000, -2500, 40)).toBe(56250000));
  test('clinic is not an asset', () =>
    expect(eventResult(1000000, [0, 500, 1000, 1500, 2000, 3000], 4)).toEqual({ cost: 1000000, receipts: 1150000, profit: 150000 }));
  test('a partial circuit earns less than a full lap', () => expect(accrue(100000000, 7500, 1)).toBeLessThan(102000000));
  test('invalid die', () => expect(() => launchValue(100, [0, 0, 0, 0, 0, 0], 7)).toThrow());
});

describe('Packet 1 acceptance', () => {
  test('INV-A01: business launch, retry, one owned circuit at +5%', () => {
    let s = open(50000);
    const first = run(s, 'acquire', { entryId: 'I4', assetId: 'ch', cashPart: $(10000), face: 4 }, 'same');
    const again = run(first.state, 'acquire', { entryId: 'I4', assetId: 'ch', cashPart: $(10000), face: 4 }, 'same');
    s = again.state;
    expect(again.replayed).toBe(true);
    expect(s.cash).toBe($(40000));
    expect(s.assets).toHaveLength(1);
    expect(assetValue(s, asset(s, 'I4'))).toBe($(11500));
    expect(totalBorrowing(s)).toBe(0);
    s = advanceTo(s, 40);
    expect(assetValue(s, asset(s, 'I4'))).toBe($(12075));
  });

  test('INV-A02: renovation adds to the new capital only', () => {
    let s = buy(open(200000), 'I1', { face: 3 }).state;
    const parent = asset(s, 'I1');
    parent.anchorValue = $(100000);
    s = buy(s, 'I2', { face: 4, targetId: parent.id }).state;
    const p = asset(s, 'I1');
    expect(assetValue(s, p)).toBe($(148000));
    expect(p.basis).toBe($(70000));
    expect(p.rateBps).toBe(300);
    expect(s.assets).toHaveLength(1);
  });

  test('INV-A03: sponsorship through an old alias, once per game', () => {
    let s = open(30000);
    const r = run(s, 'acquire', { entryId: 'I32', assetId: 'sp', cashPart: $(20000) });
    s = r.state;
    expect([s.cash, r.result.rep, r.result.career]).toEqual([$(10000), 4, 0]);
    expect(holdingsValue(s).assetsValue).toBe(0);
    expect(() => run(s, 'acquire', { entryId: 'I42', assetId: 'sp2', cashPart: $(20000) })).toThrow('Already completed');
  });

  test('INV-A04: clinic settles once with business profit', () => {
    let s = open(20000);
    s.milestones.push('YSH_SPONSOR');
    const r = buy(s, 'YSH_CLINIC', { face: 4 });
    s = r.state;
    expect(s.cash).toBe($(21500));
    expect([r.result.profit, r.result.rep, r.result.career]).toEqual([$(1500), 1, 1]);
    expect(s.assets).toHaveLength(0);
    expect(s.taxIncome[1].businessProfits).toEqual([$(1500)]);
  });

  test('INV-A05: complex total failure keeps the loan', () => {
    let s = open(600000);
    s.progress = 40;
    s.closedLaps = [1];
    s.assets.push({ id: 'ctr', cardId: 'YSH_CENTER', holding: 'growth', status: 'active', acquiredAt: 0, ownershipBps: 10000, anchorValue: $(150000), anchorProgress: 40, rateBps: 0, basis: $(150000), exposure: ['operating_business'], stages: [] });
    s = buy(s, 'YSH_COMPLEX', { cashPart: $(500000), face: 1 }).state;
    const cx = asset(s, 'YSH_COMPLEX');
    expect(assetValue(s, cx)).toBe(0);
    expect(cx.failed).toBe(true);
    expect(totalBorrowing(s)).toBe($(500000));
  });

  test('INV-A07: market draw changes value without a cash charge', () => {
    let s = buy(open(20000), 'OFF_STOCKS', { face: 4 }).state;
    expect(assetValue(s, asset(s, 'OFF_STOCKS'))).toBe($(24000));
    s = advanceTo(s, 40, [1, ...threes]);
    expect(assetValue(s, asset(s, 'OFF_STOCKS'))).toBe($(20400));
    expect(s.cash).toBe($(2500)); // only the lap award
  });

  test('upgrades need their parent stage; one stage per parent', () => {
    let s = buy(open(300000), 'I1', { face: 3 }).state;
    const id = asset(s, 'I1').id;
    expect(() => buy(s, 'I3', { face: 3, targetId: id })).toThrow('renovated');
    s = buy(s, 'I2', { face: 3, targetId: id }).state;
    expect(() => buy(s, 'I2', { face: 3, targetId: id })).toThrow();
    s = buy(s, 'I3', { face: 3, targetId: id }).state;
    expect(asset(s, 'I1').exposure).toContain('rental_property');
  });

  test('investments financed at most 50%; the loan is linked to the asset', () => {
    let s = open(10000);
    expect(() => buy(s, 'I4', { face: 3, cashPart: $(4000) })).toThrow();
    s = buy(s, 'I4', { face: 3, cashPart: $(5000) }).state;
    expect(s.loans[0].assetId).toBe(asset(s, 'I4').id);
  });

  test('Legal Support pays 80% of the legal fees only', () => {
    let s = buy(open(50000), 'DEF_LEGAL_BASIC').state;
    const r = run(s, 'legacy_expense', { amount: $(35000), label: 'NIL lawsuit', legalFee: $(15000), useLegal: true });
    expect([r.result.assistance, r.result.paid]).toEqual([$(12000), $(23000)]);
    expect(asset(r.state, 'DEF_LEGAL_BASIC').uses).toBe(0);
  });

  test('plans cap at three unused uses', () => {
    const s = buy(open(50000), 'DEF_LEGAL_PREMIUM').state;
    expect(() => buy(s, 'DEF_LEGAL_BASIC')).toThrow('at most 3');
  });
});

describe('life insurance (Tier B worked example)', () => {
  test('growth, policy loan, repayment and cancellation', () => {
    let s = buy(open(100000), 'INV_LIFE_INSURANCE_TIER_B').state;
    const id = asset(s, 'INV_LIFE_INSURANCE_TIER_B').id;
    expect(() => run(s, 'policy_loan', { assetId: id, amount: $(1000) })).toThrow('one full lap');
    s = advanceTo(s, 40);
    expect([s.cash, assetValue(s, asset(s, 'INV_LIFE_INSURANCE_TIER_B'))]).toEqual([$(27500), $(77250)]);
    s = exec(s, 'policy_loan', { assetId: id, amount: $(30000) });
    expect(s.cash).toBe($(57500));
    s = advanceTo(s, 80);
    const p = asset(s, 'INV_LIFE_INSURANCE_TIER_B');
    const q = policyLoanQuote(s, p);
    expect([s.cash, q.value, q.balance]).toEqual([$(60000), $(79567.5), $(32400)]);
    s = exec(s, 'policy_pay', { assetId: id, amount: $(6000) });
    expect(policyLoanQuote(s, asset(s, 'INV_LIFE_INSURANCE_TIER_B')).balance).toBe($(26400));
    expect(policyLoanQuote(s, asset(s, 'INV_LIFE_INSURANCE_TIER_B')).netProtection).toBe($(223600));
    const before = taxesOwed(s);
    s = exec(s, 'policy_cancel', { assetId: id });
    expect(s.cash).toBe($(107167.5));
    expect(s.taxIncome[3].contractGains).toBe($(4567.5));
    expect(taxesOwed(s)).toBe(before);
  });

  test('Tier A maximum first loan after one owned lap', () => {
    let s = advanceTo(buy(open(30000), 'INV_LIFE_INSURANCE_TIER_A').state, 40);
    expect(policyLoanQuote(s, asset(s, 'INV_LIFE_INSURANCE_TIER_A')).max).toBe($(19312.5));
  });
});

describe('annuities (Tier A worked example)', () => {
  test('two payments transfer value to cash; earnings only are taxable', () => {
    let s = buy(open(100000), 'INV_ANNUITY_TIER_5Y').state;
    s = advanceTo(s, 40);
    expect(s.cash).toBe($(79009.8));
    expect(assetValue(s, asset(s, 'INV_ANNUITY_TIER_5Y'))).toBe($(25490.2));
    expect(s.taxIncome[1].contractGains).toBe($(1509.8));
    s = advanceTo(s, 80);
    expect(s.cash).toBe($(108019.61));
    expect(asset(s, 'INV_ANNUITY_TIER_5Y').status).toBe('paid_out');
  });

  test('cancel before income at half a lap: $48,440.69', () => {
    let s = buy(open(100000), 'INV_ANNUITY_TIER_5Y').state;
    s = advanceTo(s, 20);
    const q = annuityCancelQuote(s, asset(s, 'INV_ANNUITY_TIER_5Y'));
    expect([q.value, q.fee, q.proceeds]).toEqual([$(50990.2), $(2549.51), $(48440.69)]);
  });

  test('5-lap game, Tier A bought at 3.5 laps: one payment, $25,995.01 left', () => {
    let s = advanceTo(open(100000), 140);
    s = buy(s, 'INV_ANNUITY_TIER_5Y').state;
    s = advanceTo(s, 200);
    expect(asset(s, 'INV_ANNUITY_TIER_5Y').cashReceived).toBe($(26509.8));
    expect(assetValue(s, asset(s, 'INV_ANNUITY_TIER_5Y'))).toBe($(25995.01));
  });
});

describe('Packet 2 acceptance', () => {
  test('LUX-T02: VX08 resale schedule; sale keeps credit debt', () => {
    let s = buy(open(75000), 'VX08').state;
    expect(assetValue(s, asset(s, 'VX08'))).toBe($(56250));
    s = advanceTo(s, 40);
    expect(assetValue(s, asset(s, 'VX08'))).toBe($(50625));
    const r = run(s, 'sell_asset', { assetId: asset(s, 'VX08').id });
    expect([r.result.cashDelta, r.result.tax]).toEqual([$(50625), 0]);
  });

  test('LUX-T03: financed launch, die 5, profit to the business bucket', () => {
    let s = buy(open(20000), 'I4', { face: 3 }).state;
    s.creditScore = 750;
    const r = buy(s, 'LX31', { face: 5, cashPart: 0, targetId: asset(s, 'I4').id });
    s = r.state;
    expect([r.result.receipts, r.result.profit, r.result.rep]).toEqual([$(15000), $(5000), 2]);
    expect(totalBorrowing(s)).toBe($(10000));
    expect(s.taxIncome[1].businessProfits).toEqual([$(5000)]);
  });

  test('one activation per lap across both menus', () => {
    let s = buy(open(100000), 'I4', { face: 3 }).state;
    const target = asset(s, 'I4').id;
    s = buy(s, 'LX31', { face: 3, targetId: target }).state;
    expect(() => buy(s, 'I35', { face: 3, targetId: target })).toThrow('this lap');
    s = advanceTo(s, 40);
    expect(() => buy(s, 'I35', { face: 3, targetId: target })).not.toThrow();
  });

  test('LUX-T05: strongest creator discount once per lap', () => {
    let s = buy(buy(open(50000), 'LX26').state, 'LX27').state;
    const r = run(s, 'acquire', { entryId: 'LX30', assetId: 'series', cashPart: $(14000) });
    expect(r.result.discount).toBe($(1000));
    s = exec(r.state, 'roll', { steps: 1 });
    s = exec(s, 'complete_service', { assetId: 'series', choice: 'Twelve short videos' });
    // Same lap: the allowance is used, so a second series is full price.
    expect(quoteAcquire(s, { entryId: 'LX30' }).discount).toBe(0);
    s = advanceTo(s, 40);
    expect(quoteAcquire(s, { entryId: 'LX30' }).discount).toBe($(1000));
  });

  test('LUX-T06: activation family REP is a high-water mark', () => {
    let s = buy(open(200000), 'I7', { face: 3 }).state;
    const target = asset(s, 'I7').id;
    const a = buy(s, 'LX31', { face: 3, targetId: target });
    s = advanceTo(a.state, 40);
    const b = buy(s, 'LX32', { face: 6, targetId: target });
    expect(a.result.rep + b.result.rep).toBe(2);
  });

  test('services earn REP only when delivered on a later turn', () => {
    let s = buy(open(10000), 'LX29').state;
    const id = asset(s, 'LX29').id;
    expect(() => run(s, 'complete_service', { assetId: id, choice: 'Community first' })).toThrow('later turn');
    s = exec(s, 'roll', { steps: 2 });
    expect(run(s, 'complete_service', { assetId: id, choice: 'Community first' }).result.rep).toBe(1);
  });

  test('companion care is offered each later lap and never auto-borrows', () => {
    let s = buy(open(10000), 'PX01', { confirmed: true }).state;
    expect(s.cash).toBe($(7500));
    s = advanceTo(s, 40);
    const pet = asset(s, 'PX01');
    expect(pet.pendingCare.amount).toBe($(1500));
    expect(totalBorrowing(s)).toBe(0);
    s = exec(s, 'companion_care', { assetId: pet.id, method: 'rehome' });
    expect(asset(s, 'PX01').status).toBe('rehomed');
  });

  test('gated items stay unavailable with a reason', () => {
    expect(() => buy(open(100000), 'HX03')).toThrow('personal home');
    expect(() => buy(open(100000), 'LX36')).toThrow('task');
  });
});

describe('landing opportunities', () => {
  test('one purchase per matching landing', () => {
    let s = createLedger({ openingCash: $(50000) , landingEvents: false });
    expect(landingStatus(s, investmentEntry('I4')).ok).toBe(false);
    s.opportunity = { category: 'green', used: false };
    s = exec(s, 'acquire', { entryId: 'I4', assetId: 'c1', cashPart: $(10000), face: 3 });
    expect(() => run(s, 'acquire', { entryId: 'I28', assetId: 'c2', cashPart: $(10000), face: 3 })).toThrow('already used');
    expect(landingStatus(s, LUXURY_CATALOG[0]).ok).toBe(false);
  });
});
