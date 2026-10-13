import { STARTING_TIERS } from '../rules/finance';

// Opening die -> NIL tier and base capital, from rules/config/finance.json.
// The $2,500 scholarship is added on top once at the start and is not taxable income.
const tiers = Object.fromEntries(
  STARTING_TIERS.map(t => [t.die, { label: t.name, amount: t.capital_cents / 100 }])
);

export default tiers;
