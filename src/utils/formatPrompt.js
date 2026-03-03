function formatPrompt(player) {
  const {
    name,
    cash,
    debt,
    shadyDebt,
    rep,
    career,
    credit,
    curveballs,
    laps,
    investments = [],
    luxuries = []
  } = player;

  // Calculate investment statistics
  const totalInvestmentCost = investments.reduce((sum, inv) => sum + (inv.cost || 0), 0);
  const totalInvestmentValue = investments.reduce((sum, inv) => sum + (inv.newValue || 0), 0);
  const totalLuxuryCost = luxuries.reduce((sum, lux) => sum + (lux.cost || 0), 0);
  const avgInvestmentROI = investments.length > 0 
    ? investments.reduce((sum, inv) => {
        const roi = inv.percent ?? Math.round(((inv.newValue - inv.cost) / inv.cost) * 100);
        return sum + roi;
      }, 0) / investments.length
    : 0;

  // Categorize investments
  const investmentCategories = {};
  investments.forEach(inv => {
    const category = inv.category || inv.type || inv.investmentType || 'Other';
    investmentCategories[category] = (investmentCategories[category] || 0) + 1;
  });

  // Categorize luxuries
  const luxuryCategories = {};
  luxuries.forEach(lux => {
    const category = lux.category || 'Uncategorized';
    luxuryCategories[category] = (luxuryCategories[category] || 0) + 1;
  });

  const investmentLines = investments.map(inv => {
    const roi = inv.percent ?? Math.round(((inv.newValue - inv.cost) / inv.cost) * 100);
    const title = inv.cardTitle || inv.card || inv.name || 'Unknown Investment';
    return `- ${title} → Cost: $${(inv.cost || 0).toLocaleString()}, ROI: ${roi}%, Current Value: $${(inv.newValue || 0).toLocaleString()}`;
  });

  const luxuryLines = luxuries.map(lux => {
    const category = lux.category || 'Uncategorized';
    return `- ${lux.name || 'Unknown'} → Cost: $${(lux.cost || 0).toLocaleString()}, Category: ${category}, REP: ${lux.rep || 0}`;
  });

  return `
You are an NIL athlete lifestyle analyzer and financial storyteller.

Here is a player's full end-of-game data:
Name: ${name}
Cash: $${cash.toLocaleString()}
Debt: $${debt.toLocaleString()}
Shady Debt: $${shadyDebt.toLocaleString()}
Reputation: ${rep}
Career Points: ${career}
Credit Score: ${credit}
Curveballs Faced: ${curveballs.length || curveballs}
Laps Completed: ${laps}

FINANCIAL PORTFOLIO ANALYSIS:
Total Investment Cost: $${totalInvestmentCost.toLocaleString()}
Total Investment Value: $${totalInvestmentValue.toLocaleString()}
Average Investment ROI: ${avgInvestmentROI.toFixed(1)}%
Total Luxury Spending: $${totalLuxuryCost.toLocaleString()}
Investment-to-Luxury Ratio: ${totalInvestmentCost > 0 ? (totalLuxuryCost / totalInvestmentCost).toFixed(2) : 'N/A'}

INVESTMENT BREAKDOWN (${investments.length} total):
${investmentLines.length > 0 ? investmentLines.join('\n') : 'No investments made'}

Investment Categories: ${Object.keys(investmentCategories).join(', ') || 'None'}

LUXURY BREAKDOWN (${luxuries.length} total):
${luxuryLines.length > 0 ? luxuryLines.join('\n') : 'No luxuries purchased'}

Luxury Categories: ${Object.keys(luxuryCategories).join(', ') || 'None'}

YOUR ANALYSIS TASK:

1. FINANCIAL PHILOSOPHY NARRATIVE (3-4 sentences):
   Analyze the relationship between their investment choices and luxury purchases. What story does this tell about their financial philosophy? Did they prioritize building wealth or enjoying the moment? How do their luxury categories (Style, Travel, Vehicle, etc.) reflect their personal brand and lifestyle aspirations? What does their investment-to-luxury ratio reveal about their balance between delayed gratification and immediate rewards?

2. SPENDING PATTERN ANALYSIS (2-3 sentences):
   Examine their spending patterns. Were they strategic with their luxury purchases (high REP value, brand building) or impulsive (flashy items, low ROI)? How do their investment categories (Real Estate, Tech, Crypto, etc.) align with their luxury choices? For example, did someone who invested in Real Estate also buy luxury vehicles or estate upgrades? Did someone focused on Brand/Image investments also purchase social media rebrands or content production luxuries?

3. LIFESTYLE STORYTELLING (2-3 sentences):
   Tell the story of their NIL journey through the lens of their choices. What does their combination of investments and luxuries say about who they are as a person and athlete? Were they building a legacy (high Career points, defensive investments) or living in the moment (high REP, flashy luxuries)? How did their luxury purchases support or contradict their investment strategy?

4. ARCHETYPE MATCHING:
   Match them to one of these archetypes based on their complete financial picture:
   - The Hustler: Fast money, risky plays, show-off energy, high luxury spending
   - The CEO in Training: Balanced, long-term thinker, strong investor, strategic luxuries
   - The Flameout: Blew early NIL money, poor risk management, high debt
   - The Flexer: Loved luxuries, less interest in ROI, high REP, low investments
   - The Survivor: Overcame major curveballs or debt, resilient strategy
   - The Architect: Perfectly balanced strategy, high Career and REP, smart allocation
   - The Legacy Maker: High Career points, defensive investments, family-focused luxuries

5. FINAL LEGACY (2-3 sentences):
   Summarize their NIL legacy. What will they be remembered for? How did their unique combination of investments and luxuries shape their path? What lessons can other athletes learn from their approach?

Write in an engaging, narrative style that tells their story, not just lists facts. Make it feel like you're analyzing a real athlete's financial journey.
  `.trim();
}

module.exports = formatPrompt;
