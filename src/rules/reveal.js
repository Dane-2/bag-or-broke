// Final reveal: evidence-based playstyle patterns (R_REVEAL_001, config/archetypes.json).
// Port of bobupdates/engine_reveal.py classify(). Profiles come from recorded choices only:
// no cash total, net worth, die result or bad luck enters the fit. Assigning a profile has no
// financial effect.
import archetypes from './config/archetypes.json';

export const PROFILES = archetypes.profiles;
export const DIMENSIONS = archetypes.dimensions;

export const DIMENSION_LABELS = {
  investment: 'Investing when you could',
  planning: 'Preparing before acting',
  development: 'Career development',
  community: 'Community participation',
  follow_through: 'Following through',
  risk_appetite: 'Risk level chosen',
  luxury: 'Lifestyle purchases when offered',
  purposeful_promotion: 'Using support you had',
  recovery: 'Choosing a recovery step',
  avoidable_overextension: 'New commitments while bills were due',
  avoidable_nonpayment: 'Leaving bills unpaid with cash on hand',
};

/** Pattern descriptions: actions in this game, not personality traits. */
export const PROFILE_COPY = {
  'I-L-A-R': 'You invested when options were open, prepared before big moves, and finished what you started.',
  'I-L-C-R': 'You took part in community work, kept developing your career, and followed through.',
  'S-N-A-R': 'You often chose lifestyle purchases and moved ahead without extra preparation or follow-up.',
  'I-N-A-V': 'You invested often, picked higher-risk options, and mostly kept your commitments.',
  'S-L-C-V': 'You faced real setbacks and repeatedly chose recovery steps while keeping commitments.',
  'I-L-A-C': 'You balanced investing and career growth, prepared ahead, and followed through.',
  'S-N-C-V': 'You leaned into lifestyle purchases while passing on investing and career options you could take.',
  'S-N-A-V': 'You took on new commitments while bills were due and left payable bills unpaid, without choosing recovery.',
};

/** Curveball responses as evidence: [dimension, outcome] pairs per card and choice. */
export const RESPONSE_EVIDENCE = {
  R01: { reconcile: [['planning', 'review_or_prepare']], professional: [['planning', 'review_or_prepare']], continue: [['planning', 'proceed_without_optional_preparation']] },
  R03: { settle: [['recovery', 'complete_recovery']], defer: [['recovery', 'choose_feasible_recovery']], challenge: [['risk_appetite', 'choose_high']] },
  R04: { report: [['recovery', 'choose_feasible_recovery']], recover: [['recovery', 'complete_recovery']] },
  R10: { official: [['recovery', 'choose_feasible_recovery']], specialist: [['recovery', 'complete_recovery']], backup: [['recovery', 'complete_recovery']] },
  R11: { keep: [['planning', 'proceed_without_optional_preparation']], renegotiate: [['recovery', 'choose_feasible_recovery']], return: [['recovery', 'complete_recovery']] },
  R13: { resolve: [['recovery', 'complete_recovery']], defer: [['recovery', 'choose_feasible_recovery']], defend: [['risk_appetite', 'choose_high']] },
  R14: { review: [['planning', 'review_or_prepare']], continue: [['planning', 'proceed_without_optional_preparation']] },
  R15: { pay: [['planning', 'review_or_prepare']], sell: [['planning', 'review_or_prepare']], continue: [['planning', 'proceed_without_optional_preparation']] },
  R18: { network: [['recovery', 'choose_feasible_recovery']], adjust: [['planning', 'review_or_prepare']] },
  R19: { keep: [['planning', 'proceed_without_optional_preparation']], buyout: [['recovery', 'complete_recovery']], review: [['recovery', 'choose_feasible_recovery']] },
  R20: { wait: [['planning', 'proceed_without_optional_preparation']], release: [['recovery', 'complete_recovery']], challenge: [['risk_appetite', 'choose_high']] },
  R21: { pay: [['planning', 'proceed_without_optional_preparation']], mediate: [['recovery', 'choose_feasible_recovery']], perform: [['recovery', 'choose_feasible_recovery']] },
  R02: { wait: [['planning', 'proceed_without_optional_preparation']], expedite: [['recovery', 'complete_recovery']] },
  R05: { reduce: [['recovery', 'choose_feasible_recovery']], cover: [['recovery', 'complete_recovery']], delay: [['planning', 'review_or_prepare']] },
  R06: { correct: [['recovery', 'choose_feasible_recovery']], replace: [['recovery', 'complete_recovery']] },
  R07: { test: [['recovery', 'choose_feasible_recovery']], pause: [['planning', 'review_or_prepare']] },
  R08: { repair: [['recovery', 'complete_recovery']], substitute: [['recovery', 'choose_feasible_recovery']] },
  R09: { replace: [['recovery', 'complete_recovery']], reschedule: [['follow_through', 'agreed_reschedule']], cancel: [['follow_through', 'communicated_withdrawal']] },
  R12: { fulfill: [['follow_through', 'complete']], limit: [['follow_through', 'communicated_withdrawal']], extend: [['follow_through', 'agreed_reschedule']] },
  R16: { reserve: [['planning', 'review_or_prepare']], later: [['planning', 'proceed_without_optional_preparation']] },
  R17: { restrict: [['recovery', 'choose_feasible_recovery']], recover: [['recovery', 'complete_recovery']] },
  B07: { tutor: [['recovery', 'complete_recovery']], restructure: [['recovery', 'complete_recovery']], keep: [['recovery', 'decline_feasible_recovery']] },
  B01: { feedback: [['recovery', 'choose_feasible_recovery']], prepare: [['planning', 'review_or_prepare']], post: [['recovery', 'decline_feasible_recovery']] },
  B02: { report: [['planning', 'review_or_prepare']], support: [['planning', 'review_or_prepare']], hide: [['planning', 'proceed_without_optional_preparation'], ['risk_appetite', 'choose_high']] },
  B03: { one: [['risk_appetite', 'choose_moderate']], bundle: [['risk_appetite', 'choose_high']], decline: [['risk_appetite', 'choose_low']] },
  B04: { report: [['recovery', 'choose_feasible_recovery']], pause: [['planning', 'review_or_prepare']], retaliate: [['recovery', 'decline_feasible_recovery']] },
  B05: { stay: [['planning', 'review_or_prepare']], gather: [['planning', 'review_or_prepare']], enter: [['planning', 'proceed_without_optional_preparation'], ['risk_appetite', 'choose_high']] },
  B06: { ask: [['follow_through', 'agreed_reschedule']], release: [['follow_through', 'communicated_withdrawal']] },
  B08: { coordinate: [['community', 'participate']], travel: [['community', 'participate']], limit: [['planning', 'review_or_prepare']] },
  B09: { clarify: [['planning', 'review_or_prepare']], support: [['community', 'participate']], pileon: [['community', 'decline']] },
  B10: { plan: [['planning', 'review_or_prepare']], share: [['planning', 'review_or_prepare']], postpone: [['planning', 'proceed_without_optional_preparation']] },
  B11: { boundaries: [['planning', 'review_or_prepare']], temporary: [['recovery', 'complete_recovery']], support: [['recovery', 'choose_feasible_recovery']] },
  B12: { reduce: [['follow_through', 'communicated_withdrawal']], keep: [['avoidable_overextension', 'commit_despite_displaced_due_obligation']] },
  B13: { recover: [['recovery', 'complete_recovery']], career: [['recovery', 'choose_feasible_recovery']], pause: [['recovery', 'choose_feasible_recovery']] },
};

/** Curveballs that are setbacks outside the player's control. */
export const EXTERNAL_SETBACKS = ['R02', 'R05', 'R06', 'R07', 'R08', 'R09', 'R12', 'R17', 'R03', 'R04', 'R10', 'R11', 'R13', 'R14', 'R18', 'R19', 'R20', 'R21', 'B01', 'B02', 'B04', 'B05', 'B08', 'B10', 'B13'];

/** Risk level of an investment entry for risk_appetite. */
export function riskOutcome(entry) {
  if (['crypto', 'stocks', 'house_locked'].includes(entry.profile)) return 'choose_high';
  if (['business_bounded', 'property_bounded', 'fund'].includes(entry.profile)) return 'choose_moderate';
  return 'choose_low';
}

/** classify(observations, setbacks) — same gates, fits and result states as the reference. */
export function classify(observations, setbacks = []) {
  const byKey = new Map();
  observations.forEach(event => {
    const dims = DIMENSIONS[event.dimension];
    if (!dims || dims[event.outcome] === undefined) throw new Error('Unknown observation dimension or outcome');
    if (!event.actionable || !event.choice_exposed || event.forced || event.reversed || event.cause === 'chance_only') return;
    const key = `${event.opportunity_id}|${event.dimension}`;
    const old = byKey.get(key);
    if (old) {
      if (old.outcome !== event.outcome || old.event_id !== event.event_id) throw new Error('Conflicting evidence for one opportunity and dimension');
      return;
    }
    byKey.set(key, event);
  });

  const metrics = {};
  const eventIds = new Set();
  byKey.forEach(event => {
    const m = metrics[event.dimension] || (metrics[event.dimension] = { n: 0, sum: 0, eventIds: [] });
    m.n += 1;
    m.sum += DIMENSIONS[event.dimension][event.outcome];
    m.eventIds.push(event.event_id);
    eventIds.add(event.event_id);
  });
  Object.values(metrics).forEach(m => {
    m.mean = m.sum / m.n;
    delete m.sum;
  });

  const external = [...new Set(setbacks.filter(s => s.external && s.adverse && s.committed && !s.reversed).map(s => s.event_id))];
  const result = {
    state: 'insufficient_evidence',
    profiles: [],
    metrics,
    uniqueChoiceEvents: eventIds.size,
    externalSetbacks: external,
    evidenceStrength: 'insufficient',
    financialEffect: 0,
  };
  if (eventIds.size < archetypes.minimum_unique_choice_events || Object.keys(metrics).length < archetypes.minimum_observed_dimensions) {
    return result;
  }

  const candidates = [];
  PROFILES.forEach(profile => {
    if (external.length < profile.min_external_setbacks) return;
    const gatesPass = profile.gates.every(g => {
      const m = metrics[g.dimension];
      if (!m || m.n < g.min_observations) return false;
      const c = m.mean - g.threshold;
      return g.operator === 'gte' ? c >= -1e-12 : c <= 1e-12;
    });
    if (!gatesPass) return;
    let num = 0;
    let den = 0;
    const evidence = new Set();
    Object.entries(profile.target_weights).forEach(([dim, t]) => {
      const m = metrics[dim];
      if (!m) return;
      num += t.weight * (1 - Math.abs(m.mean - t.target));
      den += t.weight;
      m.eventIds.forEach(id => evidence.add(id));
    });
    const fit = num / den;
    if (fit + 1e-12 >= archetypes.minimum_candidate_fit) {
      candidates.push({ code: profile.code, name: profile.name, character: profile.illustrative_character, fit, evidenceEventIds: [...evidence].sort() });
    }
  });
  candidates.sort((a, b) => b.fit - a.fit || (a.code < b.code ? -1 : 1));
  result.evidenceStrength = eventIds.size >= archetypes.high_confidence_unique_events ? 'supported' : 'emerging';
  if (!candidates.length) {
    result.state = 'unclassified';
    return result;
  }
  const near = candidates.filter(c => candidates[0].fit - c.fit < archetypes.mixed_margin - 1e-12);
  result.state = near.length > 1 ? 'mixed' : 'single';
  result.profiles = near.length > 1 ? near.slice(0, 2) : candidates.slice(0, 1);
  result.allQualifying = candidates;
  return result;
}

/** Headline name for the reveal state. */
export function revealTitle(result) {
  if (result.state === 'single') return result.profiles[0].name;
  if (result.state === 'mixed') return result.profiles.map(p => p.name).join(' + ');
  if (result.state === 'unclassified') return 'Mixed approach';
  return 'Not enough evidence for a clear pattern';
}

/** One option to explore next time: the measured dimension furthest from a balanced choice. */
export function nextTimeSuggestion(result) {
  const m = result.metrics;
  if (m.avoidable_nonpayment && m.avoidable_nonpayment.mean > 0.5) return 'Next time, try paying required bills before your roll when you have the cash.';
  if (m.follow_through && m.follow_through.mean < 0.5) return 'Next time, try taking fewer optional tasks and finishing the ones you accept.';
  if (m.planning && m.planning.mean < 0.5) return 'Next time, try reviewing your options (or setting aside taxes) before a big move.';
  if (!m.investment || m.investment.mean < 0.5) return 'Next time, try using a green landing you can afford to start an investment.';
  if (!m.development || m.development.mean < 0.5) return 'Next time, try completing a purple career activity in a field you like.';
  if (m.risk_appetite && m.risk_appetite.mean > 0.75) return 'Next time, try mixing in a lower-risk holding next to the high-risk ones.';
  return 'Next time, try a different career path or investment house and compare how it plays.';
}
