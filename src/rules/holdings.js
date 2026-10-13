/* global BigInt */
// Valuation and eligibility for owned holdings (investments, contracts, plans, luxury items).
// Pure functions over the ledger state; the ledger owns every mutation.
import { BPS, divHalfUp, roundHalfUp } from './money';
import { annuityAt, policyValue } from './finance';
import {
  RETURN_PROFILES, ACTIVATION, LIFE_TERMS, LEGAL_SUPPORT, HEALTH_SUPPORT, isActivation,
} from './catalog';

// ---------------------------------------------------------------------------
// Return math (port of engine_investments.py)
// ---------------------------------------------------------------------------

/** Launch value: cost * (1 + face rate), floored at zero. */
export function launchValue(cost, tableBps, face) {
  if (cost < 0 || !Array.isArray(tableBps) || tableBps.length !== 6 || !(face >= 1 && face <= 6)) {
    throw new Error('invalid launch');
  }
  return Math.max(0, divHalfUp(cost * (BPS + tableBps[face - 1]), BPS));
}

/** value * (1 + rate)^(units / boardSize); exact for whole laps, high precision otherwise. */
export function accrue(value, rateBps, units, boardSize = 40) {
  if (value < 0 || units < 0 || rateBps < -BPS) throw new Error('invalid accrual');
  if (value === 0 || units === 0) return value;
  if (units % boardSize === 0) {
    const laps = units / boardSize;
    const num = BigInt(value) * BigInt(BPS + rateBps) ** BigInt(laps);
    const den = BigInt(BPS) ** BigInt(laps);
    const q = num / den;
    const r = num % den;
    return Number(r * BigInt(2) >= den ? q + BigInt(1) : q);
  }
  return roundHalfUp(value * Math.pow((BPS + rateBps) / BPS, units / boardSize));
}

/** Continuing rate chosen by the launch face (bounded profiles) or the launch rate itself (Youth Sports). */
export function continuingRate(profile, tableBps, face) {
  const p = RETURN_PROFILES[profile];
  if (!p) return 0;
  if (p.continuing_rate_by_launch_face_bps) return p.continuing_rate_by_launch_face_bps[face - 1];
  if (profile === 'house_locked') return tableBps[face - 1];
  return 0;
}

export const isMarketProfile = profile => Boolean(RETURN_PROFILES[profile]?.per_lap_draw_bps);
export const marketDrawBps = (profile, face) => RETURN_PROFILES[profile].per_lap_draw_bps[face - 1];

/** Event receipts: pay cost, receive cost * (1 + face rate) once; no surviving asset. */
export function eventResult(cost, tableBps, face) {
  const receipts = launchValue(cost, tableBps, face);
  return { cost, receipts, profit: receipts - cost };
}

export function activationResult(budget, face, prepared = false) {
  const row = prepared && face === ACTIVATION.prepared.only_die
    ? { ...ACTIVATION.outcomes[0], gross_receipts_bps: ACTIVATION.prepared.gross_receipts_bps, rep_ceiling: ACTIVATION.prepared.rep_ceiling }
    : ACTIVATION.outcomes[face - 1];
  const receipts = divHalfUp(budget * row.gross_receipts_bps, BPS);
  return { face, label: row.label, receipts, profit: receipts - budget, repCeiling: row.rep_ceiling };
}

// ---------------------------------------------------------------------------
// Current values
// ---------------------------------------------------------------------------

const POLICY_LOAN_BPS = LIFE_TERMS.policy_loan.rate_bps; // 800
const POLICY_LTV_BPS = LIFE_TERMS.policy_loan.ltv_bps; // 7500
const POLICY_WAIT_LAPS = LIFE_TERMS.policy_loan.wait_owned_laps; // 1

export const isActive = a => a.status === 'active';

/** Current value of a holding at the ledger's progress (cents). */
export function assetValue(s, a) {
  if (!isActive(a)) return 0;
  switch (a.holding) {
    case 'growth':
      return a.anchorValue === 0 ? 0 : accrue(a.anchorValue, a.rateBps, s.progress - a.anchorProgress, s.boardSize);
    case 'market':
      return a.value;
    case 'life':
      return policyValue(a.premium, (s.progress - a.acquiredAt) / s.boardSize);
    case 'annuity':
      return a.paymentsMade >= 2 ? 0 : annuityAt(a.terms, s.progress / s.boardSize).asset;
    case 'lux_good':
      return a.resale;
    default:
      return 0;
  }
}

/** Policy loan balance including compounded 8% interest (cents). */
export function policyBalance(s, a) {
  if (!a.loan || !isActive(a)) return 0;
  return accrue(a.loan.anchorBalance, POLICY_LOAN_BPS, s.progress - a.loan.anchorProgress, s.boardSize);
}

export function policyLoanQuote(s, a, holds = []) {
  const value = assetValue(s, a);
  const balance = policyBalance(s, a);
  const ownedLaps = (s.progress - a.acquiredAt) / s.boardSize;
  const waiting = ownedLaps < POLICY_WAIT_LAPS;
  const capacity = Math.max(0, Math.floor((value * POLICY_LTV_BPS) / BPS - balance));
  const ratio = value > 0 ? Math.round((balance / value) * 100) : 0;
  return {
    value,
    balance,
    interest: Math.max(0, balance - (a.loan ? a.loan.principal : 0)),
    max: waiting || holds.length ? 0 : capacity,
    waiting,
    ratio,
    status: ratio >= 90 ? 'at_risk' : ratio >= 75 ? 'no_more_borrowing' : 'ok',
    netProtection: Math.max(0, a.face - balance),
  };
}

/** Pre-income annuity cancellation: accrued value less the 5% surrender charge. */
export function annuityCancelQuote(s, a) {
  const value = assetValue(s, a);
  const fee = divHalfUp(value * 500, BPS);
  return { value, fee, proceeds: value - fee, allowed: a.paymentsMade === 0 && isActive(a) };
}

export function holdingsValue(s) {
  let assetsValue = 0;
  let luxuryResale = 0;
  let policyDebt = 0;
  s.assets.forEach(a => {
    if (!isActive(a)) return;
    if (a.holding === 'lux_good') luxuryResale += assetValue(s, a);
    else assetsValue += assetValue(s, a);
    if (a.holding === 'life') policyDebt += policyBalance(s, a);
  });
  return { assetsValue, luxuryResale, policyDebt };
}

// ---------------------------------------------------------------------------
// Eligibility
// ---------------------------------------------------------------------------

const MULTI_UNIT = ['RE_DUPLEX', 'RE_TRIPLEX', 'RE_FOURPLEX'];
const CONSUMER_FACING = ['I16', 'I17', 'I18', 'I22', 'I23'];

const activeRoots = s => s.assets.filter(a => isActive(a) && (a.holding === 'growth' || a.holding === 'market'));
const hasStage = (a, id) => a.cardId === id || (a.stages || []).includes(id);
const ownsAny = (s, ids) => activeRoots(s).some(a => ids.some(id => hasStage(a, id)));

export function unusedPlanUses(s, plan) {
  return s.assets.filter(a => isActive(a) && a.holding === 'plan' && a.plan === plan).reduce((t, a) => t + a.uses, 0);
}

/** Owned 100%, operating (value above zero) businesses an activation can promote. */
export function activationTargets(s, entry) {
  return activeRoots(s).filter(a => {
    if (!(a.exposure || []).includes('operating_business')) return false;
    if ((a.ownershipBps ?? BPS) !== BPS || assetValue(s, a) <= 0) return false;
    if (entry.id === 'LX32') return a.exposure.includes('inventory');
    if (entry.id === 'LX33') {
      return a.exposure.includes('platform_dependency') || a.exposure.includes('inventory') ||
        CONSUMER_FACING.some(id => hasStage(a, id));
    }
    return true;
  });
}

/** Parents an upgrade can attach to. */
export function upgradeTargets(s, entry) {
  return activeRoots(s).filter(a => {
    if (assetValue(s, a) <= 0 || hasStage(a, entry.id)) return false;
    if (entry.parentMode === 'attach_rental') {
      return MULTI_UNIT.includes(a.cardId) || (a.stages || []).includes('I3');
    }
    if (!entry.parentAnyOf.includes(a.cardId)) return false;
    if (entry.parentRequiresStage) return (a.stages || []).includes(entry.parentRequiresStage);
    if (entry.id === 'I2') return !(a.stages || []).includes('I2');
    return true;
  });
}

function youthParentOk(s, entry) {
  if (entry.id === 'YSH_SPONSOR') return { ok: true };
  if (entry.id === 'YSH_CLINIC' || entry.id === 'YSH_TEAM') {
    return s.milestones.includes(entry.prerequisite)
      ? { ok: true }
      : { ok: false, reason: `Complete "${entry.prerequisite === 'YSH_SPONSOR' ? 'Sponsor a Youth Team' : 'Host a Youth Skills Clinic'}" first.` };
  }
  const parent = s.assets.find(a => isActive(a) && a.cardId === entry.prerequisite);
  if (!parent) return { ok: false, reason: `Own the previous Youth Sports stage first.` };
  if ((parent.ownershipBps ?? BPS) < entry.minParentOwnedBps) return { ok: false, reason: 'Keep at least 35% of the previous stage.' };
  if (s.progress - parent.acquiredAt < entry.minParentHeldCircuits * s.boardSize) {
    return { ok: false, reason: 'Hold the previous stage for one full lap first.' };
  }
  return { ok: true };
}

/**
 * Can the player buy this entry now (ignoring cash and credit, which the quote checks)?
 * Returns { ok, reason, targets? } where targets lists eligible parent/business records.
 */
export function eligibility(s, entry, { targetId = null } = {}) {
  if (!entry) return { ok: false, reason: 'Unknown card.' };
  if (entry.unavailable) return { ok: false, reason: entry.unavailable };

  const once = entry.repeat === 'one_per_game' || entry.repeat === 'once_per_game';
  if (once && (s.milestones.includes(entry.id) || s.assets.some(a => a.cardId === entry.id))) {
    return { ok: false, reason: 'Already completed this game.' };
  }

  if (isActivation(entry)) {
    if (s.activationLaps.includes(currentLapNumber(s))) {
      return { ok: false, reason: 'You already ran a promotion this lap.' };
    }
    const targets = activationTargets(s, entry);
    if (!targets.length) return { ok: false, reason: 'Needs an operating business you own 100%.', targets };
    if (targetId && !targets.some(t => t.id === targetId)) return { ok: false, reason: 'Choose one of your eligible businesses.', targets };
    return { ok: true, targets };
  }

  if (entry.group === 'Youth Sports House') {
    const y = youthParentOk(s, entry);
    if (!y.ok) return y;
  }

  if (entry.parentMode === 'attach' || entry.parentMode === 'attach_rental') {
    const targets = upgradeTargets(s, entry);
    if (!targets.length) {
      const need = entry.parentMode === 'attach_rental'
        ? 'an owned rental property'
        : entry.parentRequiresStage ? 'a renovated vacant property' : 'the asset it upgrades';
      return { ok: false, reason: `Needs ${need}.`, targets };
    }
    if (targetId && !targets.some(t => t.id === targetId)) return { ok: false, reason: 'Choose one of your eligible assets.', targets };
    return { ok: true, targets };
  }
  if (entry.parentMode === 'require' && !ownsAny(s, entry.parentAnyOf)) {
    return { ok: false, reason: 'Needs a related business or content you already own.' };
  }
  if (entry.requiresExposure && !activeRoots(s).some(a => (a.exposure || []).includes(entry.requiresExposure) && assetValue(s, a) > 0)) {
    return { ok: false, reason: 'Needs an active rental property.' };
  }
  if (entry.requiresMultiUnit && !activeRoots(s).some(a => MULTI_UNIT.includes(a.cardId) && assetValue(s, a) > 0)) {
    return { ok: false, reason: 'Needs a duplex, triplex or fourplex you own (a REIT does not count).' };
  }
  if (entry.plan) {
    const max = entry.plan === 'legal' ? LEGAL_SUPPORT.max_unused_uses : HEALTH_SUPPORT.max_unused_uses;
    if (unusedPlanUses(s, entry.plan) + entry.uses > max) {
      return { ok: false, reason: `You can hold at most ${max} unused ${entry.plan} uses.` };
    }
  }

  if (entry.kind === 'luxury') {
    if (entry.repeat === 'one_owned_unit_per_sku' && s.assets.some(a => isActive(a) && a.cardId === entry.id)) {
      return { ok: false, reason: 'You already own this item.' };
    }
    if (entry.repeat === 'one_unresolved_service_per_sku' &&
      s.assets.some(a => isActive(a) && a.cardId === entry.id && a.holding === 'lux_service')) {
      return { ok: false, reason: 'Finish your current one first.' };
    }
    if (entry.repeat === 'one_active_companion_per_sku' && s.assets.some(a => isActive(a) && a.cardId === entry.id)) {
      return { ok: false, reason: 'You already care for this companion.' };
    }
    if (entry.type === 'experience' && s.experienceTurns[entry.id] === s.progress) {
      return { ok: false, reason: 'Already booked this turn.' };
    }
  }
  return { ok: true };
}

/** Lap number used for once-per-lap allowances (the final lap during the final window). */
export function currentLapNumber(s) {
  return Math.min(s.totalLaps, Math.floor(s.progress / s.boardSize) + 1);
}

/** Strongest owned LX30 production discount, if this lap's allowance is unused. */
export function productionDiscount(s, entry) {
  if (entry.id !== 'LX30' || s.discountLaps.includes(currentLapNumber(s))) return 0;
  return s.assets
    .filter(a => isActive(a) && a.discount && a.discount.target_sku === 'LX30')
    .reduce((m, a) => Math.max(m, a.discount.max_cents), 0);
}

export const LEGAL_ASSIST_LIMITS = { bps: LEGAL_SUPPORT.per_matter_assistance_bps, cap: LEGAL_SUPPORT.per_matter_cap_cents };
export const HEALTH_ASSIST_LIMITS = { bps: HEALTH_SUPPORT.assistance_basis_points, cap: HEALTH_SUPPORT.cap_per_incident_cents };
