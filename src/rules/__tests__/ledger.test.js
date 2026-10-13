// Ledger behavior: ports of the LedgerDemo checks in test_finance_reference.py plus the
// worked examples from the Master Implementation Spec's Central financial rules chapter.
import {
  createLedger, applyOp, requiredPayment, totalBorrowing, taxesOwed, holds, availableUnsecured,
  quoteBuy, completedLaps, inFinalWindow,
} from '../ledger';
import { createTaxBill } from '../finance';
import { scoreBreakdown } from '../portfolio';

const $ = d => Math.round(d * 100);
let n = 0;
const run = (state, type, payload = {}, id = `t${++n}`) => applyOp(state, { id, type, ...payload });
const exec = (state, type, payload, id) => run(state, type, payload, id).state;

/** Roll in steps of up to 6 until progress reaches `units`. */
function advanceTo(state, units) {
  let s = state;
  while (s.progress < units) s = exec(s, 'roll', { steps: Math.min(6, units - s.progress) });
  return s;
}

const wealth = s => s.cash + s.taxBucket - totalBorrowing(s) - taxesOwed(s);

describe('operation receipts and atomicity', () => {
  test('purchase retry returns the original result without a second charge', () => {
    let s = createLedger({ openingCash: $(40000) });
    s.creditScore = 750;
    s = exec(s, 'buy', { kind: 'luxury', assetId: 'old', label: 'Old', price: $(20000), cashPart: 0 });
    s.cash = $(40000);
    const first = run(s, 'buy', { kind: 'luxury', assetId: 'car', label: 'Car', price: $(75000), cashPart: $(15000) }, 'same');
    const second = run(first.state, 'buy', { kind: 'luxury', assetId: 'car', label: 'Car', price: $(75000), cashPart: $(15000) }, 'same');
    expect(second.replayed).toBe(true);
    expect(second.state.cash).toBe($(25000));
    expect(totalBorrowing(second.state)).toBe($(80000));
    expect(second.state.loans).toHaveLength(2);
  });

  test('changed payload under the same id is rejected', () => {
    const s = exec(createLedger({ openingCash: $(10000) }), 'reserve', { amount: $(1000) }, 'r');
    expect(() => run(s, 'reserve', { amount: $(2000) }, 'r')).toThrow('reused');
  });

  test('credit failure leaves the state untouched', () => {
    let s = createLedger({ openingCash: $(40000) });
    s = exec(s, 'buy', { kind: 'luxury', assetId: 'old', label: 'Old', price: $(20000), cashPart: 0 });
    const before = JSON.stringify(s);
    expect(() => run(s, 'buy', { kind: 'luxury', assetId: 'car', label: 'Car', price: $(75000), cashPart: $(15000) }))
      .toThrow('available credit');
    expect(JSON.stringify(s)).toBe(before);
  });

  test('failed tax payment rolls back', () => {
    const s = createLedger({ openingCash: $(1000) });
    s.taxBills.push(createTaxBill({ id: 'b1', lap: 1, assessed: $(5000) }));
    expect(() => run(s, 'pay_taxes', { amount: $(2000) })).toThrow();
    expect(s.cash).toBe($(1000));
    expect(taxesOwed(s)).toBe($(5000));
    expect(s.journal).toHaveLength(0);
  });
});

describe('tax bucket', () => {
  test('reserving is not paying tax and leaves wealth unchanged', () => {
    let s = createLedger({ openingCash: $(10000) });
    s.taxBills.push(createTaxBill({ id: 'b1', lap: 1, assessed: $(10000) }));
    const before = wealth(s);
    s = exec(s, 'reserve', { amount: $(10000) });
    expect(taxesOwed(s)).toBe($(10000));
    expect(wealth(s)).toBe(before);
  });

  test('tax payment leaves wealth unchanged', () => {
    let s = createLedger({ openingCash: $(10000) });
    s.taxBills.push(createTaxBill({ id: 'b1', lap: 1, assessed: $(5000) }));
    const before = wealth(s);
    s = exec(s, 'pay_taxes', { amount: $(3000) });
    expect(wealth(s)).toBe(before);
  });

  test('NIL receipt with set-aside, lap bill, and payment from the bucket', () => {
    let s = createLedger({ openingCash: $(10000) });
    s = exec(s, 'income', { amount: $(50000), taxClass: 'nil', setAside: $(10000) });
    expect([s.cash, s.taxBucket]).toEqual([$(50000), $(10000)]);
    s = advanceTo(s, 40);
    // 20% of $50,000 NIL + $2,500 lap award.
    expect(taxesOwed(s)).toBe($(10500));
    s = exec(s, 'pay_taxes', { amount: $(10000), source: 'bucket' });
    s = exec(s, 'pay_taxes', { amount: $(500) });
    s = exec(s, 'roll', { steps: 3 });
    expect(taxesOwed(s)).toBe(0);
    expect(holds(s).map(h => h.code)).not.toContain('tax');
  });

  test('missed tax deadline adds 5% and a borrowing hold', () => {
    let s = createLedger({ openingCash: $(10000) });
    s = exec(s, 'income', { amount: $(47500), taxClass: 'nil' });
    s = advanceTo(s, 40);
    expect(taxesOwed(s)).toBe($(10000));
    s = exec(s, 'roll', { steps: 2 });
    expect(taxesOwed(s)).toBe($(10500));
    expect(holds(s).map(h => h.code)).toContain('tax');
    // The next lap close adds another 5% of remaining principal.
    s = advanceTo(s, 80);
    expect(s.taxBills[0].lateFees).toBe($(1000));
  });
});

describe('ordinary interest and the required payment (worked examples)', () => {
  const borrowAt = units => {
    let s = createLedger({ openingCash: $(100000) });
    s = advanceTo(s, units);
    return exec(s, 'buy', { kind: 'investment', assetId: 'biz', label: 'Biz', price: $(200000), cashPart: $(100000) });
  };

  test('$100,000 outstanding all lap at 25%: $25,000 interest + $10,000 principal', () => {
    const s = advanceTo(borrowAt(0), 40);
    const r = requiredPayment(s);
    expect([r.interest, r.principal, r.total]).toEqual([$(25000), $(10000), $(35000)]);
  });

  test('$100,000 drawn with a quarter lap left: $6,250 + $2,500', () => {
    const s = advanceTo(borrowAt(30), 40);
    const r = requiredPayment(s);
    expect([r.interest, r.principal, r.total]).toEqual([$(6250), $(2500), $(8750)]);
  });

  test('paying on time earns +25 and leaves $90,000 principal', () => {
    let s = advanceTo(borrowAt(0), 40);
    s.cash = $(50000);
    s = exec(s, 'pay_debt', { amount: $(35000) });
    expect(totalBorrowing(s)).toBe($(90000));
    s = exec(s, 'roll', { steps: 1 });
    expect(s.creditScore).toBe(525);
    expect(requiredPayment(s).overdue).toBe(0);
  });

  test('paying only the interest leaves principal overdue: -50 and a hold', () => {
    let s = advanceTo(borrowAt(0), 40);
    s.cash = $(50000);
    s = exec(s, 'pay_debt', { amount: $(25000) });
    expect(requiredPayment(s).principal).toBe($(10000));
    s = exec(s, 'roll', { steps: 1 });
    expect(s.creditScore).toBe(450);
    expect(requiredPayment(s).overdue).toBe($(10000));
    expect(holds(s).map(h => h.code)).toEqual(expect.arrayContaining(['delinquent', 'score']));
    // Paying the overdue amount clears the delinquency hold immediately; the score stays.
    s = exec(s, 'pay_debt', { amount: $(10000) });
    expect(holds(s).map(h => h.code)).not.toContain('delinquent');
    expect(s.creditScore).toBe(450);
  });

  test('a paydown in the same lap as the draw earns no extra (draws offset repayments)', () => {
    let s = advanceTo(borrowAt(0), 40);
    s.cash = $(100000);
    s = exec(s, 'pay_debt', { amount: $(50000) });
    s = exec(s, 'roll', { steps: 1 });
    expect(s.creditScore).toBe(525);
  });

  test('a later lap paydown of at least 25% of B earns the extra +25', () => {
    let s = advanceTo(borrowAt(0), 40);
    s.cash = $(200000);
    s = exec(s, 'pay_debt', { amount: requiredPayment(s).total });
    s = exec(s, 'roll', { steps: 1 });
    expect(s.creditScore).toBe(525);
    s = exec(s, 'pay_debt', { amount: $(30000) });
    s = advanceTo(s, 80);
    s = exec(s, 'pay_debt', { amount: requiredPayment(s).total });
    s = exec(s, 'roll', { steps: 1 });
    expect(s.creditScore).toBe(575);
  });

  test('a debt-free player earns +50 per checkpoint', () => {
    let s = advanceTo(createLedger({ openingCash: $(1000) }), 40);
    s = exec(s, 'roll', { steps: 1 });
    expect(s.creditScore).toBe(550);
  });

  test('a better score lowers the rate prospectively', () => {
    let s = createLedger({ openingCash: $(1000) });
    s.creditScore = 650;
    expect(quoteBuy(s, { kind: 'luxury', price: $(10000), cashPart: 0 }).rateBps).toBe(1500);
  });
});

describe('borrowing permissions', () => {
  test('investments require at least 50% cash', () => {
    const s = createLedger({ openingCash: $(100000) });
    expect(quoteBuy(s, { kind: 'investment', price: $(100000), cashPart: $(40000) }).ok).toBe(false);
    expect(quoteBuy(s, { kind: 'investment', price: $(100000), cashPart: $(50000) }).ok).toBe(true);
  });

  test('cash-only cards cannot be financed', () => {
    const s = createLedger({ openingCash: $(100000) });
    expect(quoteBuy(s, { kind: 'investment', price: $(25000), cashPart: $(10000), cashOnly: true }).ok).toBe(false);
  });

  test('luxury credit is limited by the score band', () => {
    const s = createLedger({ openingCash: $(1000) });
    expect(availableUnsecured(s)).toBe($(20000));
    expect(quoteBuy(s, { kind: 'luxury', price: $(21000), cashPart: 0 }).ok).toBe(false);
  });

  test('asset advance up to 50% of value less linked debt', () => {
    let s = createLedger({ openingCash: $(100000) });
    s = exec(s, 'buy', { kind: 'investment', assetId: 'biz', label: 'Biz', price: $(100000), cashPart: $(80000) });
    expect(() => run(s, 'advance', { assetId: 'biz', label: 'Biz', value: $(120000), amount: $(41000) })).toThrow();
    s = exec(s, 'advance', { assetId: 'biz', label: 'Biz', value: $(120000), amount: $(40000) });
    expect(totalBorrowing(s)).toBe($(60000));
    expect(s.loans).toHaveLength(1);
  });
});

describe('sales', () => {
  test('gain tax, linked payoff, then cash', () => {
    let s = createLedger({ openingCash: $(500000) });
    s = exec(s, 'buy', { kind: 'investment', assetId: 'cx', label: 'Complex', price: $(1000000), cashPart: $(500000) });
    s = exec(s, 'sell', { assetId: 'cx', label: 'Complex', value: $(1200000), basis: $(1000000) });
    expect(s.cash).toBe($(660000));
    expect(totalBorrowing(s)).toBe(0);
  });

  test('luxury resale keeps unsecured debt', () => {
    let s = createLedger({ openingCash: $(5000) });
    s.creditScore = 750;
    s = exec(s, 'buy', { kind: 'luxury', assetId: 'car', label: 'Car', price: $(65000), cashPart: 0 });
    const before = s.cash + $(45000) - totalBorrowing(s);
    s = exec(s, 'sell', { assetId: 'car', label: 'Car', value: $(45000), basis: $(65000) });
    expect(s.cash).toBe($(50000));
    expect(totalBorrowing(s)).toBe($(65000));
    expect(s.cash - totalBorrowing(s)).toBe(before);
  });

  test('underwater sale needs a residual exit and then holds borrowing', () => {
    let s = createLedger({ openingCash: $(500000) });
    s = exec(s, 'buy', { kind: 'investment', assetId: 'cx', label: 'Complex', price: $(1000000), cashPart: $(500000) });
    s.cash = 0;
    expect(() => run(s, 'sell', { assetId: 'cx', label: 'Complex', value: $(400000), basis: $(1000000) })).toThrow();
    s = exec(s, 'sell', { assetId: 'cx', label: 'Complex', value: $(400000), basis: $(1000000), residualExit: true });
    expect(totalBorrowing(s)).toBe($(100000));
    expect(holds(s).map(h => h.code)).toContain('residual');
  });
});

describe('lap clock and finish', () => {
  test('one lap award per boundary and overshoot clamps at the final cutoff', () => {
    let s = createLedger({ openingCash: 0, totalLaps: 5 });
    s = advanceTo(s, 198);
    expect(completedLaps(s)).toBe(4);
    s = exec(s, 'roll', { steps: 6 });
    expect(s.progress).toBe(200);
    expect(s.closedLaps).toEqual([1, 2, 3, 4, 5]);
    // Five $2,500 lap awards; anything else is yellow-space income drawn on the way.
    const yellowCash = s.yellowHistory.reduce((t, y) => t + y.cash + y.recovered, 0);
    expect(s.cash - yellowCash).toBe($(12500));
    expect(inFinalWindow(s)).toBe(true);
    expect(() => run(s, 'roll', { steps: 1 })).toThrow('final lap');
    expect(quoteBuy(s, { kind: 'luxury', price: 100, cashPart: 100 }).ok).toBe(false);
  });

  test('finish returns the same snapshot for any later request and blocks mutations', () => {
    let s = createLedger({ openingCash: $(10000) });
    const one = run(s, 'finish', { external: { rep: 4 } }, 'f1');
    const two = run(one.state, 'finish', { external: { rep: 99 } }, 'f2');
    expect(two.result).toEqual(one.result);
    expect(() => run(two.state, 'reserve', { amount: $(1000) })).toThrow('finished');
  });

  test('finish applies the initial late charge to an unpaid final bill', () => {
    let s = createLedger({ openingCash: $(1000) });
    s.taxBills.push(createTaxBill({ id: 'last', lap: 5, assessed: $(1000), provisional: true }));
    const snap = run(s, 'finish', { external: {} }).result;
    expect(snap.taxesOwed).toBe($(1050));
    expect(snap.score.financialWealth).toBe($(-50));
  });

  test('final-window income updates the provisional final bill', () => {
    let s = advanceTo(createLedger({ openingCash: 0, totalLaps: 5 }), 200);
    const before = taxesOwed(s);
    s = exec(s, 'income', { amount: $(10000), taxClass: 'nil' });
    expect(taxesOwed(s) - before).toBe($(2000));
  });
});

test('worked portfolio from the spec: $135,000 wealth, $165,000 game value', () => {
  const x = scoreBreakdown({
    cash: $(40000), taxBucket: $(10000), assetsValue: $(150000), luxuryResale: $(20000),
    ordinaryDebt: $(80000), taxesOwed: $(5000), rep: 4, career: 3, creditScore: 650,
  });
  expect(x.financialWealth).toBe($(135000));
  expect(x.repValue + x.careerValue + x.creditBonus).toBe($(30000));
  expect(x.gameValue).toBe($(165000));
});
