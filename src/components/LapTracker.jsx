import React from 'react';

function LapTracker({
  laps,
  totalLaps,
  setLaps,
  investments,
  setInvestments,
  setCash,
  addToast,
  embedded = false,
}) {
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

  const pct = totalLaps > 0 ? Math.min(100, Math.round((laps / totalLaps) * 100)) : 0;

  const inner = (
    <>
      <div className="flex justify-between items-center mb-3 gap-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-700/80 flex items-center gap-2">
          <span aria-hidden>🏁</span> Game progress
        </h3>
        <span className="text-sm font-semibold text-slate-800 tabular-nums">
          Lap {laps} / {totalLaps}
        </span>
      </div>

      <div className="h-3 rounded-full bg-white/30 overflow-hidden border border-white/25 mb-4">
        <div
          className="h-full rounded-full bg-gradient-to-r from-violet-500 via-fuchsia-500 to-cyan-400 transition-all duration-500 ease-out shadow-sm"
          style={{ width: `${pct}%` }}
        />
      </div>

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={handleCompleteLap}
          className="rounded-full px-5 py-2.5 bg-gradient-to-r from-sky-600 to-blue-600 text-white text-sm font-semibold shadow-lg shadow-blue-600/30 hover:from-sky-700 hover:to-blue-700 disabled:opacity-45 disabled:pointer-events-none transition"
          disabled={laps >= totalLaps}
        >
          Complete Lap
        </button>
      </div>
    </>
  );

  if (embedded) {
    return <div className="space-y-0">{inner}</div>;
  }

  return (
    <section className="rounded-2xl bg-white/20 backdrop-blur-lg border border-white/30 shadow-lg p-4 md:p-6">
      {inner}
    </section>
  );
}

export default LapTracker;
