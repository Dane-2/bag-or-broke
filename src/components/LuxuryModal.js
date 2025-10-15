import React, { useState } from 'react';
import luxuryCards from '../data/luxuryCards';

function LuxuryModal({ onPurchase, onCancel, currentCash }) {
  const [cardId, setCardId] = useState('');
  const [cardData, setCardData] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState('cash');

  const handleScan = () => {
    const found = luxuryCards.find(card => card.id === cardId);
    if (found) {
      setCardData(found);
    } else {
      alert('Luxury card not found.');
    }
  };

  const handlePurchase = () => {
    if (!cardData) return;

    const cost = Number(cardData.cost);
    const resale = Number(cardData.resale);
    const rep = Number(cardData.rep);

    const borrowed = paymentMethod === 'finance';
    const interest = borrowed ? Math.floor(cost * 0.25) : 0;

    onPurchase?.({
      type: 'luxury',
      card: cardData.title,
      cost,
      resale,
      rep,
      borrowed,
      interest,
    });

    resetAndCancel();
  };

  const resetAndCancel = () => {
    setCardId('');
    setCardData(null);
    setPaymentMethod('cash');
    onCancel?.();
  };

  return (
    <div className="bg-white rounded-xl shadow-md p-4 space-y-4">
      <h3 className="text-lg font-semibold text-rose-700 mb-1">💎 Enter Luxury Card</h3>

      {!cardData ? (
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700">Enter Card ID:</label>
          <div className="flex gap-2">
            <input
              value={cardId}
              onChange={(e) => setCardId(e.target.value)}
              placeholder="e.g. L1"
              className="w-full px-4 py-2 border rounded-md shadow-sm focus:ring-2 focus:ring-rose-500 outline-none"
            />
            <button
              onClick={handleScan}
              className="bg-rose-600 text-white font-semibold px-4 rounded hover:bg-rose-700 transition"
            >
              Load Card
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="border-t border-gray-300 pt-2">
            <p className="text-sm text-gray-600"><strong>Card:</strong> {cardData.title}</p>
            <p className="text-sm text-gray-600"><strong>Cost:</strong> ${cardData.cost.toLocaleString()}</p>
            <p className="text-sm text-gray-600"><strong>Resale:</strong> ${cardData.resale.toLocaleString()}</p>
            <p className="text-sm text-gray-600"><strong>REP:</strong> +{cardData.rep}</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Payment Method:</label>
            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
              className="w-full px-4 py-2 border rounded-md shadow-sm focus:ring-2 focus:ring-rose-400 outline-none"
            >
              <option value="cash">Pay with Cash</option>
              <option value="finance">Finance (25% interest)</option>
            </select>
          </div>

          <button
            onClick={handlePurchase}
            className="w-full bg-green-600 text-white font-semibold py-2 rounded hover:bg-green-700 transition"
          >
            Confirm Purchase
          </button>

          <button
            onClick={resetAndCancel}
            className="w-full bg-gray-300 text-gray-800 font-semibold py-2 rounded hover:bg-gray-400 transition"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}

export default LuxuryModal;
