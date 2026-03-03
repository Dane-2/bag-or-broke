/**
 * Coach JBo Unlock System
 * Eligibility: Group Mode (multiplayer) + 4+ players
 * Only ONE player per group gets Coach JBo - the closest match to the conservative playstyle.
 * @see updates/Coach JBo.pdf
 */

// Map investment to Coach JBo categoryTag
function getInvestmentCategoryTag(inv) {
  if (!inv) return null;
  const cardId = inv.cardId || inv.id || '';
  const invType = inv.investmentType || '';
  const category = (inv.category || '').toLowerCase();

  // PROTECTION
  if (
    invType === 'lifeInsurance' ||
    invType === 'annuity' ||
    invType === 'healthDisabilityProtection' ||
    invType === 'legalProtection' ||
    invType === 'umbrellaLiability' ||
    cardId === 'RE_HOLDCO' ||
    cardId === 'RE_INSURANCE' ||
    cardId.startsWith('DEF_HEALTH') ||
    cardId.startsWith('DEF_LEGAL') ||
    cardId === 'DEF_UMBRELLA' ||
    cardId === 'DEF_UMBRELLA_LIABILITY' ||
    category.includes('life insurance') ||
    category.includes('annuit') ||
    category.includes('risk management') ||
    category.includes('legal')
  ) {
    return 'PROTECTION';
  }

  // REAL_ESTATE (excluding REIT - that's financial)
  if (
    (category.includes('real estate') && cardId !== 'RE_REIT') ||
    ['I1', 'I2', 'I3', 'RE_SHORT_TERM_RENTAL', 'RE_DUPLEX', 'RE_TRIPLEX', 'RE_FOURPLEX', 'RE_COMMERCIAL'].includes(cardId) ||
    cardId.startsWith('RE_')
  ) {
    if (cardId === 'RE_REIT') return 'FINANCIAL';
    return 'REAL_ESTATE';
  }

  // FINANCIAL
  if (
    invType === 'offensivePlanning' ||
    cardId === 'RE_REIT' ||
    ['OFF_STOCKS', 'OFF_ETFS', 'OFF_BONDS', 'I13', 'I14', 'I15'].includes(cardId) ||
    category.includes('crypto') ||
    category.includes('offensive planning') ||
    category.includes('financial instruments')
  ) {
    return 'FINANCIAL';
  }

  // BRAND (content, marketing, e-commerce, etc.)
  return 'BRAND';
}

// Map luxury to BASIC_BRAND_LUXURY (vehicle/utility) or FLEX_LUXURY
function getLuxurySubTag(luxury) {
  const category = (luxury?.category || '').toLowerCase();
  if (category.includes('vehicle')) return 'BASIC_BRAND_LUXURY';
  return 'FLEX_LUXURY';
}

// Build time-ordered acquisitions (investments first, then luxuries - approximation)
function buildAcquisitions(investments = [], luxuries = []) {
  const invArr = Array.isArray(investments) ? investments : [];
  const luxArr = Array.isArray(luxuries) ? luxuries : [];
  const acquisitions = [];
  invArr.forEach((inv, i) => {
    const tag = getInvestmentCategoryTag(inv);
    if (tag) {
      acquisitions.push({
        turnIndex: acquisitions.length,
        type: 'INVESTMENT',
        categoryTag: tag,
        subTag: null,
        cost: inv.cost || 0,
        item: inv,
      });
    }
  });
  luxArr.forEach((lux) => {
    const subTag = getLuxurySubTag(lux);
    acquisitions.push({
      turnIndex: acquisitions.length,
      type: 'LUXURY',
      categoryTag: 'LUXURY',
      subTag,
      cost: lux.cost || 0,
      item: lux,
    });
  });
  return acquisitions;
}

/**
 * Compute Coach JBo Match Score for a single player
 */
export function computeCoachJBoScore(player) {
  const investments = Array.isArray(player.investments) ? player.investments : [];
  const luxuries = Array.isArray(player.luxuries) ? player.luxuries : [];
  const acquisitions = buildAcquisitions(investments, luxuries);

  let score = 0;
  const reasons = [];

  const firstInvestments = acquisitions.filter((a) => a.type === 'INVESTMENT').slice(0, 3);
  const protectionCount = firstInvestments.filter((a) => a.categoryTag === 'PROTECTION').length;
  const firstProtectionIdx = acquisitions.findIndex((a) => a.categoryTag === 'PROTECTION');
  const firstRealEstateIdx = acquisitions.findIndex((a) => a.categoryTag === 'REAL_ESTATE');
  const firstFinancialIdx = acquisitions.findIndex((a) => a.categoryTag === 'FINANCIAL');
  const firstBrandIdx = acquisitions.findIndex((a) => a.categoryTag === 'BRAND');
  const firstLuxuryIdx = acquisitions.findIndex((a) => a.type === 'LUXURY');

  const foundationCompleteIndex =
    firstProtectionIdx >= 0 && firstRealEstateIdx >= 0
      ? Math.max(firstProtectionIdx, firstRealEstateIdx)
      : firstProtectionIdx >= 0
        ? firstProtectionIdx
        : firstRealEstateIdx;

  // A) Defensive Foundation
  if (protectionCount >= 2) {
    score += 30;
    reasons.push('Defense-first: 2+ of first 3 investments were Protection');
  } else if (protectionCount === 1) {
    score += 15;
    reasons.push('Defense-first: 1 of first 3 investments was Protection');
  }
  if (firstInvestments.length > 0 && firstInvestments[0].categoryTag === 'PROTECTION') {
    score += 10;
    reasons.push('First investment was Protection');
  }

  // B) Real Estate Before Financial/Brand
  if (firstRealEstateIdx >= 0) {
    if (
      (firstFinancialIdx < 0 || firstRealEstateIdx < firstFinancialIdx) &&
      (firstBrandIdx < 0 || firstRealEstateIdx < firstBrandIdx)
    ) {
      score += 25;
      reasons.push('Real Estate started portfolio before Financial/Brand');
    } else if (firstBrandIdx < 0 || firstRealEstateIdx < firstBrandIdx) {
      score += 10;
    }
  }

  // C) Financial Instruments After Real Estate
  if (firstFinancialIdx >= 0) {
    if (firstRealEstateIdx >= 0 && firstFinancialIdx > firstRealEstateIdx) {
      score += 15;
      reasons.push('Financial instruments after Real Estate');
    } else {
      score += 5;
    }
  }

  // D) Luxury Timing
  if (firstLuxuryIdx >= 0 && foundationCompleteIndex >= 0) {
    if (firstLuxuryIdx < foundationCompleteIndex) {
      const firstLuxury = acquisitions[firstLuxuryIdx];
      if (firstLuxury?.subTag === 'BASIC_BRAND_LUXURY') {
        score -= 10;
        reasons.push('Early luxury (vehicle) before foundation');
      } else {
        score -= 30;
        reasons.push('Luxury before foundation (major penalty)');
      }
    } else {
      reasons.push('No luxury before foundation');
    }
  }

  // E) Luxury Type
  const luxAcqs = acquisitions.filter((a) => a.type === 'LUXURY');
  const flexCount = luxAcqs.filter((a) => a.subTag === 'FLEX_LUXURY').length;
  const basicOnly = luxAcqs.length > 0 && luxAcqs.every((a) => a.subTag === 'BASIC_BRAND_LUXURY');
  if (basicOnly) {
    score += 10;
    reasons.push('Luxury is only basic/brand-supportive');
  } else if (flexCount >= 2) {
    score -= 15;
    reasons.push('2+ flex luxury items');
  }

  // F) Spend Balance
  const totalInvestmentSpend = investments.reduce((s, i) => s + (i.cost || 0), 0);
  const totalLuxurySpend = luxuries.reduce((s, l) => s + (l.cost || 0), 0);
  if (totalInvestmentSpend >= totalLuxurySpend) {
    score += 10;
    reasons.push('Investment spend >= luxury spend');
  } else {
    score -= 10;
  }

  return { score, reasons };
}

/**
 * Select Coach JBo winner from all players. Only call when eligible (group mode, 4+ players).
 * Returns { winnerPlayerId, winnerName, scores: { [playerId]: { score, reasons } } }
 */
export function selectCoachJBoWinner(roomPlayers) {
  const entries = Object.entries(roomPlayers || {});
  if (entries.length < 4) return null;

  const scores = {};
  entries.forEach(([playerId, player]) => {
    const { score, reasons } = computeCoachJBoScore(player);
    scores[playerId] = { score, reasons };

    const inv = player.investments || [];
    const lux = player.luxuries || [];
    const protectionInFirst3 = (inv.slice(0, 3) || []).filter((i) =>
      getInvestmentCategoryTag(i) === 'PROTECTION'
    ).length;
    const firstRE = (inv || []).findIndex((i) => getInvestmentCategoryTag(i) === 'REAL_ESTATE');
    const netWorth =
      (player.cash || 0) +
      (Array.isArray(inv) ? inv.reduce((s, i) => s + (i.newValue || 0), 0) : 0) +
      (Array.isArray(lux) ? lux.reduce((s, l) => s + (l.resale || 0), 0) : 0) -
      (player.debt || 0) -
      (player.shadyDebt || 0) +
      (player.rep || 0) * 5000 +
      (player.career || 0) * 10000;

    scores[playerId].protectionInFirst3 = protectionInFirst3;
    scores[playerId].firstRealEstateIndex = firstRE >= 0 ? firstRE : 999;
    scores[playerId].careerPoints = player.career || 0;
    scores[playerId].netWorth = netWorth;
  });

  const sorted = entries
    .map(([playerId]) => {
      const s = scores[playerId];
      return {
        playerId,
        name: roomPlayers[playerId]?.name || 'Player',
        ...s,
      };
    })
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (b.protectionInFirst3 !== a.protectionInFirst3) return b.protectionInFirst3 - a.protectionInFirst3;
      if (a.firstRealEstateIndex !== b.firstRealEstateIndex) return a.firstRealEstateIndex - b.firstRealEstateIndex;
      if (b.careerPoints !== a.careerPoints) return b.careerPoints - a.careerPoints;
      return b.netWorth - a.netWorth;
    });

  const winner = sorted[0];
  return {
    winnerPlayerId: winner.playerId,
    winnerName: winner.name,
    coachJBoUnlockedName: 'Coach JBo',
    scores,
  };
}
