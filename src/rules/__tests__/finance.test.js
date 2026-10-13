// Port of bobupdates/test_finance_reference.py (function-level checks).
// The Python reference works in dollars; these use integer cents ($1 = 100).
import {
  band, availableCredit, assetAdvance, creditCheckpoint, ordinaryInterest, principalTarget,
  annualTax, sale, refundSplit, legalAssistance, createTaxBill, chargeTaxBill, payTaxBill,
  adjustTaxBill, taxBillOwed, policyValue, buyAnnuity, annuityAt,
} from '../finance';

const $ = d => Math.round(d * 100);

describe('credit bands and capacity', () => {
  test.each([[500, 2500], [600, 2000], [650, 1500], [700, 1000], [750, 500]])(
    'score %i -> %i bps', (score, bps) => expect(band(score).rateBps).toBe(bps)
  );
  test('credit cap', () => expect(availableCredit(600, $(25000), $(1500))).toBe($(3500)));
  test('hold blocks credit', () => expect(availableCredit(750, 0, 0, ['tax'])).toBe(0));
  test('low score blocks credit', () => expect(availableCredit(450, 0)).toBe(0));
  test('asset advance', () => expect(assetAdvance($(1200000), $(500000))).toBe($(100000)));
  test('out of range score throws', () => expect(() => band(900)).toThrow());
});

describe('ordinary interest', () => {
  // Python passes elapsed laps; on a 40-space board 0.5 lap = 20 units, 0.25 = 10, 0.025 = 1.
  test('segments', () =>
    expect(ordinaryInterest([
      { principal: $(100000), rateBps: 2500, units: 20 },
      { principal: $(50000), rateBps: 2500, units: 20 },
    ])).toBe($(18750)));
  test('late draw', () => expect(ordinaryInterest([{ principal: $(100000), rateBps: 2500, units: 10 }])).toBe($(6250)));
  test('prospective rate', () =>
    expect(ordinaryInterest([
      { principal: $(100000), rateBps: 2500, units: 20 },
      { principal: $(100000), rateBps: 2000, units: 20 },
    ])).toBe($(22500)));
  test('tiny segments round once', () =>
    expect(ordinaryInterest(Array(40).fill({ principal: $(1), rateBps: 2500, units: 1 }))).toBe(25));
});

describe('principal target', () => {
  test('target', () =>
    expect(principalTarget({ opening: $(100000), currentPrincipal: $(100000) }).newDue).toBe($(10000)));
  test('late draw target', () =>
    expect(principalTarget({ draws: [{ amount: $(100000), remainingUnits: 10 }], currentPrincipal: $(100000) }).newDue)
      .toBe($(2500)));
  test('early target payment', () =>
    expect(principalTarget({ opening: $(100000), creditPaid: $(10000), currentPrincipal: $(90000) }).newDue).toBe(0));
  test('marker is not another liability', () => {
    const x = principalTarget({ opening: $(100000), currentPrincipal: $(100000), olderDue: $(10000) });
    expect(x.totalPrincipalDue).toBe($(20000));
    expect(x.totalPrincipalDue).toBeLessThanOrEqual($(100000));
  });
  test('reversed draw', () =>
    expect(principalTarget({ draws: [{ amount: $(10000), remainingUnits: 20 }], reversedBasis: $(5000) }).newDue)
      .toBe(0));
});

describe('credit checkpoint', () => {
  test('on time', () => expect(creditCheckpoint(500, true, false, 0, $(100000))).toBe(525));
  test('debt free', () => expect(creditCheckpoint(500, true, true)).toBe(550));
  test('substantial paydown', () => expect(creditCheckpoint(600, true, false, $(25000), $(100000))).toBe(650));
  test('missed', () => expect(creditCheckpoint(500, false, false)).toBe(450));
  test('bounds', () => expect(creditCheckpoint(825, true, true)).toBe(850));
});

describe('annual tax', () => {
  test('mixed', () =>
    expect(annualTax({ nil: $(50000), award: $(2500), cashEarnings: $(1000), businessProfits: [$(15000), $(-8000)] }).tax)
      .toBe($(12100)));
  test('business loss floors at zero', () =>
    expect(annualTax({ nil: $(50000), businessProfits: [$(-10000)] }).tax).toBe($(10000)));
  test('no tax on unrealized', () => expect(annualTax().tax).toBe(0));
});

describe('sales', () => {
  test('sale gain', () => {
    const x = sale({ value: $(1200000), basis: $(1000000), debt: $(500000) });
    expect([x.tax, x.cashDelta]).toEqual([$(40000), $(660000)]);
  });
  test('partial sale', () => {
    const x = sale({ value: $(1200000), basis: $(1000000), debt: $(500000), fractionBps: 2500 });
    expect([x.tax, x.cashDelta, x.residual, x.basisLeft]).toEqual([$(10000), $(165000), $(375000), $(750000)]);
  });
  test('full underwater residual exit', () => {
    const x = sale({ value: $(400000), basis: $(1000000), debt: $(500000), residualExit: true });
    expect([x.cashDelta, x.residual]).toEqual([0, $(100000)]);
  });
  test('partial underwater rejected', () =>
    expect(() => sale({ value: $(800000), basis: $(1000000), debt: $(850000), fractionBps: 2500, available: $(10000) }))
      .toThrow());
  test('partial underwater funded', () =>
    expect(sale({ value: $(800000), basis: $(1000000), debt: $(850000), fractionBps: 2500, available: $(12500) }).cashDelta)
      .toBe($(-12500)));
  test('gain with negative equity', () => {
    const x = sale({ value: $(1200000), basis: $(1000000), debt: $(1250000), residualExit: true });
    expect([x.tax, x.residual]).toEqual([$(40000), $(90000)]);
  });
});

describe('refunds', () => {
  test('split refund', () => {
    const x = refundSplit({ refund: $(30000), originalCash: $(20000), originalCredit: $(40000), unpaidOriginalPrincipal: $(12000) });
    expect([x.cash, x.principalReduction]).toEqual([$(18000), $(12000)]);
  });
  test('refund cap', () =>
    expect(() => refundSplit({ refund: $(61000), originalCash: $(20000), originalCredit: $(40000) })).toThrow());
  test('fragmented refund cannot farm cents', () => {
    const a = refundSplit({ refund: 1, originalCash: 1, originalCredit: 2 });
    const b = refundSplit({
      refund: 2, originalCash: 1, originalCredit: 2,
      alreadyRefundedCash: a.cashComponent, alreadyRefundedCredit: a.creditComponent,
    });
    expect(a.cashComponent + b.cashComponent).toBe(1);
  });
  test('two refunds after repayment', () => {
    const a = refundSplit({ refund: $(30000), originalCash: $(20000), originalCredit: $(40000), unpaidOriginalPrincipal: $(24000) });
    const b = refundSplit({
      refund: $(30000), originalCash: $(20000), originalCredit: $(40000),
      alreadyRefundedCash: a.cashComponent, alreadyRefundedCredit: a.creditComponent, unpaidOriginalPrincipal: $(4000),
    });
    expect(a.cash + b.cash).toBe($(36000));
    expect(a.principalReduction + b.principalReduction).toBe($(24000));
  });
});

describe('tax bills', () => {
  const bill = (assessed, paid = 0) => createTaxBill({ id: 'b', lap: 1, assessed, paid });
  test('late charge is idempotent per trigger', () => {
    let b = chargeTaxBill(bill($(10000)), 'roll1').bill;
    b = chargeTaxBill(b, 'roll1').bill;
    expect(taxBillOwed(b)).toBe($(10500));
  });
  test('late charges cap at 25% of original overdue', () => {
    let b = bill($(10000));
    for (let n = 0; n < 10; n++) b = chargeTaxBill(b, `t${n}`).bill;
    expect(b.lateFees).toBe($(2500));
  });
  test('partial payment lowers later fee base', () => {
    let b = chargeTaxBill(bill($(10000)), 'r').bill;
    b = payTaxBill(b, $(6000)).bill;
    b = chargeTaxBill(b, 'lap2').bill;
    expect(taxBillOwed(b)).toBe($(4700));
  });
  test('refund preserves valid old fees', () => {
    let b = chargeTaxBill(bill($(10000)), 'r').bill;
    b = payTaxBill(b, $(6000)).bill;
    b = chargeTaxBill(b, 'lap2').bill;
    b = adjustTaxBill(b, $(8000)).bill;
    b = chargeTaxBill(b, 'lap3').bill;
    expect(taxBillOwed(b)).toBe($(2800));
    expect(b.originalOverdue).toBe($(10000));
  });
  test('overpayment returned', () => {
    const r = adjustTaxBill(bill($(10000), $(9000)), $(6000));
    expect(r.giveBack).toBe($(3000));
    expect(taxBillOwed(r.bill)).toBe(0);
  });
  test('rejected adjustment keeps bill', () => {
    const b = bill($(10000), $(4000));
    expect(() => adjustTaxBill(b, -1)).toThrow();
    expect([b.assessed, b.paid, taxBillOwed(b)]).toEqual([$(10000), $(4000), $(6000)]);
  });
});

describe('legal assistance', () => {
  test('cap with follow-up', () => expect(legalAssistance($(35000), $(16000))).toBe($(9000)));
  test('single event', () => expect($(35000) - legalAssistance($(15000))).toBe($(23000)));
});

describe('fixed contracts', () => {
  test('policy value after five laps', () => expect(policyValue($(25000), 5)).toBe(2898185));
  test('final policy tax', () =>
    expect(annualTax({ contractGains: policyValue($(25000), 5) - $(25000) }).tax).toBe(79637));
  test('annuity terms locked at purchase', () => {
    const catalog = { premium: $(50000), rateBps: 400, wait: 1 };
    const a = buyAnnuity(catalog, 0);
    catalog.premium = $(100000);
    expect(annuityAt(a, 1).earnings).toBe(150980);
    expect(a.premium).toBe($(50000));
  });
  test('annuity final values', () => {
    const a = buyAnnuity({ premium: $(50000), rateBps: 400, wait: 1 }, 3.5);
    const x = annuityAt(a, 5);
    expect([x.cash, x.asset]).toEqual([2650980, 2599501]);
  });
});
