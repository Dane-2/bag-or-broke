import React from 'react';

function FinalNetWorth({ cash, luxuries, rep, career, credit, debt, curveballs, playerName, showFinal, shadyDebt, investments, lossAvoided = 0, protectionTier = { tier: 0, label: 'No Protection' }, empireStatus = false, isGeneratingSummary }) {
  const luxuryResale = luxuries.reduce((acc, item) => acc + item.resale, 0);
  // Calculate Total Asset Value: sum of all investment current values (newValue)
  const totalAssetValue = investments.reduce((acc, inv) => acc + (inv.newValue || 0), 0);
  
  // Life Insurance aggregates
  const lifeInsurancePolicies = investments.filter(inv => inv.investmentType === 'lifeInsurance');
  const totalLifeInsuranceFaceAmount = lifeInsurancePolicies.reduce((acc, policy) => 
    acc + (policy.currentFaceAmount || policy.faceAmount || 0), 0
  );
  const totalPolicyLiquidity = lifeInsurancePolicies.reduce((acc, policy) => {
    const cashValue = policy.currentCashValue || policy.maxCashValue || 0;
    const loans = policy.outstandingLoans || 0;
    return acc + (cashValue - loans);
  }, 0);
  
  // Annuity aggregates
  const annuities = investments.filter(inv => inv.investmentType === 'annuity');
  const totalGuaranteedIncomePerLap = annuities
    .filter(ann => ann.isMatured)
    .reduce((acc, ann) => acc + (ann.perLapPayout || 0), 0);
  const totalAnnuityIncomeEarned = annuities.reduce((acc, ann) => acc + (ann.totalIncomeEarned || 0), 0);
  
  // Offensive Planning aggregates
  const offensiveInvestments = investments.filter(inv => inv.investmentType === 'offensivePlanning');
  const hasStocks = offensiveInvestments.some(inv => inv.cardId === 'OFF_STOCKS');
  const hasETFs = offensiveInvestments.some(inv => inv.cardId === 'OFF_ETFS');
  const hasBonds = offensiveInvestments.some(inv => inv.cardId === 'OFF_BONDS');
  const offensivePortfolioComplete = hasStocks && hasETFs && hasBonds;
  const offensiveAssetsOwned = offensiveInvestments.length;
  
  // Defensive Planning aggregates (using already defined lifeInsurancePolicies and annuities)
  const healthProtections = investments.filter(inv => inv.investmentType === 'healthDisabilityProtection');
  const legalProtections = investments.filter(inv => inv.investmentType === 'legalProtection');
  const hasUmbrella = investments.some(inv => inv.investmentType === 'umbrellaLiability');
  
  const healthUsesRemaining = healthProtections.reduce((acc, inv) => acc + (inv.usesRemaining > 0 ? inv.usesRemaining : 0), 0);
  const legalUsesRemaining = legalProtections.reduce((acc, inv) => acc + (inv.usesRemaining > 0 ? inv.usesRemaining : 0), 0);
  
  const eventsBlocked = curveballs.filter(c => c.blocked).length;
  const impenetrableWealthLayers = lifeInsurancePolicies.length + annuities.length;
  
  const repValue = rep * 2500;
  const careerValue = career * 5000;
  const creditBonus = credit >= 700 ? 10000 : credit >= 600 ? 5000 : credit >= 500 ? 2000 : 0;
  const netWorth = cash + totalAssetValue + luxuryResale + repValue + careerValue + creditBonus - debt - (shadyDebt || 0);

  const curveballLoss = curveballs.filter(c => !c.blocked).reduce((acc, c) => acc + (c.amount || 0), 0);
  const totalLuxuries = luxuries.length;

  let assignedProfile = 'The CEO in Training';
  if (rep >= 10 && totalLuxuries <= 2 && debt <= 20000) {
    assignedProfile = 'The Architect';
  } else if (cash < 10000 && debt > 50000) {
    assignedProfile = 'The Flameout';
  } else if (career >= 8 && debt === 0) {
    assignedProfile = 'The Legacy Maker';
  } else if (debt >= 60000 && cash > 25000) {
    assignedProfile = 'The Hustler';
  } else if (totalLuxuries >= 6 && rep <= 2) {
    assignedProfile = 'The Flexer';
  } else if (curveballLoss >= 50000 && rep >= 5 && cash < 20000) {
    assignedProfile = 'The Survivor';
  } else if (cash > 100000 && totalLuxuries >= 4 && curveballLoss < 20000) {
    assignedProfile = 'The Hot Shot';
  }

  // Add empire modifier to profile if applicable
  if (empireStatus) {
    assignedProfile = `${assignedProfile} (Empire Builder)`;
  }

  return (
    <section className="bg-white rounded-xl shadow-md p-4">
      <h3 className="text-lg font-semibold text-indigo-700 mb-2 flex items-center gap-2">
        📊 Final Net Worth
      </h3>
      <div className="space-y-1 text-sm text-gray-800">
        <ul className="space-y-1">
          <li>💵 <strong>Cash:</strong> ${cash.toLocaleString()}</li>
          <li>📈 <strong>Total Asset Value:</strong> ${totalAssetValue.toLocaleString()}</li>
          <li>💎 <strong>Luxury Resale:</strong> ${luxuryResale.toLocaleString()}</li>
          <li>🌟 <strong>REP Value:</strong> ${repValue.toLocaleString()}</li>
          <li>📚 <strong>Career Value:</strong> ${careerValue.toLocaleString()}</li>
          <li>🧠 <strong>Credit Bonus:</strong> ${creditBonus.toLocaleString()}</li>
          <li>💳 <strong>Debt:</strong> -${debt.toLocaleString()}</li>
          {shadyDebt > 0 && <li>⚫ <strong>Shady Debt:</strong> -${shadyDebt.toLocaleString()}</li>}
        </ul>
        
        {/* Loss Avoidance Display */}
        {lossAvoided > 0 && (
          <div className="mt-3 p-2 bg-green-50 rounded border border-green-200">
            <p className="text-sm font-semibold text-green-700">
              🛡️ Losses Avoided Through Risk Management: ${lossAvoided.toLocaleString()}
            </p>
          </div>
        )}
        
        {/* Protection Tier Display */}
        {protectionTier.tier > 0 && (
          <div className="mt-2 p-2 bg-blue-50 rounded border border-blue-200">
            <p className="text-sm font-semibold text-blue-700">
              🛡️ Protection Tier: {protectionTier.label}
            </p>
          </div>
        )}
        
        {/* Life Insurance Display */}
        {lifeInsurancePolicies.length > 0 && (
          <div className="mt-3 p-3 bg-blue-50 rounded border border-blue-200">
            <p className="text-sm font-semibold text-blue-700 mb-2">🛡️ Life Insurance Summary</p>
            <ul className="text-xs text-gray-700 space-y-1">
              {lifeInsurancePolicies.map((policy, idx) => {
                const faceAmount = policy.currentFaceAmount || policy.faceAmount || 0;
                const cashValue = policy.currentCashValue || policy.maxCashValue || 0;
                const loans = policy.outstandingLoans || 0;
                const available = cashValue - loans;
                return (
                  <li key={idx} className="pl-2">
                    <strong>{policy.cardTitle}:</strong> Face: ${faceAmount.toLocaleString()}, 
                    Cash Value: ${cashValue.toLocaleString()}, 
                    Loans: ${loans.toLocaleString()}, 
                    Available: ${available.toLocaleString()}
                  </li>
                );
              })}
            </ul>
            <p className="text-sm font-semibold text-blue-800 mt-2">
              Total Face Amount: ${totalLifeInsuranceFaceAmount.toLocaleString()}
            </p>
            <p className="text-sm font-semibold text-blue-800">
              Total Policy Liquidity: ${totalPolicyLiquidity.toLocaleString()}
            </p>
          </div>
        )}
        
        {/* Annuity Display */}
        {annuities.length > 0 && (
          <div className="mt-3 p-3 bg-purple-50 rounded border border-purple-200">
            <p className="text-sm font-semibold text-purple-700 mb-2">💰 Annuity Summary</p>
            <ul className="text-xs text-gray-700 space-y-1">
              {annuities.map((annuity, idx) => (
                <li key={idx} className="pl-2">
                  <strong>{annuity.cardTitle}:</strong> Cost: ${(annuity.cost || 0).toLocaleString()}, 
                  {annuity.isMatured ? '✅ Matured' : '⏳ Not Matured'}, 
                  Payout: ${(annuity.perLapPayout || 0).toLocaleString()}/lap, 
                  Income Earned: ${(annuity.totalIncomeEarned || 0).toLocaleString()}
                </li>
              ))}
            </ul>
            {totalGuaranteedIncomePerLap > 0 && (
              <p className="text-sm font-semibold text-purple-800 mt-2">
                Total Guaranteed Income Per Lap: ${totalGuaranteedIncomePerLap.toLocaleString()}
              </p>
            )}
            {totalAnnuityIncomeEarned > 0 && (
              <p className="text-sm font-semibold text-purple-800">
                Total Annuity Income Earned: ${totalAnnuityIncomeEarned.toLocaleString()}
              </p>
            )}
          </div>
        )}
        
        {/* Offensive Planning Portfolio Display */}
        {offensiveAssetsOwned > 0 && (
          <div className={`mt-3 p-3 rounded border ${offensivePortfolioComplete ? 'bg-green-50 border-green-300' : 'bg-orange-50 border-orange-200'}`}>
            <p className="text-sm font-semibold mb-2" style={{ color: offensivePortfolioComplete ? '#065f46' : '#9a3412' }}>
              📈 Offensive Planning Portfolio
            </p>
            <p className="text-xs text-gray-700 mb-1">
              <strong>Status:</strong> {offensivePortfolioComplete ? '✅ COMPLETE' : '⏳ Incomplete'}
            </p>
            {offensivePortfolioComplete && (
              <p className="text-xs text-green-700 mb-1">
                <strong>Diversification Bonus:</strong> ACTIVE (+5% ROI to all offensive assets)
              </p>
            )}
            <p className="text-xs text-gray-700">
              <strong>Total Offensive Assets Owned:</strong> {offensiveAssetsOwned}/3
            </p>
            {offensiveInvestments.length > 0 && (
              <ul className="text-xs text-gray-700 mt-2 space-y-1">
                {offensiveInvestments.map((inv, idx) => (
                  <li key={idx} className="pl-2">
                    <strong>{inv.cardTitle}:</strong> Value: ${(inv.newValue || 0).toLocaleString()}, 
                    Rolled ROI: {inv.rolledROI}%, 
                    {inv.offensivePortfolioComplete && <span className="text-green-600"> Effective ROI: {inv.effectiveROI?.toFixed(1) || (inv.rolledROI + 5)}% (with bonus)</span>}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
        
        {/* Defensive Planning Summary */}
        {(lifeInsurancePolicies.length > 0 || annuities.length > 0 || healthProtections.length > 0 || legalProtections.length > 0 || hasUmbrella) && (
          <div className="mt-3 p-3 bg-indigo-50 rounded border border-indigo-200">
            <p className="text-sm font-semibold text-indigo-700 mb-2">🛡️ Defensive Planning Overview</p>
            <ul className="text-xs text-gray-700 space-y-1">
              <li><strong>Life Insurance Policies Owned:</strong> {lifeInsurancePolicies.length}</li>
              <li><strong>Annuities Owned:</strong> {annuities.length}</li>
              {healthProtections.length > 0 && (
                <li><strong>Health & Disability Uses Remaining:</strong> {healthUsesRemaining} {healthUsesRemaining === -1 ? '(Unlimited)' : ''}</li>
              )}
              {legalProtections.length > 0 && (
                <li><strong>Legal Protection Uses Remaining:</strong> {legalUsesRemaining} {legalUsesRemaining === -1 ? '(Unlimited)' : ''}</li>
              )}
              <li><strong>Umbrella Liability Coverage:</strong> {hasUmbrella ? '✅ ACTIVE' : '❌ NOT OWNED'}</li>
              {eventsBlocked > 0 && (
                <li><strong>Total Curveball Events Blocked:</strong> {eventsBlocked}</li>
              )}
              {lossAvoided > 0 && (
                <li className="text-green-700"><strong>Total Losses Avoided:</strong> ${lossAvoided.toLocaleString()}</li>
              )}
              {impenetrableWealthLayers > 0 && (
                <li><strong>Impenetrable Wealth Layers Built:</strong> {impenetrableWealthLayers}</li>
              )}
            </ul>
          </div>
        )}
        
        <h4 className="text-xl font-bold mt-3">Net Worth: ${netWorth.toLocaleString()}</h4>
        <p className="text-sm text-gray-600 mt-1">Profile: {assignedProfile}</p>
        <button
          onClick={() => {
            // Call handleEndGame (passed as showFinal prop) which will generate AI summary
            if (showFinal && typeof showFinal === 'function') {
              showFinal();
            }
          }}
          className="w-full bg-indigo-600 text-white font-semibold py-2 mt-4 rounded hover:bg-indigo-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={!showFinal || isGeneratingSummary}
        >
          {isGeneratingSummary ? 'Generating Summary...' : 'End Game & View Scoreboard'}
        </button>
      </div>
    </section>
  );
}

export default FinalNetWorth;
