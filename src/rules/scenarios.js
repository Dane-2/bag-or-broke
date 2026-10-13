// Red financial and blue lifestyle curveballs (Packet 4), from config/scenarios.json.
// A scenario is drawn only when every eligibility record exists and every effect it can
// produce has a handler here; others stay disabled (the packet's release gate).
import scenariosConfig from './config/scenarios.json';
import corePolicy from './config/core.json';
import { isActive, assetValue } from './holdings';
import { openTaskSlots, TASK_SLOTS } from './nil';

export const CURVEBALLS = scenariosConfig.scenarios.filter(s => s.color === 'red' || s.color === 'blue');
export const PORTAL = scenariosConfig.portal;
export const curveball = id => CURVEBALLS.find(c => c.id === id) || null;

/** Scenarios whose source records this version cannot produce yet. */
export const DISABLED = {
  R02: 'needs unpaid sponsor invoices',
  R05: 'needs shared ventures with partner contributions',
  R06: 'needs merchandise order records',
  R07: 'needs campaign inventory records',
  R08: 'no business carries an equipment record',
  R09: 'needs paid event bookings',
  R12: 'needs customer prepayment records',
  R16: 'needs a deferred-tax perk producer',
  R17: 'needs a representative contract',
  B07: 'needs an academic review task',
};

const ATHLETIC_HORIZON_LAPS = corePolicy.timeline.athletic_horizon_laps;
const HOSTED = ['LX16', 'LX17', 'LX20', 'LX45', 'LX31', 'LX32', 'LX35', 'YSH_CLINIC', 'I12'];
const SPONSOR_CARDS = ['Y01', 'Y04', 'Y05', 'Y06', 'Y07', 'Y10'];

export const RESTRICTION_LABELS = {
  new_nil_contract: 'No new NIL contracts',
  new_overlapping_sponsor_contract: 'No overlapping sponsor deals (agency clause)',
  new_brand_collaboration: 'No new brand collaborations',
  new_optional_social_campaign: 'No new optional social campaigns',
  new_optional_task: 'No new optional tasks',
  sport_appearance: 'Not playing in games',
};

export const activeRestrictions = s => s.restrictions.filter(r => r.untilTurn >= s.turn);
export const restricted = (s, kind) => activeRestrictions(s).some(r => r.kind === kind);

export const athleteActive = s => Math.floor(s.progress / s.boardSize) < ATHLETIC_HORIZON_LAPS;
const activeSponsor = s => s.sponsorRelations.some(r => r.expiresTurn >= s.turn);
const openPayables = s => s.payables.filter(p => p.amount > 0);
const healthIncidentOpen = s => s.healthIncidentUntil >= s.turn;

/** Earliest acquired eligible holding for a company-targeted scenario. */
export function scenarioTarget(s, card) {
  const roots = s.assets
    .filter(a => isActive(a) && (a.holding === 'growth' || a.holding === 'market') && assetValue(s, a) > 0)
    .sort((a, b) => a.acquiredAt - b.acquiredAt || (a.id < b.id ? -1 : 1));
  if (card.id === 'R10') return roots.find(a => (a.exposure || []).includes('platform_dependency')) || null;
  return null;
}

export const optionalTasks = s => s.tasks.filter(t => t.status === 'open' && !t.mandatory);

export function predicate(s, name, card) {
  switch (name) {
    case 'public_nil_profile':
    case 'fictional_family_context':
    case 'public_social_context':
    case 'adult_fictional_profile':
    case 'appropriate_family_context':
    case 'recorded_shared_housing':
    case 'active_athlete_or_nil_creator':
    case 'renewal_not_guaranteed':
      return true;
    case 'family_expansion_content_enabled':
      return s.settings.familyExpansionContent !== false;
    case 'active_athlete':
    case 'active_public_athlete':
    case 'remaining_athletic_laps_positive':
      return athleteActive(s);
    case 'phase_college_sim':
      return athleteActive(s);
    case 'available_cash_at_least_5000':
      return s.cash >= 500000;
    case 'has_closed_tax_period':
      return s.taxBills.length > 0;
    case 'active_signed_nil_contract':
    case 'active_nil_contract':
      return activeSponsor(s) || s.tasks.some(t => t.status === 'open' && SPONSOR_CARDS.includes(t.cardId));
    case 'no_open_same_contract_dispute':
      return !openPayables(s).some(p => ['R03', 'R21'].includes(p.cardId));
    case 'recorded_hosted_event_or_personal_liability_exposure':
      return s.purchases.some(p => HOSTED.includes(p.entryId)) ||
        s.assets.some(a => isActive(a) && (a.exposure || []).includes('rental_property'));
    case 'no_open_same_incident_claim':
      return !openPayables(s).some(p => p.cardId === 'R13');
    case 'owns_qualifying_market_exposure':
      return s.assets.some(a => isActive(a) && a.holding === 'market' && a.value > 0 &&
        ((a.exposure || []).includes('tradable_equity') || (a.exposure || []).includes('crypto')));
    case 'unsecured_debt_positive':
      return s.loans.some(l => l.kind === 'unsecured' && l.principal > 0);
    case 'existing_credit_capacity_or_hold_changed':
      return s.creditChangedTurn !== null && s.turn - s.creditChangedTurn <= 4;
    case 'recorded_nil_contract_expiring':
      return s.sponsorRelations.some(r => r.expiresTurn >= s.turn && r.expiresTurn <= s.turn + 1 && !r.closed);
    case 'no_open_income_share_claim':
      return !s.incomeShare;
    case 'no_open_agency_lock':
      return !restricted(s, 'new_overlapping_sponsor_contract');
    case 'no_open_advance_contract':
      return !openPayables(s).some(p => p.component === 'advance_contract');
    case 'no_open_health_incident':
      return !healthIncidentOpen(s);
    case 'not_currently_restricted_sport_appearance':
      return !restricted(s, 'sport_appearance');
    case 'no_open_transfer_process':
      return !s.portal;
    case 'recorded_career_or_business_task_due_next_turn':
      return s.tasks.some(t => t.status === 'open' && !t.mandatory && t.dueTurn === s.turn + 1);
    case 'commitment_slots_above_capacity':
      return openTaskSlots(s) > TASK_SLOTS;
    case 'platform_dependent_venture':
    case 'company_value_positive':
      return Boolean(scenarioTarget(s, card));
    default:
      return false;
  }
}

/** Eligible scenarios of one color (eligibility, cooldown, per-game limit, enabled handlers). */
export function eligibleCurveballs(s, color) {
  return CURVEBALLS.filter(card => {
    if (card.color !== color || DISABLED[card.id] || !card.enabled_in_recommended_preview) return false;
    const stats = s.scenarioStats[card.id];
    if (stats && stats.count >= card.repeat_limit_per_game) return false;
    if (stats && s.turn - stats.lastTurn < card.cooldown_own_turns) return false;
    return card.eligible_all.every(p => predicate(s, p, card));
  });
}

/** Can the player pick this response right now (before any cash check)? */
export function requirementMet(s, name, target) {
  switch (name) {
    case 'capacity_for_one_task':
      return !restricted(s, 'new_optional_task') && openTaskSlots(s) + 1 <= TASK_SLOTS;
    case 'capacity_for_two_tasks':
      return !restricted(s, 'new_optional_task') && openTaskSlots(s) + 2 <= TASK_SLOTS;
    case 'has_optional_task':
      return optionalTasks(s).length > 0;
    case 'authorized_company_operator':
      return Boolean(target) && (target.ownershipBps ?? 10000) === 10000;
    case 'can_afford_2500':
      return s.cash >= 250000;
    case 'can_afford_10000':
      return s.cash >= 1000000;
    case 'can_afford_25000':
      return s.cash >= 2500000;
    // Checked against the full quote at confirmation.
    case 'can_afford_net_quoted_service':
    case 'can_afford_net_quoted_total':
      return true;
    // No producer in this version.
    default:
      return false;
  }
}

const RISKY = new Set(['expense', 'pay_existing_payable', 'resolve_table', 'task', 'start_transfer_process', 'mandatory_commitment', 'settle_income_share']);

/** The cost-free branch applied if the player moves on without answering. */
export function defaultResponse(card) {
  const safe = card.choices.find(c =>
    c.requires.length === 0 &&
    !c.effects.some(e => RISKY.has(e.op) || (e.op === 'rep_delta' && e.points < 0))
  );
  return (safe || card.choices.find(c => c.requires.length === 0) || card.choices[0]).id;
}

/** Plain-language copy for the scenario screen. */
export const COMPONENT_LABELS = {
  eligible_legal_fee: 'Legal fees',
  settlement: 'Settlement',
  scam_loss: 'Money taken in the scam',
  health_expense: 'Health expense',
  family_support_expense: 'Family support',
  family_travel: 'Travel',
  personal_housing: 'Temporary room',
  website_platform_remediation: 'Technical recovery',
  contract_exit: 'Contract exit',
  advance_contract: 'Advance repayment',
  uncovered_living_support: 'Living support',
  transfer_move: 'Moving cost',
};

export const BUSINESS_COMPONENTS = ['website_platform_remediation', 'operating_remediation', 'equipment_repair', 'operating_expense', 'event_operating_cost'];
export const LOSS_COMPONENTS = ['scam_loss', 'unauthorized_transfer'];
