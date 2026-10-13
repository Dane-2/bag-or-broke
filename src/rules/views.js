// Read-only views of ledger holdings in the record shapes older components and the
// multiplayer room rows expect (dollars, cardTitle/newValue for investments, name/resale
// for luxuries). Nothing writes through these views.
import { catalogEntry } from './catalog';
import { assetValue, policyBalance, isActive } from './holdings';
import { fromCents } from './money';

const INVESTMENT_TYPES = {
  life: () => 'lifeInsurance',
  annuity: () => 'annuity',
  plan: a => (a.plan === 'legal' ? 'legalProtection' : 'healthDisabilityProtection'),
};

export function investmentsView(s) {
  return s.assets
    .filter(a => isActive(a) && a.kind === 'investment')
    .map(a => {
      const entry = catalogEntry(a.cardId);
      const value = assetValue(s, a);
      const cost = fromCents(a.basis);
      const newValue = fromCents(value);
      return {
        assetId: a.id,
        cardId: a.cardId,
        cardTitle: a.title,
        cost,
        newValue,
        percent: cost > 0 ? Math.round(((newValue - cost) / cost) * 100) : 0,
        category: entry ? entry.group : '',
        type: entry ? entry.typeLabel : '',
        investmentType: INVESTMENT_TYPES[a.holding]
          ? INVESTMENT_TYPES[a.holding](a)
          : a.cardId.startsWith('OFF_') ? 'offensivePlanning' : a.holding,
        usesRemaining: a.holding === 'plan' ? a.uses : undefined,
        outstandingLoans: a.holding === 'life' ? fromCents(policyBalance(s, a)) : 0,
      };
    });
}

/** Every luxury purchase this game; resale is the current value of items still owned. */
export function luxuriesView(s) {
  return s.purchases
    .filter(p => p.kind === 'luxury')
    .map(p => {
      const a = p.assetId ? s.assets.find(x => x.id === p.assetId) : null;
      return {
        assetId: p.assetId,
        name: p.title,
        cost: fromCents(p.price),
        resale: a && isActive(a) ? fromCents(assetValue(s, a)) : 0,
        rep: p.rep || 0,
        category: p.group,
        borrowed: p.borrowed > 0,
      };
    });
}
