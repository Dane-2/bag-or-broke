// Yellow NIL opportunities (Packet 5), built from config/scenarios.json.
// Each card is drawn only when its eligibility can be proven from records the app keeps;
// a missing record fails closed. Base benefits post when drawn and are never clawed back.
import scenariosConfig from './config/scenarios.json';
import corePolicy from './config/core.json';
import { isActive } from './holdings';

export const YELLOW_CARDS = scenariosConfig.scenarios.filter(s => s.color === 'yellow');
export const yellowCard = id => YELLOW_CARDS.find(c => c.id === id) || null;

export const TASK_SLOTS = scenariosConfig.pressure.commitment.capacity_slots; // 3
export const SPONSOR_RELATIONSHIP_TURNS = 3;
const ATHLETIC_HORIZON_LAPS = corePolicy.timeline.athletic_horizon_laps; // 5

/** What the player sees: why it happened, and what kind of benefit it is. */
export const YELLOW_COPY = {
  Y01: { scene: 'A brand saw your content and paid for a collaboration.', benefit: 'Cash received' },
  Y02: { scene: 'A sponsor finally paid part of what it owed you.', benefit: 'Existing payment collected' },
  Y03: { scene: 'You set up an emergency fund for a rough patch.', benefit: 'Protection added' },
  Y04: { scene: 'Your sponsorship deliverables are done and the payment cleared.', benefit: 'Cash received' },
  Y05: { scene: 'Your NIL collective funded a bigger campaign with you.', benefit: 'Cash received' },
  Y06: { scene: 'A local business ran a campaign featuring you.', benefit: 'Cash received' },
  Y07: { scene: 'You were paid to appear at an event.', benefit: 'Cash received' },
  Y08: { scene: 'A company licensed content you own, without buying it.', benefit: 'Business income received' },
  Y09: { scene: 'Your merchandise sold and royalties came in.', benefit: 'Business income received' },
  Y10: { scene: 'A brand you worked with wants you back for a renewal.', benefit: 'Cash received' },
  Y11: { scene: 'Money you lost was traced and returned.', benefit: 'Recovered money' },
  Y12: { scene: 'A sponsor offers to fund a professional photo shoot.', benefit: 'Optional service offered' },
};

/** Legacy curveballs whose loss is a recoverable cash loss for Y11. */
export const RECOVERABLE_LOSSES = ['NIL Contract Scam'];

/** Legacy curveballs that are taxes, debt or value losses: an emergency token cannot pay them. */
export const TOKEN_EXCLUDED = ['Pay Your Taxes', 'IRS Audit', 'Federal Tax Audit', 'Credit Card Debt Hits', 'Market Crash'];

const SPONSOR_BASE_CARDS = ['Y01', 'Y04', 'Y05', 'Y06', 'Y07', 'Y10'];

/** Curveball restrictions and the yellow cards they block while active. */
export const RESTRICTION_BLOCKS = {
  new_nil_contract: SPONSOR_BASE_CARDS,
  new_overlapping_sponsor_contract: SPONSOR_BASE_CARDS,
  new_brand_collaboration: ['Y01', 'Y10'],
};
const activeKinds = s => (s.restrictions || []).filter(r => r.untilTurn >= s.turn).map(r => r.kind);
const blockedYellow = s => new Set(activeKinds(s).flatMap(k => RESTRICTION_BLOCKS[k] || []));
export const createsSponsorRelationship = id => SPONSOR_BASE_CARDS.includes(id);

export const unrecoveredLoss = s => s.losses.reduce((t, l) => t + (l.amount - l.recovered), 0);
export const unusedTokens = s => s.assets.filter(a => isActive(a) && a.holding === 'token' && a.uses > 0).length;
export const openTaskSlots = s => s.tasks.filter(t => t.status === 'open').reduce((t, x) => t + x.slots, 0);
const lapNow = s => Math.min(s.totalLaps, Math.floor(s.progress / s.boardSize) + 1);

/** First owned holding tagged as player-owned IP (education, curriculum, podcast). */
export function licensableContent(s) {
  return s.assets
    .filter(a => isActive(a) && (a.exposure || []).includes('owned_ip'))
    .sort((a, b) => a.acquiredAt - b.acquiredAt)[0] || null;
}

/**
 * Evaluate one eligibility predicate against ledger records. Unknown predicates return false,
 * so a card that needs a record this app does not produce never appears.
 */
export function predicate(s, name) {
  switch (name) {
    // Every player starts with a public NIL profile (producer contract: initial profile).
    case 'brand_collaboration_eligible':
    case 'new_sponsorship_eligible':
    case 'collective_campaign_eligible':
    case 'local_campaign_eligible':
    case 'appearance_eligible':
      return true;
    case 'phase_college_sim':
      return Math.floor(s.progress / s.boardSize) < ATHLETIC_HORIZON_LAPS;
    case 'unused_emergency_tokens_below_one':
      return unusedTokens(s) < 1;
    case 'owned_licensable_content':
      return Boolean(licensableContent(s));
    case 'recorded_completed_sponsor_contract':
      return s.sponsorRelations.some(r => r.expiresTurn >= s.turn);
    case 'no_unresolved_same_sponsor_breach':
      return true; // no breach producer exists yet
    case 'unrecovered_recorded_cash_loss_positive':
      return unrecoveredLoss(s) > 0;
    case 'media_service_not_already_delivered_same_period':
      return !s.y12Laps.includes(lapNow(s));
    // No producer in this version: unpaid NIL invoices, royalty rights.
    case 'earned_nil_receivable_at_least_15000':
    case 'owned_merchandise_royalty_rights':
    default:
      return false;
  }
}

/** Cards that can be drawn now (eligibility, four-turn cooldown, per-game repeat limit). */
export function eligibleYellow(s) {
  return YELLOW_CARDS.filter(card => {
    if (!card.enabled_in_recommended_preview || blockedYellow(s).has(card.id)) return false;
    const stats = s.yellowStats[card.id];
    if (stats && stats.count >= card.repeat_limit_per_game) return false;
    if (stats && s.turn - stats.lastTurn < card.cooldown_own_turns) return false;
    return card.eligible_all.every(p => predicate(s, p));
  });
}

/** Choices available for a drawn card right now. */
export function yellowChoices(s, card) {
  return card.choices.map(choice => {
    const needsSlot = choice.requires.includes('capacity_for_one_task');
    const paused = activeKinds(s).some(k => k === 'new_optional_task' || k === 'new_optional_social_campaign');
    const available = !needsSlot || (!paused && openTaskSlots(s) + 1 <= TASK_SLOTS);
    const task = choice.effects.find(e => e.op === 'task');
    const reward = choice.scheduled[0]?.effects.find(e => e.op === 'cash_income');
    return {
      id: choice.id,
      label: choice.label,
      available,
      reason: available ? null : paused ? 'A current restriction pauses new optional tasks.' : 'Your three task slots are full. Finish or release a task first.',
      task: task ? { kind: task.kind, slots: task.slots, dueTurns: task.due_own_turns } : null,
      reward: reward ? reward.amount.fixed_cents : 0,
      rewardTaxClass: reward ? reward.tax_class : null,
    };
  });
}

/** The cost-free branch used if the player moves on without choosing. */
export const defaultChoice = card => (card.id === 'Y12' ? 'decline' : card.choices[0].id);
