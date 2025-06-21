import React, { useState } from 'react';
import  luxuryCards  from '../data/luxuryCards';

function LuxuryModal({ currentCash, onPurchase }) {
  const [cardId, setCardId] = useState('');
  const [cardData, setCardData] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState('cash');

  const handleScan = () => {
    const found = luxuryCards.find(card => card.id === cardId);
    if (found) {
      setCardData(found);
    } else {
      alert('Card not found.');
    }
  };

  const handleBuy = () => {
    if (!cardData) return;

    const cost = cardData.cost;
    const interest = Math.floor(cost * 0.25);
    const borrowed = paymentMethod === 'finance';

    if (!borrowed && currentCash < cost) {
      alert("Not enough cash to buy this luxury.");
      return;
    }

    onPurchase({
      card: cardData.title,
      cost,
      resale: cardData.resale,
      rep: cardData.rep,
      borrowed,
      interest
    });

    setCardId('');
    setCardData(null);
    setPaymentMethod('cash');
  };

  return (
    <div className="bg-white rounded-xl shadow-md p-4 space-y-4">
      <h3 className="text-lg font-semibold text-pink-600 mb-1">💎 Luxury Card Scanner</h3>

      {!cardData ? (
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700">Enter Card ID (simulate scan):</label>
          <div className="flex gap-2">
            <input
              value={cardId}
              onChange={(e) => setCardId(e.target.value)}
              placeholder="e.g. LUX001"
              className="w-full px-4 py-2 border rounded-md shadow-sm focus:ring-2 focus:ring-pink-500 outline-none"
            />
            <button
              onClick={handleScan}
              className="bg-pink-600 text-white font-semibold px-4 rounded hover:bg-pink-700 transition"
            >
              Scan
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-3 border-t border-gray-300 pt-2 text-sm text-gray-800">
          <p><strong>Title:</strong> {cardData.title}</p>
          <p><strong>Cost:</strong> ${cardData.cost.toLocaleString()}</p>
          <p><strong>Resale:</strong> ${cardData.resale.toLocaleString()}</p>
          <p><strong>REP:</strong> +{cardData.rep}</p>
          <p><strong>Category:</strong> {cardData.category}</p>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Payment Method:</label>
            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
              className="w-full px-4 py-2 border rounded-md shadow-sm focus:ring-2 focus:ring-pink-500 outline-none"
            >
              <option value="cash">Pay with Cash</option>
              <option value="finance">Finance (25% interest)</option>
            </select>
          </div>

          <button
            onClick={handleBuy}
            className="w-full bg-pink-600 text-white font-semibold py-2 mt-2 rounded hover:bg-pink-700 transition"
          >
            Buy Luxury
          </button>
        </div>
      )}
    </div>
  );
}

export default LuxuryModal;
