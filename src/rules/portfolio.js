// Shared portfolio and final game value (Master spec: "Cash accounts and the portfolio").
//
// Financial wealth = Available Cash + Tax Bucket + owned investment/contract values
//   + luxury resale - ordinary debt - policy debt - unpaid taxes - other recorded liabilities.
// Final game value = financial wealth + REP x $2,500 + Career x $5,000 + final credit bonus.
// No winner is declared; past curveball losses already in cash are not subtracted again.
import { band, REP_VALUE_CENTS, CAREER_VALUE_CENTS, OPENING_CREDIT_SCORE } from './finance';
import { toCents } from './money';

export function scoreBreakdown({
  cash = 0,
  taxBucket = 0,
  assetsValue = 0,
  luxuryResale = 0,
  ordinaryDebt = 0,
  policyDebt = 0,
  taxesOwed = 0,
  otherLiabilities = 0,
  rep = 0,
  career = 0,
  creditScore = OPENING_CREDIT_SCORE,
}) {
  const financialWealth =
    cash + taxBucket + assetsValue + luxuryResale - ordinaryDebt - policyDebt - taxesOwed - otherLiabilities;
  const repValue = rep * REP_VALUE_CENTS;
  const careerValue = career * CAREER_VALUE_CENTS;
  const creditBonus = band(creditScore).creditBonus;
  return {
    cash,
    taxBucket,
    assetsValue,
    luxuryResale,
    ordinaryDebt,
    policyDebt,
    taxesOwed,
    otherLiabilities,
    financialWealth,
    repValue,
    careerValue,
    creditBonus,
    gameValue: financialWealth + repValue + careerValue + creditBonus,
  };
}

/** Totals (in cents) from the legacy dollar-shaped investment and luxury records. */
export function holdingsTotals(investments = [], luxuries = []) {
  const inv = Array.isArray(investments) ? investments : [];
  const lux = Array.isArray(luxuries) ? luxuries : [];
  return {
    assetsValue: inv.reduce((t, i) => t + toCents(i.newValue || 0), 0),
    luxuryResale: lux.reduce((t, l) => t + toCents(l.resale || 0), 0),
    policyDebt: inv.reduce((t, i) => t + toCents(i.outstandingLoans || 0), 0),
  };
}

const parseList = v => {
  if (Array.isArray(v)) return v;
  if (typeof v === 'string') {
    try {
      const x = JSON.parse(v || '[]');
      return Array.isArray(x) ? x : [];
    } catch (e) {
      return [];
    }
  }
  return [];
};

/**
 * Game value (in cents) for a synced multiplayer row. Rows carry dollars:
 * `cash` = Available Cash + Tax Bucket, `debt` = ordinary debt + unpaid taxes.
 */
export function rowGameValue(row = {}) {
  const t = holdingsTotals(parseList(row.investments), parseList(row.luxuries));
  const score = Number(row.credit);
  return scoreBreakdown({
    cash: toCents(row.cash || 0),
    ...t,
    ordinaryDebt: toCents(row.debt || 0),
    otherLiabilities: toCents(row.shadyDebt || 0),
    rep: row.rep || 0,
    career: row.career || 0,
    creditScore: score >= 300 && score <= 850 ? score : OPENING_CREDIT_SCORE,
  }).gameValue;
}
