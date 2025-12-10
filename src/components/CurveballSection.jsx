import React from 'react';

function CurveballSection({ curveballs, setCurveballs, setCash, setRep, setShadyDebt, onCurveballLoss, redCurveballLoss = 0, blueCurveballLoss = 0 }) {
  const totalLoss = redCurveballLoss + blueCurveballLoss;

  return (
    <section className="bg-white rounded-xl shadow-md p-4">
      <h3 className="text-lg font-semibold text-red-600 mb-2 flex items-center gap-2">
        ❌ Curveballs
      </h3>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          const redVal = e.target.redCurveball.value;
          const blueVal = e.target.blueCurveball.value;
          const selected = redVal || blueVal;
          if (!selected) return;

          const [desc, amountStr, effect] = selected.split('|');
          const amount = parseInt(amountStr, 10);
          const type = redVal ? 'red' : 'blue'; // Track if it's a red (financial) or blue (life) curveball

          if (effect === 'cash' && amount > 0) {
            setCash((c) => c - amount);
            // Track curveball loss
            if (onCurveballLoss) {
              onCurveballLoss(type, amount);
            }
          }
          if (effect === 'rep') setRep((r) => Math.max(0, r - amount));
          if (effect === 'shady') {
            setCash((c) => c + 25000);
            setShadyDebt((s) => s + 40000);
            // Shady deals are financial (red) curveballs
            if (onCurveballLoss) {
              onCurveballLoss('red', 40000);
            }
          }

          setCurveballs((prev) => [...prev, { desc, amount, effect, type }]);
          e.target.reset();
        }}
        className="space-y-3"
      >
        <div className="flex gap-2">
          <select name="redCurveball" className="w-1/2 px-4 py-2 border rounded-md shadow-sm bg-red-100">
            <option value="">Select Financial</option>
            <option value="Pay Your Taxes – Lose $15,000|15000|cash">Pay Your Taxes – Lose $15,000</option>
            <option value="IRS Audit – Lose $25,000|25000|cash">IRS Audit – Lose $25,000</option>
            <option value="Credit Card Debt Hits – Lose $10,000|10000|cash">Credit Card Debt Hits – Lose $10,000</option>
            <option value="Last-Minute NIL Lawsuit – Pay $35,000|35000|cash">Last-Minute NIL Lawsuit – Pay $35,000</option>
            <option value="NIL Contract Scam – Lose $15,000|15000|cash">NIL Contract Scam – Lose $15,000</option>
            <option value="Market Crash – Lose $25,000|25000|cash">Market Crash – Lose $25,000</option>
            <option value="Shady Business Deal – Gain $25K Now, Owe $40K Later|40000|shady">Shady Business Deal – Gain $25K Now, Owe $40K Later</option>
          </select>

          <select name="blueCurveball" className="w-1/2 px-4 py-2 border rounded-md shadow-sm bg-blue-100">
            <option value="">Select Life</option>
            <option value="Transfer Portal Chaos – Lose $30,000|30000|cash">Transfer Portal Chaos – Lose $30,000</option>
            <option value="Unexpected Pregnancy – Lose $25,000|25000|cash">Unexpected Pregnancy – Lose $25,000</option>
            <option value="Family Emergency – Lose $10,000|10000|cash">Family Emergency – Lose $10,000</option>
            <option value="Season-Ending Injury – Lose $40,000|40000|cash">Season-Ending Injury – Lose $40,000</option>
          </select>
        </div>

        <button
          type="submit"
          className="w-full bg-red-600 text-white font-semibold py-2 rounded hover:bg-red-700 transition"
        >
          Add Curveball
        </button>
      </form>

      {curveballs.length > 0 && (
        <>
          {totalLoss > 0 && (
            <div className="mt-4 mb-2">
              <p className="text-sm font-semibold text-red-700">
                Total Lost: ${totalLoss.toLocaleString()}
              </p>
            </div>
          )}
          <ul className="mt-2 text-sm text-gray-700 space-y-1">
            {curveballs.map((c, idx) => (
              <li key={idx}>
                <span className="font-semibold text-red-600">{c.desc}</span>
                {c.effect === 'cash' && <>: -${c.amount.toLocaleString()}</>}
                {c.effect === 'rep' && <>: -{c.amount} REP</>}
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

export default CurveballSection;
