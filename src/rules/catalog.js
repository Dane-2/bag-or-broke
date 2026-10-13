// Green (investment) and diamond (luxury) catalogs for new games, built from
// config/investments.json, fixed_contracts.json, legal.json, scenarios.json and luxuries.json.
// Historical ids (I41–I50, I32/I42) resolve to canonical records and are never shown twice.
import investmentsConfig from './config/investments.json';
import fixedContracts from './config/fixed_contracts.json';
import legalConfig from './config/legal.json';
import scenariosConfig from './config/scenarios.json';
import luxuriesConfig from './config/luxuries.json';

export const RETURN_PROFILES = investmentsConfig.return_profiles;
export const ACTIVATION = luxuriesConfig.activation;
export const LUXURY_REWARDS = luxuriesConfig.rewards;
export const HEALTH_SUPPORT = scenariosConfig.health_support_replacement;
export const LEGAL_SUPPORT = legalConfig;
export const LIFE_TERMS = fixedContracts.life;
export const ANNUITY_TERMS = fixedContracts.annuity;

/** Historical id -> canonical id (saved records route here; the menu never lists aliases). */
export function canonicalId(id) {
  return investmentsConfig.aliases[id] || id;
}

// ---------------------------------------------------------------------------
// Green menu
// ---------------------------------------------------------------------------

export const INVESTMENT_GROUPS = [
  ['Real Estate', ['I1', 'I2', 'I3', 'RE_SHORT_TERM_RENTAL', 'RE_DUPLEX', 'RE_TRIPLEX', 'RE_FOURPLEX', 'RE_COMMERCIAL']],
  ['Content / Media', ['I4', 'I5', 'I6', 'I28', 'I29', 'I30']],
  ['E-Commerce', ['I7', 'I8', 'I9', 'I31']],
  ['NIL Education', ['I10', 'I11', 'I12', 'I34']],
  ['Crypto / Web3', ['I13', 'I14', 'I15']],
  ['Food & Hospitality', ['I16', 'I17', 'I18']],
  ['Fitness / Health', ['I19', 'I20', 'I21', 'I22', 'I23', 'I24']],
  ['Fashion', ['I25', 'I26', 'I27']],
  ['Support Services', ['I33']],
  ['Marketing / Ads', ['I35', 'I39']],
  ['Branding / Growth', ['I36', 'I40']],
  ['Developer Tools', ['I37']],
  ['Music / Creative', ['I38']],
  ['Financial Instruments', ['RE_REIT']],
  ['Offensive Planning', ['OFF_STOCKS', 'OFF_ETFS', 'OFF_BONDS']],
  ['Life Insurance', ['INV_LIFE_INSURANCE_TIER_A', 'INV_LIFE_INSURANCE_TIER_B', 'INV_LIFE_INSURANCE_TIER_C', 'INV_LIFE_INSURANCE_TIER_D']],
  ['Annuities', ['INV_ANNUITY_TIER_5Y', 'INV_ANNUITY_TIER_10Y', 'INV_ANNUITY_TIER_15Y', 'INV_ANNUITY_TIER_20Y']],
  ['Defensive Planning', ['DEF_HEALTH_BASIC', 'DEF_HEALTH_STANDARD', 'DEF_HEALTH_PREMIUM', 'DEF_LEGAL_BASIC', 'DEF_LEGAL_STANDARD', 'DEF_LEGAL_PREMIUM']],
  ['Youth Sports House', ['YSH_SPONSOR', 'YSH_CLINIC', 'YSH_TEAM', 'YSH_CENTER', 'YSH_COMPLEX']],
];

/**
 * Cards whose promised follow-up action does not exist in the app yet. The spec requires
 * keeping these unavailable (with a reason) rather than selling an action nobody can use.
 */
const UNAVAILABLE = {
  I36: 'Its discount applies to operating and equipment repair bills, which no current curveball produces yet.',
};

/** Scoped one-use discounts bought from the green menu (investments.json support_services). */
export const SERVICE_SCOPES = {
  I37: { components: ['website_platform_remediation'], targetExposure: 'platform_dependency' },
};

/** Upgrades attach to one owned parent root; requirement cards only need one owned. */
const ATTACH_TYPES = new Set(['upgrade']);

const PLAN = {
  DEF_LEGAL_BASIC: { plan: 'legal', uses: 1 },
  DEF_LEGAL_STANDARD: { plan: 'legal', uses: 2 },
  DEF_LEGAL_PREMIUM: { plan: 'legal', uses: 3 },
  DEF_HEALTH_BASIC: { plan: 'health', uses: 1 },
  DEF_HEALTH_STANDARD: { plan: 'health', uses: 2 },
  DEF_HEALTH_PREMIUM: { plan: 'health', uses: 3 },
};

const TYPE_LABELS = {
  business: 'Owned business',
  property: 'Owned property',
  upgrade: 'Upgrade to an owned asset',
  market_position: 'Market position',
  event: 'One-time event',
  activation: 'Promotion (activation)',
  service: 'Support service',
  protection: 'Protection plan',
  fixed_contract: 'Fixed contract',
  community_expense: 'Community sponsorship',
  company: 'Youth Sports business',
  company_property: 'Youth Sports property',
};

function lifeTier(id) {
  return LIFE_TERMS.tiers.find(t => t.id === id);
}
function annuityTier(id) {
  return ANNUITY_TERMS.tiers.find(t => t.id === id);
}

function fromCard(card, group) {
  const entry = {
    id: card.id,
    kind: 'investment',
    title: card.title,
    group,
    type: card.economic_type,
    typeLabel: TYPE_LABELS[card.economic_type] || card.economic_type,
    profile: card.profile,
    price: card.price_cents,
    cashOnly: card.cash_only,
    minCashBps: card.minimum_cash_bps,
    launchTable: card.launch_table_bps,
    repeat: card.repeat_policy,
    parentAnyOf: card.parent_any_of || [],
    parentMode: card.parent_any_of?.length ? (ATTACH_TYPES.has(card.economic_type) ? 'attach' : 'require') : null,
    exposure: card.exposure_tags || [],
    rules: (card.rules || []).filter(r => !r.startsWith('All prices')),
    saleRoute: card.sale_route,
    borrowRoute: card.borrow_route,
    status: card.status,
    unavailable: UNAVAILABLE[card.id] || null,
    rep: 0,
    career: 0,
  };
  if (card.id === 'I3') entry.parentRequiresStage = 'I2';
  if (card.id === 'RE_SHORT_TERM_RENTAL') entry.parentMode = 'attach_rental';
  if (card.id === 'RE_TRIPLEX') entry.requiresExposure = 'rental_property';
  if (card.id === 'RE_COMMERCIAL') entry.requiresMultiUnit = true;
  if (PLAN[card.id]) Object.assign(entry, PLAN[card.id]);
  if (SERVICE_SCOPES[card.id]) {
    const svc = investmentsConfig.support_services[card.id];
    entry.service = { ...SERVICE_SCOPES[card.id], bps: svc.rate_bps, cap: svc.cap_cents, uses: svc.uses };
    entry.parentMode = 'service';
  }
  if (card.economic_type === 'fixed_contract') {
    const life = lifeTier(card.id);
    const annuity = annuityTier(card.id);
    if (life) entry.life = { premium: life.price_cents, face: life.face_amount_cents };
    if (annuity) {
      entry.annuity = { premium: annuity.premium_cents, rateBps: annuity.rate_bps, wait: annuity.first_wait_owned_laps };
      entry.title = annuity.name;
    }
  }
  return entry;
}

function fromYouth(stage) {
  return {
    id: stage.id,
    kind: 'investment',
    title: stage.title,
    group: 'Youth Sports House',
    type: stage.economic_type,
    typeLabel: TYPE_LABELS[stage.economic_type] || stage.economic_type,
    profile: stage.profile,
    price: stage.price_cents,
    cashOnly: stage.cash_only,
    minCashBps: stage.minimum_founder_cash_bps || 10000,
    launchTable: stage.launch_table_bps,
    repeat: stage.repeat || 'once_per_game',
    parentAnyOf: [],
    parentMode: null,
    exposure: stage.exposure_tags || [],
    rules: [],
    saleRoute: stage.asset_value ? 'central_market_sale' : 'none',
    borrowRoute: stage.asset_value && !stage.cash_only ? 'central_secured_50_percent_ltv' : 'none',
    status: stage.status,
    unavailable: null,
    rep: stage.rep || 0,
    career: stage.career || 0,
    prerequisite: stage.prerequisite,
    entryOptionsBps: stage.entry_options_bps || [10000],
    minParentOwnedBps: stage.minimum_parent_owned_bps || 0,
    minParentHeldCircuits: stage.minimum_parent_held_circuits || 0,
    assetValue: stage.asset_value,
  };
}

const cardsById = Object.fromEntries(investmentsConfig.cards.map(c => [c.id, c]));
const youthById = Object.fromEntries(investmentsConfig.youth_sports_house.map(y => [y.id, y]));

export const INVESTMENT_CATALOG = INVESTMENT_GROUPS.flatMap(([group, ids]) =>
  ids.map(id => (youthById[id] ? fromYouth(youthById[id]) : fromCard(cardsById[id], group)))
);

const investmentIndex = Object.fromEntries(INVESTMENT_CATALOG.map(e => [e.id, e]));
export const investmentEntry = id => investmentIndex[canonicalId(id)] || null;

// ---------------------------------------------------------------------------
// Diamond menu
// ---------------------------------------------------------------------------

export const LUXURY_CATEGORIES = [
  ['vehicles', 'Vehicles'],
  ['style_jewelry', 'Style & Jewelry'],
  ['home_living', 'Home & Living'],
  ['technology', 'Technology'],
  ['travel', 'Travel'],
  ['celebration', 'Celebrations'],
  ['transport', 'Transport'],
  ['brand_creative', 'Brand & Creative'],
  ['business_promotion', 'Business Promotions'],
  ['personal_support', 'Personal Support'],
  ['family_community', 'Family & Hometown'],
  ['companions', 'Companions'],
];

const RUNTIME_GATES = {
  residence_links: 'Needs an owned personal home, which this version of the game does not have yet.',
  task_links: 'Completes a scheduled task, which arrives with the career and curveball updates.',
};

const LUX_TYPE_LABELS = {
  owned_good: 'Owned item',
  experience: 'Experience',
  service: 'Service',
  gift: 'Gift',
  community_event: 'Community event',
  business_activation: 'Business promotion',
  companion: 'Companion',
  residence_improvement: 'Home project',
};

/** Steps the player completes after paying, before an earned reward is recorded. */
const COMPLETION = {
  LX23: { prompt: 'Finish the studio session and approve the mix.', choices: null },
  LX28: { prompt: 'Approve the finished headshots and bio.', choices: null },
  LX29: { prompt: 'Choose a message, then approve the delivered kit.', choices: ['Performance first', 'Community first', 'Entrepreneur first'] },
  LX30: { prompt: 'Choose the format, then record and publish the series.', choices: ['Twelve short videos', 'Three podcast episodes'] },
  LX45: { prompt: 'Choose local partners and deliver the event.', choices: ['School and youth league', 'Local businesses', 'Community center'] },
};

export const LUXURY_CATALOG = luxuriesConfig.items.map(item => {
  const category = LUXURY_CATEGORIES.find(([k]) => k === item.category);
  return {
    id: item.id,
    kind: 'luxury',
    title: item.name,
    scope: item.scope,
    group: category ? category[1] : item.category,
    category: item.category,
    type: item.economic_type,
    typeLabel: LUX_TYPE_LABELS[item.economic_type] || item.economic_type,
    price: item.price_cents,
    initialResale: item.initial_resale_cents,
    declineBps: item.lap_decline_bps,
    repeat: item.repeat_rule,
    taxClass: item.tax_class,
    prerequisites: item.prerequisites || [],
    rewardFamily: item.reward_family || null,
    repMax: item.rep_max || 0,
    discount: item.discount || null,
    setup: item.setup_cents || 0,
    firstCare: item.first_care_cents || 0,
    renewalCare: item.renewal_care_cents || 0,
    completion: COMPLETION[item.id] || (item.economic_type === 'community_event' ? COMPLETION.LX45 : null),
    unavailable: item.runtime_feature && RUNTIME_GATES[item.runtime_feature] ? RUNTIME_GATES[item.runtime_feature] : null,
    cashOnly: false,
    exposure: [],
  };
});

const luxuryIndex = Object.fromEntries(LUXURY_CATALOG.map(e => [e.id, e]));
export const luxuryEntry = id => luxuryIndex[id] || null;

export const catalogEntry = id => investmentEntry(id) || luxuryEntry(id);

/** Activation cards in either menu share one allowance and one REP family. */
export const isActivation = entry =>
  entry && (entry.type === 'activation' || entry.type === 'business_activation');
