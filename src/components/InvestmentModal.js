import React, { useState } from 'react';
import investmentCards from '../data/investments';

const glassPanel =
  'rounded-2xl bg-white/20 backdrop-blur-lg border border-white/30 shadow-lg';

function CardModal({ onApply, onCancel, currentCash }) {
  const [cardId, setCardId] = useState('');
  const [cardData, setCardData] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [diceRoll, setDiceRoll] = useState('');

  const handleScan = () => {
    const found = investmentCards.find(card => card.id === cardId);
    if (found) {
      setCardData(found);
    } else {
      alert('Card not found.');
    }
  };

  const handleSubmit = () => {
    if (!cardData || !diceRoll) return;

    const rollIndex = parseInt(diceRoll, 10) - 1;
    const risk = cardData.availableRisks[0];
    const roiTable = cardData.roiTables[risk];

    const percent = roiTable[rollIndex];
    const cost = cardData.cost;

    const borrowed = paymentMethod === 'finance';
    const interest = borrowed ? Math.floor(cost * 0.25) : 0;
    const result = Math.floor((percent / 100) * cost);
    const newValue = cost + result;

    onApply({
      card: cardData.title,
      cost,
      result,
      newValue,
      percent,
      borrowed,
      interest
    });

    resetAndCancel();
  };

  const resetAndCancel = () => {
    setCardId('');
    setCardData(null);
    setPaymentMethod('cash');
    setDiceRoll('');
    if (onCancel) onCancel();
  };

  return (
    <div className={`${glassPanel} p-4 md:p-6 space-y-5`}>
      <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-800">📦 Enter investment card</h3>
      {typeof currentCash === 'number' && (
        <p className="text-xs text-slate-700">Cash on hand: ${currentCash.toLocaleString()}</p>
      )}

      {!cardData ? (
        <div className="space-y-4">
          <label className="block text-xs font-semibold uppercase tracking-wide text-slate-600">Card ID</label>
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              value={cardId}
              onChange={(e) => setCardId(e.target.value)}
              placeholder="e.g. I1"
              className="flex-1 px-4 py-3 rounded-2xl border border-white/40 bg-white/25 backdrop-blur-md text-slate-900 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-400/80"
            />
            <button
              type="button"
              onClick={handleScan}
              className="px-5 py-3 rounded-2xl bg-gradient-to-r from-sky-500 to-blue-600 text-white font-semibold shadow-lg shadow-blue-500/25 hover:from-sky-600 hover:to-blue-700 transition shrink-0"
            >
              Play card
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-5">
          <div className="border-t border-white/30 pt-4 space-y-1">
            <p className="text-sm text-slate-800"><span className="font-semibold">Card:</span> {cardData.title}</p>
            <p className="text-sm text-slate-700"><span className="font-semibold">Cost:</span> ${cardData.cost.toLocaleString()}</p>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-600 mb-2">Payment method</label>
            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
              className="w-full px-4 py-3 rounded-2xl border border-white/40 bg-white/25 text-slate-900"
            >
              <option value="cash">Pay with Cash</option>
              <option value="finance">Finance (25% interest)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-600 mb-2">What did you roll?</label>
            <select
              value={diceRoll}
              onChange={(e) => setDiceRoll(e.target.value)}
              className="w-full px-4 py-3 rounded-2xl border border-white/40 bg-white/25 text-slate-900"
            >
              <option value="">--</option>
              {[1, 2, 3, 4, 5, 6].map(num => (
                <option key={num} value={num}>{num}</option>
              ))}
            </select>
          </div>

          <button
            type="button"
            onClick={handleSubmit}
            className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-emerald-500 to-green-600 text-white font-semibold shadow-lg shadow-emerald-500/25 hover:from-emerald-600 hover:to-green-700 transition"
          >
            Apply investment result
          </button>

          <button
            type="button"
            onClick={resetAndCancel}
            className="w-full py-3 rounded-2xl bg-white/25 border border-white/40 text-slate-800 font-semibold hover:bg-white/35 transition"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}

export default CardModal;
