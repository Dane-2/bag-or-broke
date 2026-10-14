// Red financial and blue lifestyle curveballs (Packet 4), from config/scenarios.json.
// A scenario is drawn only when every eligibility record exists and every effect it can
// produce has a handler here; others stay disabled (the packet's release gate).
import scenariosConfig from './config/scenarios.json';
import corePolicy from './config/core.json';
import { isActive, assetValue } from './holdings';
import { openTaskSlots, TASK_SLOTS } from './nil';
import authored from './config/authored_producers.json';

export const CURVEBALLS = scenariosConfig.scenarios.filter(s => s.color === 'red' || s.color === 'blue');
export const PORTAL = scenariosConfig.portal;
export const curveball = id => CURVEBALLS.find(c => c.id === id) || null;

/** Scenarios whose source records this version cannot produce yet (none: see authored_producers.json). */
export const DISABLED = {};

export const AUTHORED = authored;
export const AUTHORED_SCENARIOS = Object.values(authored).flatMap(x => (x && x.scenarios) || []);

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

const byAcquired = (a, b) => a.acquiredAt - b.acquiredAt || (a.id < b.id ? -1 : 1);
const liveRoots = s => s.assets
  .filter(a => isActive(a) && (a.holding === 'growth' || a.holding === 'market') && assetValue(s, a) > 0)
  .sort(byAcquired);
const openOrder = s => (s.inventoryOrders || []).find(o => o.openUntil >= s.turn && liveRoots(s).some(a => a.id === o.targetId));
const openPrepay = s => (s.prepayments || []).find(p => p.unearned > 0 && liveRoots(s).some(a => a.id === p.targetId));
const openBooking = s => (s.bookings || []).find(b => b.deposit > 0 && s.assets.some(a => a.id === b.serviceId && isActive(a)));
const openContribution = s => (s.npcContributions || []).find(c => !c.satisfied && c.overdueUntilTurn >= s.turn && liveRoots(s).some(a => a.id === c.assetId));
const dueReceivable = s => (s.receivables || []).filter(r => r.amount > 0).sort((a, b) => a.dueTurn - b.dueTurn)[0];
const openPerk = s => (s.perks || []).find(p => !p.taxRecorded);

/**
 * The record a scenario acts on: { targetId, recordId }. Company scenarios use the earliest
 * acquired eligible holding (or the holding tied to the record), never the costliest.
 */
export function scenarioRecord(s, card) {
  const roots = liveRoots(s);
  switch (card.id) {
    case 'R10':
      return { targetId: roots.find(a => (a.exposure || []).includes('platform_dependency'))?.id || null };
    case 'R08':
      return { targetId: roots.find(a => (a.exposure || []).includes('operating_business') && (a.exposure || []).includes('equipment'))?.id || null };
    case 'R06':
    case 'R07': {
      const o = openOrder(s);
      return o ? { targetId: o.targetId, recordId: o.id } : { targetId: null };
    }
    case 'R12': {
      const p = openPrepay(s);
      return p ? { targetId: p.targetId, recordId: p.id } : { targetId: null };
    }
    case 'R05': {
      const c = openContribution(s);
      return c ? { targetId: c.assetId, recordId: c.id } : { targetId: null };
    }
    case 'R09': {
      const b = openBooking(s);
      return b ? { targetId: null, recordId: b.id } : { targetId: null };
    }
    case 'R02': {
      const r = dueReceivable(s);
      return r ? { targetId: null, recordId: r.id } : { targetId: null };
    }
    case 'R16': {
      const p = openPerk(s);
      return p ? { targetId: null, recordId: p.id } : { targetId: null };
    }
    default:
      return { targetId: null };
  }
}

export function scenarioTarget(s, card) {
  const id = scenarioRecord(s, card).targetId;
  return id ? s.assets.find(a => a.id === id) : null;
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
    case 'operating_business':
    case 'equipment_exposure':
      return Boolean(scenarioTarget(s, card));
    // Authored record producers (config/authored_producers.json)
    case 'earned_receivable_scheduled_within_two_turns':
      return (s.receivables || []).some(r => r.amount > 0 && r.dueTurn <= s.turn + 2);
    case 'unsettled_receivable':
      return (s.receivables || []).some(r => r.amount > 0);
    case 'recorded_academic_risk':
      return Boolean(s.academicRisk);
    case 'owned_merchandise_venture':
    case 'recorded_inventory_order':
      return Boolean(openOrder(s)) && Boolean(scenarioTarget(s, card)) && (scenarioTarget(s, card).exposure || []).includes('inventory');
    case 'recorded_poor_promotion_result':
      return Boolean(openOrder(s) && openOrder(s).poor);
    case 'owned_inventory_venture':
      return Boolean(scenarioTarget(s, card));
    case 'inventory_unsold_value_positive':
      return Boolean(openOrder(s) && openOrder(s).unsold > 0);
    case 'recorded_successful_campaign':
    case 'paid_orders_exceed_capacity':
    case 'unearned_customer_prepayments_positive':
      return Boolean(openPrepay(s));
    case 'paid_event_booking':
    case 'active_uncompleted_event':
      return Boolean(openBooking(s));
    case 'shared_operating_venture':
    case 'recorded_partner_contribution_overdue':
    case 'recorded_shortfall_positive':
      return Boolean(openContribution(s));
    case 'active_recorded_representative_relationship':
      return s.assets.some(a => isActive(a) && a.holding === 'representative');
    case 'received_authored_taxable_perk':
    case 'perk_not_yet_tax_recorded':
      return Boolean(openPerk(s));
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
    case 'can_afford_full_shortfall': {
      const c = (s.npcContributions || []).find(x => !x.satisfied && x.overdueUntilTurn >= s.turn);
      return Boolean(c) && s.cash >= c.shortfall;
    }
    case 'can_afford_perk_tax_estimate': {
      const p = (s.perks || []).find(x => !x.taxRecorded);
      return Boolean(p) && s.cash >= Math.round(p.value * 0.2);
    }
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
  operating_remediation: 'Replacement order',
  equipment_repair: 'Equipment repair',
  event_operating_cost: 'Replacement venue',
  operating_expense: 'Operating cost',
  unauthorized_transfer: 'Money moved without permission',
  customer_refund: 'Customer refunds',
  income_share: 'Advance minimum repayment',
  uncovered_living_support: 'Living support',
  transfer_move: 'Moving cost',
};

export const BUSINESS_COMPONENTS = ['website_platform_remediation', 'operating_remediation', 'equipment_repair', 'operating_expense', 'event_operating_cost'];
export const LOSS_COMPONENTS = ['scam_loss', 'unauthorized_transfer'];
