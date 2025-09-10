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

  const investmentLines = investments.map(inv => {
    const roi = inv.percent ?? Math.round(((inv.newValue - inv.cost) / inv.cost) * 100);
    return `- ${inv.card} → ROI: ${roi}%, New Value: $${inv.newValue.toLocaleString()}`;
  });

  const luxuryLines = luxuries.map(lux => {
    return `- ${lux.name} → Cost: $${lux.cost.toLocaleString()}, REP: ${lux.rep}`;
  });

  return `
You are an NIL athlete lifestyle analyzer.

Here is a player's full end-of-game data:
Name: ${name}
Cash: $${cash.toLocaleString()}
Debt: $${debt.toLocaleString()}
Shady Debt: $${shadyDebt.toLocaleString()}
Reputation: ${rep}
Career Points: ${career}
Credit: ${credit}
Curveballs Faced: ${curveballs}
Laps Completed: ${laps}

Investments:
${investmentLines.join('\n')}

Luxuries:
${luxuryLines.join('\n')}

Analyze their financial behavior. Were they aggressive or conservative? Did they invest wisely or blow their cash? Did they handle adversity well?

Then match them to one of these archetypes:
- The Hustler: Fast money, risky plays, show-off energy
- The CEO in Training: Balanced, long-term thinker, strong investor
- The Flameout: Blew early NIL money, poor risk management
- The Flexer: Loved luxuries, less interest in ROI
- The Survivor: Overcame major curveballs or debt
- The Architect: Perfectly balanced strategy

Finish with 2–3 sentences summarizing their NIL legacy.
  `.trim();
}

module.exports = formatPrompt;
