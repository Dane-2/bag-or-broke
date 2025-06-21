import React, { useState } from 'react';
import  investmentCards  from '../data/investments';

function CardModal({ onApply, currentCash }) {
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
    const invested = cost + interest;
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

    setCardId('');
    setCardData(null);
    setPaymentMethod('cash');
    setDiceRoll('');
  };

  return (
    <div className="bg-white rounded-xl shadow-md p-4 space-y-4">
      <h3 className="text-lg font-semibold text-blue-700 mb-1">📦 Investment Card Scanner</h3>

      {!cardData ? (
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700">Enter Card ID (simulate scan):</label>
          <div className="flex gap-2">
            <input
              value={cardId}
              onChange={(e) => setCardId(e.target.value)}
              placeholder="e.g. INV001"
              className="w-full px-4 py-2 border rounded-md shadow-sm focus:ring-2 focus:ring-blue-500 outline-none"
            />
            <button
              onClick={handleScan}
              className="bg-blue-600 text-white font-semibold px-4 rounded hover:bg-blue-700 transition"
            >
              Scan
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="border-t border-gray-300 pt-2">
            <p className="text-sm text-gray-600">
              <strong>Card:</strong> {cardData.title}
            </p>
            <p className="text-sm text-gray-600">
              <strong>Cost:</strong> ${cardData.cost.toLocaleString()}
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Payment Method:</label>
            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
              className="w-full px-4 py-2 border rounded-md shadow-sm focus:ring-2 focus:ring-purple-500 outline-none"
            >
              <option value="cash">Pay with Cash</option>
              <option value="finance">Finance (25% interest)</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">What did you roll?</label>
            <select
              value={diceRoll}
              onChange={(e) => setDiceRoll(e.target.value)}
              className="w-full px-4 py-2 border rounded-md shadow-sm focus:ring-2 focus:ring-green-500 outline-none"
            >
              <option value="">--</option>
              {[1, 2, 3, 4, 5, 6].map(num => (
                <option key={num} value={num}>{num}</option>
              ))}
            </select>
          </div>

          <button
            onClick={handleSubmit}
            className="w-full bg-green-600 text-white font-semibold py-2 rounded hover:bg-green-700 transition"
          >
            Apply Investment Result
          </button>
        </div>
      )}
    </div>
  );
}

export default CardModal;
