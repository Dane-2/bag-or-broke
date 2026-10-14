// Shared sports complex: Company checks from bobupdates/test_investments.py, plus the
// ledger side of INV-A06 (secondary share purchase) and INV-A08 (one shared clock).
import { createCompany, settle, publishListing, quote, transfer, shock, finish } from '../venture';
import { createLedger, applyOp, totalBorrowing, founderVenture, ventureBuyStatus } from '../ledger';
import { assetValue } from '../holdings';

const $ = d => Math.round(d * 100);
const company = () => createCompany({ id: 'cx', founder: 'a', value: 125000000, rateBps: 2500, basis: 100000000, securedDebt: 50000000 });

test('settles once per founder progress', () => {
  const c = settle(company(), 40);
  expect(c.value).toBe(156250000);
  expect(settle(c, 40).value).toBe(156250000);
  expect(() => settle(c, 39)).toThrow('reverse');
});

test('transfer pays secured debt and gain tax; company gets no new cash', () => {
  const c = publishListing(company(), 'a', 2000);
  const q = quote(c, 'a', 2000);
  expect([q.gross, q.gainTax, q.debtPayoff, q.sellerNet]).toEqual([25000000, 1000000, 10000000, 14000000]);
  const after = transfer(c, 'b', q, 25000000);
  expect(after.value).toBe(125000000);
  expect(after.owners).toEqual({ a: 8000, b: 2000 });
  expect(after.basis.b).toBe(25000000);
});

test('cash failure, stale quote and over-offer are refused', () => {
  const c = publishListing(company(), 'a', 2000);
  const q = quote(c, 'a', 2000);
  expect(() => transfer(c, 'b', q, 1)).toThrow('cash required');
  expect(() => transfer(settle(c, 40), 'b', q, 1e9)).toThrow('stale');
  expect(() => publishListing(company(), 'a', 10100)).toThrow();
});

test('frozen partner does not drift; founder finish stops growth', () => {
  let c = createCompany({ id: 'cx', founder: 'a', value: 100000000, rateBps: 2500, basis: 80000000 });
  c = { ...c, owners: { a: 8000, b: 2000 } };
  const { company: c2, snapshot } = finish(c, 'b', 0);
  expect(snapshot.stakeValue).toBe(20000000);
  expect(finish(settle(c2, 40), 'b', 40).snapshot).toEqual(snapshot);
  const { company: c3 } = finish(company(), 'a', 20);
  expect(settle(c3, 40).value).toBe(c3.value);
});

test('a total failure closes listings; personal debt survives', () => {
  const c = shock(publishListing(company(), 'a', 2000), 10000, 0);
  expect(c.listings).toEqual({});
  expect(c.securedDebt.a).toBe(50000000);
  expect(() => publishListing(c, 'a', 100)).toThrow();
});

describe('ledger side (INV-A06)', () => {
  let n = 0;
  const run = (s, type, payload = {}) => applyOp(s, { id: `v${++n}`, type, ...payload });

  function founderWithComplex() {
    let s = { ...createLedger({ openingCash: $(500000), landingEvents: false }), requireLanding: false };
    s.assets.push({ id: 'ctr', cardId: 'YSH_CENTER', holding: 'growth', status: 'active', acquiredAt: -40, ownershipBps: 10000, anchorValue: $(150000), anchorProgress: 0, rateBps: 0, basis: $(150000), exposure: ['operating_business'], stages: [] });
    s = run(s, 'acquire', { entryId: 'YSH_COMPLEX', assetId: 'cx', cashPart: $(500000), face: 4 }).state;
    return s;
  }

  test('founder sells 20% of a $1.25m complex: $10k tax, $100k payoff, $140k net', () => {
    let s = founderWithComplex();
    const cx = s.assets.find(a => a.id === 'cx');
    expect(assetValue(s, cx)).toBe($(1250000));
    expect(founderVenture(s)).toEqual(expect.objectContaining({ ventureId: 'cx', value: $(1250000), units: 10000 }));
    const before = s.cash;
    const r = run(s, 'venture_settle_sale', { ventureId: 'cx', units: 2000, gross: $(250000) });
    s = r.state;
    expect([r.result.tax, r.result.payoff, r.result.net]).toEqual([$(10000), $(100000), $(140000)]);
    expect(s.cash - before).toBe($(140000));
    const after = s.assets.find(a => a.id === 'cx');
    expect([after.units, after.basis]).toEqual([8000, $(800000)]);
    expect(totalBorrowing(s)).toBe($(400000));
    expect(assetValue(s, after)).toBe($(1000000));
  });

  test('buyer pays cash for 20%, inherits no debt, and follows the founder clock', () => {
    let s = createLedger({ openingCash: $(300000), landingEvents: false });
    s.milestones.push('YSH_SPONSOR', 'YSH_CLINIC');
    s.opportunity = { category: 'green', used: false };
    expect(ventureBuyStatus(s, { gross: $(250000), sellerId: 'a', selfId: 'b' }).ok).toBe(true);
    s = run(s, 'venture_buy', { ventureId: 'cx', units: 2000, gross: $(250000), companyValue: $(1250000), title: 'Buy a Sports Complex' }).state;
    const stake = s.assets.find(a => a.holding === 'venture_stake');
    expect([s.cash, assetValue(s, stake), totalBorrowing(s)]).toEqual([$(50000), $(250000), 0]);
    // INV-A08: the company grows once on the founder's clock; the stake follows the published value.
    s = run(s, 'venture_sync', { ventureId: 'cx', companyValue: $(1562500) }).state;
    expect(assetValue(s, s.assets.find(a => a.holding === 'venture_stake'))).toBe($(312500));
  });

  test('buying needs the first two Youth Sports stages and a green landing', () => {
    const s = createLedger({ openingCash: $(300000) });
    expect(ventureBuyStatus(s, { gross: $(250000), sellerId: 'a', selfId: 'b' }).ok).toBe(false);
  });
});
