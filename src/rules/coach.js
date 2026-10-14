// "What Would Coach J-Bo Do?" — rules-based advice (scenarios.json coach contract).
// Advice uses only what the player can already see: quotes, published die tables, bills due,
// task slots and owned records. It never reads a stored roll, changes odds or rewards obedience.
import scenariosConfig from './config/scenarios.json';
import { curveball, requirementMet } from './scenarios';
import { yellowCard, yellowChoices, openTaskSlots, TASK_SLOTS } from './nil';
import { family, PATHS, pathAllowed, pathForGroup } from './career';
import { catalogEntry } from './catalog';
import { isActive } from './holdings';
import { formatCents } from './money';

export const COACH = scenariosConfig.coach;
export const STARTING_CREDITS = COACH.starting_credits;

/** Expected cash cost of a published die table (equal faces), from its visible amounts. */
function tableExpectedCost(table) {
  const faces = Object.values(table.die_faces);
  const total = faces.reduce((t, effects) => t + effects.reduce((x, e) => {
    if ((e.op === 'event_payable' || e.op === 'expense') && e.amount && e.amount.fixed_cents !== undefined) return x + e.amount.fixed_cents;
    return x;
  }, 0), 0);
  return Math.round(total / faces.length);
}

function obligationsDue(s, dueNow) {
  return typeof dueNow === 'function' ? dueNow(s) : 0;
}

/**
 * Advice for a pending curveball. `quote(choiceId)` is the same quote the screen shows.
 * Returns { recommendation, reasons, tradeoff, alternative }.
 */
export function adviseScenario(s, quote, due) {
  const sc = s.scenario;
  const card = curveball(sc.cardId);
  const target = sc.targetId ? s.assets.find(a => a.id === sc.targetId) : null;
  const dueBefore = obligationsDue(s, due);
  const options = card.choices
    .filter(c => c.requires.every(r => requirementMet(s, r, target)))
    .map(c => {
      const q = quote(c.id);
      if (!q.available) return null;
      const table = c.effects.find(e => e.op === 'resolve_table');
      const expectedTable = table ? tableExpectedCost(card.chance[table.table]) : 0;
      const bills = q.newBills.reduce((t, b) => t + b.amount, 0);
      const cost = -q.cashDelta + bills + expectedTable;
      const repLoss = c.effects.some(e => e.op === 'rep_delta' && e.points < 0);
      const squeezes = s.cash + q.cashDelta < dueBefore;
      // Lower expected cost wins; harmful REP choices and responses that leave bills unpayable are penalized.
      const score = cost + (repLoss ? 10000000 : 0) + (squeezes ? 2000000 : 0) + (table ? 100000 : 0);
      return { choice: c, q, cost, bills, table: Boolean(table), expectedTable, repLoss, squeezes, score };
    })
    .filter(Boolean)
    .sort((a, b) => a.score - b.score);
  if (!options.length) return null;
  const best = options[0];
  const alt = options[1];
  const reasons = [];
  reasons.push(best.cost > 0 ? `Expected total cost about ${formatCents(best.cost)} (cash now plus any bill${best.table ? ', using the published die table' : ''}).` : 'It costs no cash.');
  if (best.q.assistance > 0) reasons.push(`Your support pays ${formatCents(best.q.assistance)} of it.`);
  if (dueBefore > 0) reasons.push(best.squeezes ? `Careful: you still owe ${formatCents(dueBefore)} before your next roll.` : `You keep enough cash for the ${formatCents(dueBefore)} due before your next roll.`);
  let tradeoff = 'No extra downside beyond its cost.';
  if (best.bills > 0) tradeoff = `It leaves a ${formatCents(best.bills)} bill to pay later.`;
  else if (best.table) tradeoff = 'The result depends on a die roll, so it can cost more or less than expected.';
  else if (best.choice.effects.some(e => e.op === 'task')) tradeoff = 'It takes a task slot next turn.';
  return {
    recommendation: best.choice.label,
    choiceId: best.choice.id,
    reasons,
    tradeoff,
    alternative: alt ? `${alt.choice.label} (expected cost about ${formatCents(alt.cost)})` : null,
  };
}

export function adviseYellow(s) {
  const y = s.yellow;
  const card = yellowCard(y.cardId);
  const choices = yellowChoices(s, card);
  const used = openTaskSlots(s);
  if (card.id === 'Y12') {
    const use = choices.find(c => c.id === 'use');
    const tax = 600000;
    const ok = s.cash >= tax;
    return {
      recommendation: ok ? use.label : choices.find(c => c.id === 'decline').label,
      choiceId: ok ? 'use' : 'decline',
      reasons: [ok ? 'You have cash to cover the estimated $6,000 game tax.' : 'The shoot adds about $6,000 of tax and your cash is tight.'],
      tradeoff: ok ? 'No cash comes in; it only adds taxable income.' : 'You skip a free service.',
      alternative: ok ? 'Decline it and owe nothing.' : 'Accept it if you expect more cash before the tax is due.',
    };
  }
  const extra = choices.find(c => c.task && c.available);
  const base = choices.find(c => !c.task);
  if (extra && used < TASK_SLOTS - 1) {
    return {
      recommendation: extra.label,
      choiceId: extra.id,
      reasons: [`Completing it next turn adds ${formatCents(extra.reward)}, and declining later costs nothing.`, `You are using ${used} of ${TASK_SLOTS} task slots.`],
      tradeoff: 'You need to tap Complete on your next turn or the extra is forgone.',
      alternative: base ? `${base.label} and keep your slots free.` : null,
    };
  }
  return {
    recommendation: base ? base.label : choices[0].label,
    choiceId: base ? base.id : choices[0].id,
    reasons: [extra ? `Your schedule is busy (${used}/${TASK_SLOTS} slots).` : 'The base payment is already yours.'],
    tradeoff: extra ? `You pass on the ${formatCents(extra.reward)} follow-up.` : 'None.',
    alternative: extra ? `${extra.label} if you are sure you can finish it next turn.` : null,
  };
}

export function adviseCareer(s) {
  const offer = s.career.offer;
  const f = family(offer.family);
  const owned = s.assets.filter(a => isActive(a) && a.kind === 'investment')
    .map(a => pathForGroup(catalogEntry(a.cardId)?.group)).filter(Boolean);
  const pick = owned.find(p => pathAllowed(s, f.id, p).ok) ||
    PATHS.map(p => p.id).find(p => pathAllowed(s, f.id, p).ok);
  const pathName = PATHS.find(p => p.id === pick)?.name;
  const reasons = [`${f.name} is worth ${f.id === 'internship' ? '3 REP and 3 Career when you complete it next turn' : `${f.rep} REP and ${f.career} Career`}.`];
  if (owned.includes(pick)) reasons.push(`It matches a business you own, which builds experience in that field${f.id === 'mentoring' ? ' and a promotion focus can make launches "prepared"' : ''}.`);
  if (pick === 'sports_business_management' && f.id === 'mentoring') reasons.push('Sports mentoring also gives a referral discount on the Youth Sports clinic.');
  return {
    recommendation: `Complete it in ${pathName}${f.id === 'mentoring' ? ' with the promotion focus' : ''}`,
    choiceId: pick,
    reasons,
    tradeoff: f.id === 'internship' ? 'It takes your internship slot until next turn.' : 'None; declining has no penalty either.',
    alternative: 'Choose a different field you want to explore; points are the same.',
  };
}

/** Advice on a green or diamond landing. */
export function adviseLanding(s, kind, due) {
  const dueBefore = obligationsDue(s, due);
  if (dueBefore > 0 && s.cash < dueBefore * 2) {
    return {
      recommendation: 'Pay what you owe before buying',
      reasons: [`You owe ${formatCents(dueBefore)} before your next roll and have ${formatCents(s.cash)} available.`],
      tradeoff: 'You may skip this landing\'s purchase.',
      alternative: kind === 'investment' ? 'A small cash-only purchase you can afford after paying.' : 'Skip shopping this turn.',
    };
  }
  if (kind === 'investment') {
    const holdings = s.assets.filter(a => isActive(a) && a.kind === 'investment');
    const risky = holdings.filter(a => ['crypto', 'stocks', 'house_locked'].includes(a.profile)).length;
    const plans = holdings.some(a => a.holding === 'plan');
    if (!plans && s.cash >= 750000) {
      return {
        recommendation: 'Consider Legal Support — Basic ($7,500)',
        reasons: ['Support must be bought before a problem appears; it pays 80% of eligible legal fees.'],
        tradeoff: 'It has no resale or growth value.',
        alternative: 'An owned business you can pay for in cash.',
      };
    }
    return {
      recommendation: risky >= 2 ? 'Balance with a lower-risk holding (bonds, ETFs or a property)' : 'Start or grow an owned business you can afford in cash',
      reasons: [risky >= 2 ? `You already hold ${risky} high-risk positions.` : 'Businesses grow at a rate set by your launch roll; paying cash avoids interest.'],
      tradeoff: 'Every launch roll can also lose value.',
      alternative: 'Pass this landing and keep cash for upcoming bills.',
    };
  }
  return {
    recommendation: dueBefore > 0 ? 'Keep it small or skip' : 'Buy only something you will use',
    reasons: ['Luxury items lose resale value every lap, and REP only comes from delivered work like a media kit or content series.'],
    tradeoff: 'Skipping means no new item this turn.',
    alternative: 'A brand or creator service (LX29/LX30) that can earn REP when delivered.',
  };
}
