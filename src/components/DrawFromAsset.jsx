import React, { useState } from 'react';

function DrawFromAsset({ investments, setInvestments, cash, setCash }) {
  const [selectedInvestmentIdx, setSelectedInvestmentIdx] = useState(null);
  const [drawAmount, setDrawAmount] = useState('');
  const [showChoice, setShowChoice] = useState(false);
  const [pendingDraw, setPendingDraw] = useState(null);

  // Filter to only show completed investments (investments that have been made)
  const availableInvestments = investments.filter(inv => inv && inv.newValue);

  const handleSelectInvestment = (idx) => {
    setSelectedInvestmentIdx(idx);
    setDrawAmount('');
    setShowChoice(false);
    setPendingDraw(null);
  };

  const calculateMaxDraw = (investment) => {
    if (!investment) return 0;
    // Can draw up to a percentage of the ROI (result field)
    // The result is the ROI gain amount
    const roiGain = investment.result || (investment.newValue - investment.cost);
    // Allow drawing up to 100% of the ROI gain
    return Math.max(0, roiGain);
  };

  const handleDraw = () => {
    if (selectedInvestmentIdx === null || !drawAmount) return;
    
    const investment = investments[selectedInvestmentIdx];
    if (!investment) return;

    const amount = parseInt(drawAmount.replace(/,/g, ''), 10);
    if (isNaN(amount) || amount <= 0) {
      alert('Please enter a valid amount');
      return;
    }

    const maxDraw = calculateMaxDraw(investment);
    if (amount > maxDraw) {
      alert(`You can only draw up to $${maxDraw.toLocaleString()} (100% of ROI gain)`);
      return;
    }

    // Store the pending draw and show choice
    setPendingDraw({ investmentIdx: selectedInvestmentIdx, amount });
    setShowChoice(true);
  };

  const handleKeep = () => {
    if (!pendingDraw) return;

    const { investmentIdx, amount } = pendingDraw;
    const investment = investments[investmentIdx];

    // Add cash
    setCash((prev) => prev + amount);

    // Reduce the investment's newValue by the drawn amount
    setInvestments((prev) => {
      const updated = [...prev];
      const newValue = Math.max(updated[investmentIdx].cost, updated[investmentIdx].newValue - amount);
      const newResult = newValue - updated[investmentIdx].cost;
      
      updated[investmentIdx] = {
        ...updated[investmentIdx],
        newValue: newValue,
        result: newResult,
      };
      
      // Recalculate percent
      if (updated[investmentIdx].cost > 0) {
        updated[investmentIdx].percent = Math.round(
          (newResult / updated[investmentIdx].cost) * 100
        );
      }
      return updated;
    });

    // Reset state
    setSelectedInvestmentIdx(null);
    setDrawAmount('');
    setShowChoice(false);
    setPendingDraw(null);
  };

  const handleReinvest = () => {
    if (!pendingDraw) return;

    const { amount } = pendingDraw;

    // Add cash but don't reduce investment value
    setCash((prev) => prev + amount);

    // Reset state
    setSelectedInvestmentIdx(null);
    setDrawAmount('');
    setShowChoice(false);
    setPendingDraw(null);
  };

  const selectedInvestment = selectedInvestmentIdx !== null ? investments[selectedInvestmentIdx] : null;
  const maxDraw = selectedInvestment ? calculateMaxDraw(selectedInvestment) : 0;

  return (
    <section className="bg-white rounded-xl shadow-md p-4">
      <h3 className="text-lg font-semibold text-purple-700 mb-2 flex items-center gap-2">
        💰 Draw from Asset
      </h3>

      {availableInvestments.length === 0 ? (
        <p className="text-gray-500 text-sm">No completed investments available to draw from.</p>
      ) : (
        <>
          {!showChoice ? (
            <>
              {/* Investment Selection */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select Investment:
                </label>
                <select
                  value={selectedInvestmentIdx !== null ? selectedInvestmentIdx : ''}
                  onChange={(e) => handleSelectInvestment(e.target.value ? parseInt(e.target.value, 10) : null)}
                  className="w-full px-4 py-2 border rounded-md shadow-sm focus:ring-2 focus:ring-purple-500 outline-none"
                >
                  <option value="">-- Select an investment --</option>
                  {availableInvestments.map((inv, idx) => {
                    const actualIdx = investments.findIndex(i => i === inv);
                    const roiGain = inv.result || (inv.newValue - inv.cost);
                    return (
                      <option key={actualIdx} value={actualIdx}>
                        {inv.cardTitle || inv.card} - Current Value: ${inv.newValue.toLocaleString()} (ROI Gain: ${roiGain.toLocaleString()})
                      </option>
                    );
                  })}
                </select>
              </div>

              {selectedInvestment && (
                <>
                  <div className="mb-4 p-3 bg-purple-50 rounded-lg border border-purple-200">
                    <p className="text-sm text-gray-700">
                      <strong>Investment:</strong> {selectedInvestment.cardTitle || selectedInvestment.card}
                    </p>
                    <p className="text-sm text-gray-700">
                      <strong>Current Value:</strong> ${selectedInvestment.newValue.toLocaleString()}
                    </p>
                    <p className="text-sm text-gray-700">
                      <strong>ROI Gain:</strong> ${(selectedInvestment.result || (selectedInvestment.newValue - selectedInvestment.cost)).toLocaleString()}
                    </p>
                    <p className="text-sm font-semibold text-purple-700 mt-1">
                      Max Draw: ${maxDraw.toLocaleString()}
                    </p>
                  </div>

                  {/* Draw Amount Input */}
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Amount to Draw:
                    </label>
                    <input
                      type="text"
                      value={drawAmount}
                      onChange={(e) => {
                        const value = e.target.value.replace(/[^0-9]/g, '');
                        setDrawAmount(value);
                      }}
                      placeholder={`Max: $${maxDraw.toLocaleString()}`}
                      className="w-full px-4 py-2 border rounded-md shadow-sm focus:ring-2 focus:ring-purple-500 outline-none"
                    />
                  </div>

                  <button
                    onClick={handleDraw}
                    disabled={!drawAmount || parseInt(drawAmount.replace(/,/g, ''), 10) <= 0 || parseInt(drawAmount.replace(/,/g, ''), 10) > maxDraw}
                    className="w-full bg-purple-600 text-white font-semibold py-2 rounded hover:bg-purple-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Draw from Asset
                  </button>
                </>
              )}
            </>
          ) : (
            /* Choice: Keep or Reinvest */
            <div className="space-y-4">
              <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <p className="text-sm font-semibold text-yellow-800 mb-2">
                  You've drawn ${pendingDraw?.amount.toLocaleString()} from your investment.
                </p>
                <p className="text-sm text-yellow-700">
                  Choose what to do with this money:
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={handleKeep}
                  className="bg-red-600 text-white font-semibold py-3 px-4 rounded hover:bg-red-700 transition"
                >
                  <div className="text-sm font-bold">Keep Money</div>
                  <div className="text-xs mt-1 opacity-90">Reduces asset value</div>
                </button>

                <button
                  onClick={handleReinvest}
                  className="bg-green-600 text-white font-semibold py-3 px-4 rounded hover:bg-green-700 transition"
                >
                  <div className="text-sm font-bold">Reinvest</div>
                  <div className="text-xs mt-1 opacity-90">No penalty</div>
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
}

export default DrawFromAsset;

