import React from 'react';

function FinalNetWorth({ cash, luxuries, rep, career, credit, debt, curveballs, playerName, showFinal, shadyDebt, investments, isGeneratingSummary }) {
  const luxuryResale = luxuries.reduce((acc, item) => acc + item.resale, 0);
  // Calculate Total Asset Value: sum of all investment current values (newValue)
  const totalAssetValue = investments.reduce((acc, inv) => acc + (inv.newValue || 0), 0);
  const repValue = rep * 2500;
  const careerValue = career * 5000;
  const creditBonus = credit >= 700 ? 10000 : credit >= 600 ? 5000 : credit >= 500 ? 2000 : 0;
  const netWorth = cash + totalAssetValue + luxuryResale + repValue + careerValue + creditBonus - debt - (shadyDebt || 0);

  const curveballLoss = curveballs.reduce((acc, c) => acc + c.amount, 0);
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
        </ul>
        <h4 className="text-xl font-bold mt-3">Net Worth: ${netWorth.toLocaleString()}</h4>
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
