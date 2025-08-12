import React from 'react';

function InvestmentLog({ investments, setInvestments, setCash }) {
  const handleSell = (idx) => {
    const investment = investments[idx];
    setCash((prev) => prev + investment.newValue);
    setInvestments((prev) => prev.filter((_, i) => i !== idx));
    alert(`${investment.cardTitle} sold for $${investment.newValue.toLocaleString()}`);
  };

  return (
    <section className="bg-white rounded-xl shadow-md p-4">
      <h3 className="text-lg font-semibold text-blue-700 mb-2">📈 Investments</h3>
      {investments.length === 0 ? (
        <p className="text-gray-500">No investments yet</p>
      ) : (
        <ul className="space-y-1 text-sm text-gray-700">
          {investments.map((inv, idx) => (
            <li
              key={idx}
              className="flex justify-between items-center border-b pb-1"
            >
              <span>
                {inv.cardTitle} → Roll: {inv.diceRoll} 🎲 → ROI: {inv.percent}% → Value: ${inv.newValue.toLocaleString()}
              </span>
              <button
                onClick={() => handleSell(idx)}
                className="ml-2 bg-green-600 text-white px-2 py-1 rounded text-xs hover:bg-green-700"
              >
                Sell
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default InvestmentLog;
