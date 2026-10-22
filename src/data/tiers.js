import nilTiers from '../rules/config/nil_tiers.json';

// Opening die -> NIL tier (rules/config/nil_tiers.json, BOB-NIL-RESET-2026-01).
// `annualValuation` is the approved annual NIL valuation: a tier value, never wallet cash.
// `amount` is the opening capital still posted at setup (legacy rule, pending the new policy);
// the $2,500 scholarship is added on top once and is not taxable income.
const tiers = Object.fromEntries(
  nilTiers.tiers.map(t => [
    t.roll,
    { id: t.roll, label: t.label, amount: t.legacy_opening_capital_cents / 100, annualValuation: t.annual_nil_valuation_cents / 100 },
  ])
);

export const NIL_VALUATION_HELP = nilTiers.help_text;

export default tiers;
