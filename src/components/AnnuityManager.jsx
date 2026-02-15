import React, { useState } from 'react';

function AnnuityManager({ investments, setInvestments, setCash, laps, addToast }) {
  const [selectedAnnuityIndex, setSelectedAnnuityIndex] = useState('');

  const annuities = investments.filter(inv => inv.investmentType === 'annuity');

  const selectedAnnuity = selectedAnnuityIndex !== ''
    ? annuities[parseInt(selectedAnnuityIndex, 10)]
    : null;

  const calculateSurrenderValue = (annuity) => {
    if (!annuity) return 0;
    
    const purchaseLap = annuity.purchaseLap || 0;
    const maturityLaps = annuity.maturityLaps || 0;
    const lapsSincePurchase = laps - purchaseLap;
    const isMatured = lapsSincePurchase >= maturityLaps;
    const cost = annuity.cost || 0;

    if (isMatured) {
      return Math.floor(cost * 0.80); // 80% after maturity
    } else {
      return Math.floor(cost * 0.50); // 50% before maturity
    }
  };

  const handleSurrender = () => {
    if (!selectedAnnuity) {
      addToast('Please select an annuity.', 'error');
      return;
    }

    const surrenderValue = calculateSurrenderValue(selectedAnnuity);
    const cost = selectedAnnuity.cost || 0;
    const surrenderLoss = cost - surrenderValue;
    const isMatured = selectedAnnuity.isMatured || false;

    // Remove annuity from investments
    setInvestments(prev => prev.filter(inv => 
      !(inv.investmentType === 'annuity' && 
        inv.cardId === selectedAnnuity.cardId &&
        investments.indexOf(inv) === parseInt(selectedAnnuityIndex, 10))
    ));

    // Add surrender value to cash
    setCash(prev => prev + surrenderValue);

    if (isMatured) {
      addToast(
        `Surrendered ${selectedAnnuity.cardTitle}. Received $${surrenderValue.toLocaleString()} (${surrenderLoss > 0 ? `Loss: $${surrenderLoss.toLocaleString()}` : 'No loss'})`,
        surrenderLoss > 0 ? 'warning' : 'success',
        4000
      );
    } else {
      addToast(
        `Surrendered ${selectedAnnuity.cardTitle} before maturity. Received $${surrenderValue.toLocaleString()} (Loss: $${surrenderLoss.toLocaleString()})`,
        'warning',
        4000
      );
    }

    // Reset selection
    setSelectedAnnuityIndex('');
  };

  if (annuities.length === 0) {
    return null;
  }

  return (
    <section className="bg-white rounded-xl shadow-md p-4">
      <h3 className="text-lg font-semibold text-purple-700 mb-2 flex items-center gap-2">
        💰 Annuity Manager
      </h3>

      <div className="space-y-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Select Annuity to Surrender:</label>
          <select
            value={selectedAnnuityIndex}
            onChange={(e) => setSelectedAnnuityIndex(e.target.value)}
            className="w-full px-4 py-2 border rounded-md shadow-sm focus:ring-2 focus:ring-purple-500"
          >
            <option value="">-- Select an annuity --</option>
            {annuities.map((annuity, idx) => {
              const purchaseLap = annuity.purchaseLap || 0;
              const maturityLaps = annuity.maturityLaps || 0;
              const lapsSincePurchase = laps - purchaseLap;
              const isMatured = lapsSincePurchase >= maturityLaps;
              const remainingLaps = Math.max(0, maturityLaps - lapsSincePurchase);
              
              return (
                <option key={idx} value={idx}>
                  {annuity.cardTitle} - {isMatured ? 'Matured' : `${remainingLaps} lap(s) to mature`} - Payout: ${(annuity.perLapPayout || 0).toLocaleString()}/lap
                </option>
              );
            })}
          </select>
        </div>

        {selectedAnnuity && (
          <div className="p-3 bg-purple-50 rounded-lg border border-purple-200">
            <p className="text-sm text-gray-700 mb-1">
              <strong>Purchase Cost:</strong> ${(selectedAnnuity.cost || 0).toLocaleString()}
            </p>
            <p className="text-sm text-gray-700 mb-1">
              <strong>Maturity:</strong> {selectedAnnuity.maturityLaps || 0} lap(s)
            </p>
            <p className="text-sm text-gray-700 mb-1">
              <strong>Status:</strong> {selectedAnnuity.isMatured ? '✅ Matured' : '⏳ Not Matured'}
            </p>
            {selectedAnnuity.isMatured && (
              <p className="text-sm text-gray-700 mb-1">
                <strong>Per-Lap Payout:</strong> ${(selectedAnnuity.perLapPayout || 0).toLocaleString()}
              </p>
            )}
            {selectedAnnuity.totalIncomeEarned > 0 && (
              <p className="text-sm text-gray-700 mb-1">
                <strong>Total Income Earned:</strong> ${selectedAnnuity.totalIncomeEarned.toLocaleString()}
              </p>
            )}
            <p className="text-sm font-semibold text-purple-700">
              <strong>Surrender Value:</strong> ${calculateSurrenderValue(selectedAnnuity).toLocaleString()}
            </p>
            {calculateSurrenderValue(selectedAnnuity) < (selectedAnnuity.cost || 0) && (
              <p className="text-xs text-red-600 mt-1">
                Surrender Loss: ${((selectedAnnuity.cost || 0) - calculateSurrenderValue(selectedAnnuity)).toLocaleString()}
              </p>
            )}
          </div>
        )}

        {selectedAnnuity && (
          <button
            onClick={handleSurrender}
            className="w-full bg-purple-600 text-white font-semibold py-2 rounded hover:bg-purple-700 transition"
          >
            Surrender Annuity
          </button>
        )}
      </div>
    </section>
  );
}

export default AnnuityManager;
