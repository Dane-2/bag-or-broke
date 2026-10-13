// Career & Professional Development (Packet 3), from config/career.json.
// Six activity families x thirteen paths. Points are awarded on completion only, once per
// family per completion lap; internships follow the one-turn follow-up state machine.
import careerConfig from './config/career.json';

export const FAMILIES = careerConfig.families;
export const PATHS = careerConfig.paths;
export const INTERNSHIP = careerConfig.internship;
export const REFERRAL = careerConfig.referral;
export const PREPARED = careerConfig.prepared_launch;
export const MENTOR_VISITS_PER_PATH = 3;

export const family = id => FAMILIES.find(f => f.id === id) || null;
export const path = id => PATHS.find(p => p.id === id) || null;

/** Industry path of an owned business, by its green-menu group (used for Prepared launch). */
const GROUP_PATHS = {
  'Youth Sports House': 'sports_business_management',
  'Real Estate': 'real_estate_property_operations',
  'Content / Media': 'media_marketing_communications',
  'Marketing / Ads': 'media_marketing_communications',
  Fashion: 'fashion_retail_ecommerce',
  'E-Commerce': 'fashion_retail_ecommerce',
  'Support Services': 'fashion_retail_ecommerce',
  'Financial Instruments': 'finance_business_management',
  'Developer Tools': 'technology_product_development',
  'Fitness / Health': 'health_fitness_performance',
  'Food & Hospitality': 'food_hospitality_events',
  'NIL Education': 'education_youth_development',
};
export const pathForGroup = group => GROUP_PATHS[group] || null;

export function createCareer() {
  return {
    offer: null,
    history: [],
    rewardedLaps: {},
    mentorVisits: {},
    lastRewardedTurn: {},
    experience: [],
    competencies: [],
    contacts: [],
    internship: null,
    graduated: false,
    referral: null,
  };
}

/** Choices shown for a family on a chosen path. Each returns { id, label, competency?, contact? }. */
export function familyChoices(familyId, pathId) {
  const p = path(pathId);
  if (!p) return [];
  switch (familyId) {
    case 'resume_workshop':
      return [
        { id: 'experience', label: 'Use two truthful experience cards' },
        { id: 'beginner', label: 'Use the beginner interest-and-skills template' },
      ];
    case 'community_service':
      return p.service.role_choices.map((label, i) => ({ id: `role${i}`, label, contact: p.service.contact_role }));
    case 'leadership_retreat':
      return p.leadership.role_choices.map((label, i) => ({ id: `role${i}`, label, competency: p.leadership.competency }));
    case 'internship':
      return p.internship.assignments.map(a => ({ id: a.id, label: a.label, competency: a.competency }));
    case 'graduation':
      return [{ id: 'complete', label: 'Complete the final-requirements scene' }];
    case 'mentoring':
      return p.mentoring.focus_choices.map(f => ({ id: f.id, label: f.label, competency: f.competency }));
    default:
      return [];
  }
}

/** Scene text for a family on a path. */
export function familyScene(familyId, pathId) {
  const p = path(pathId);
  if (!p) return '';
  switch (familyId) {
    case 'resume_workshop':
      return `Build an application profile for: ${p.resume.role}.`;
    case 'community_service':
      return p.service.task;
    case 'leadership_retreat':
      return p.leadership.task;
    case 'internship':
      return `${p.role}: ${p.internship.scene} Accept now; you follow up on your next turn.`;
    case 'graduation':
      return `${p.graduation.task} This is a fictional game milestone, not a real degree.`;
    case 'mentoring':
      return `Meet a mentor in ${p.name} and pick a focus.`;
    default:
      return '';
  }
}

const lapOf = s => Math.min(s.totalLaps, Math.floor(s.progress / s.boardSize) + 1);
const completedLapsOf = s => Math.min(s.totalLaps, Math.floor(s.progress / s.boardSize));

export const familyRewardedThisLap = (s, familyId) => (s.career.rewardedLaps[familyId] || []).includes(lapOf(s));

/** Has the player done new relevant work in this path since `sinceTurn`? */
export function freshExperience(s, pathId, sinceTurn) {
  return s.career.experience.some(e => e.path === pathId && e.turn > sinceTurn);
}

/** Can this family be rewarded on this path now? Returns { ok, reason }. */
export function pathAllowed(s, familyId, pathId) {
  const c = s.career;
  const f = family(familyId);
  if (f.requires_new_relevant_experience_after_first) {
    const last = c.lastRewardedTurn[`${familyId}:${pathId}`];
    if (last !== undefined && !freshExperience(s, pathId, last)) {
      return { ok: false, reason: 'Do new work in this field first (a purchase, task or activity in it).' };
    }
  }
  if (familyId === 'mentoring' && (c.mentorVisits[pathId] || []).length >= MENTOR_VISITS_PER_PATH) {
    return { ok: false, reason: 'You have had three rewarded mentor visits in this field.' };
  }
  return { ok: true };
}

/** Families that can be offered on a purple landing (filtered before the draw). */
export function eligibleFamilies(s) {
  const c = s.career;
  return FAMILIES.filter(f => {
    if (familyRewardedThisLap(s, f.id)) return false;
    if (f.id === 'internship' && c.internship) return false;
    if (f.id === 'graduation' && (c.graduated || completedLapsOf(s) < f.min_completed_laps)) return false;
    if (f.id === 'mentoring' && PATHS.every(p => !pathAllowed(s, 'mentoring', p.id).ok)) return false;
    return true;
  });
}

/** Competency strings that make a business Prepared for a launch roll of 1. */
export function preparedFor(s, businessPath) {
  if (!businessPath) return false;
  const comps = s.career.competencies;
  const matches = (sourcePath, target) =>
    sourcePath === target || (PREPARED.cross_path_whitelist[sourcePath] || []).includes(target);
  if (comps.some(c => c.startsWith('campaign_planning:') && matches(c.split(':')[1], businessPath))) return true;
  return comps.some(c => {
    if (!c.startsWith('internship:')) return false;
    const [, sourcePath, competency] = c.split(':');
    return (PREPARED.internship_competency_whitelist[sourcePath] || []).includes(competency) && matches(sourcePath, businessPath);
  });
}

/** Referral saving on an eligible service charge (5%, capped at $2,500). */
export function referralSaving(charge) {
  return Math.min(REFERRAL.cap * 100, Math.round(charge * REFERRAL.percent));
}
