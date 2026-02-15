import React from 'react';

function LapTracker({ laps, totalLaps, setLaps, investments, setInvestments, setCash, addToast }) {
  const handleCompleteLap = () => {
    if (laps >= totalLaps) return;

    let totalAnnuityPayout = 0;
    const newLap = laps + 1;

    const updatedInvestments = investments.map((inv) => {
      // Handle Life Insurance - 25% growth per lap
      if (inv.investmentType === 'lifeInsurance') {
        const newFaceAmount = Math.floor((inv.currentFaceAmount || inv.faceAmount || 0) * 1.25);
        const newCashValue = Math.floor((inv.currentCashValue || inv.maxCashValue || 0) * 1.25);
        
        return {
          ...inv,
          currentFaceAmount: newFaceAmount,
          currentCashValue: newCashValue,
          maxCashValue: newCashValue, // Update max as well
          newValue: newCashValue // For net worth calculation
        };
      }

      // Handle Annuities - check maturity and payouts
      if (inv.investmentType === 'annuity') {
        const purchaseLap = inv.purchaseLap || 0;
        const maturityLaps = inv.maturityLaps || 0;
        const lapsSincePurchase = newLap - purchaseLap;
        const isMatured = lapsSincePurchase >= maturityLaps;
        
        // If matured, add payout
        if (isMatured && inv.perLapPayout) {
          totalAnnuityPayout += inv.perLapPayout;
          return {
            ...inv,
            isMatured: true,
            totalIncomeEarned: (inv.totalIncomeEarned || 0) + inv.perLapPayout
          };
        }
        
        return {
          ...inv,
          isMatured: isMatured
        };
      }

      // Handle Offensive Planning investments - use rolled ROI with multiplication formula
      if (inv.investmentType === 'offensivePlanning' && inv.rolledROI !== undefined) {
        // Check if portfolio completion bonus applies (+5% to ROI)
        const hasPortfolioBonus = inv.offensivePortfolioComplete || false;
        const baseROI = inv.rolledROI / 100; // Convert percentage to decimal
        const effectiveROI = hasPortfolioBonus ? baseROI + 0.05 : baseROI;
        
        // Apply formula: asset_value = asset_value × (1 + roi)
        const newValue = Math.floor(inv.newValue * (1 + effectiveROI));
        const result = newValue - inv.cost;
        const percent = Math.round((result / inv.cost) * 100);

        return {
          ...inv,
          newValue,
          result,
          percent,
          effectiveROI: effectiveROI * 100 // Store for display
        };
      }

      // Regular investments - 5% growth per lap
      const gain = Math.floor(inv.newValue * 0.05);
      const newValue = inv.newValue + gain;
      const result = newValue - inv.cost;
      const percent = Math.round((result / inv.cost) * 100);

      return {
        ...inv,
        newValue,
        result,
        percent
      };
    });

    setInvestments(updatedInvestments);
    setLaps(newLap);
    
    // Add NIL stipend of $2,500
    let totalCashGain = 2500;
    
    // Add annuity payouts
    if (totalAnnuityPayout > 0) {
      totalCashGain += totalAnnuityPayout;
      if (addToast) {
        addToast(`Annuity payout received: $${totalAnnuityPayout.toLocaleString()}`, 'success', 3000);
      }
    }
    
    if (setCash) {
      setCash((prev) => prev + totalCashGain);
    }
    
    // Show toast notification
    if (addToast) {
      if (totalAnnuityPayout > 0) {
        addToast(`Lap completed! NIL stipend + $2,500 | Annuity payout + $${totalAnnuityPayout.toLocaleString()}`, 'success', 4000);
      } else {
        addToast('NIL stipend received + $2,500', 'success', 3000);
      }
    }
  };

  return (
    <section className="bg-white rounded-xl shadow-md p-4">
      <div className="flex justify-between items-center mb-2">
        <h3 className="text-lg font-semibold text-green-700">🏁 Progress</h3>
        <span className="text-sm text-gray-600">Lap {laps} of {totalLaps}</span>
      </div>

      <div className="flex gap-2">
        <button
          onClick={handleCompleteLap}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
          disabled={laps >= totalLaps}
        >
          Complete Lap
        </button>
      </div>
    </section>
  );
}

export default LapTracker;
