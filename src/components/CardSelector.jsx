import { useState } from 'react';
import CardPreview from './CardPreview';
import investmentCards from '../data/investments';
import luxuryCards from '../data/luxuryCards';

const tabs = {
  investment: [
    'All', 'Real Estate', 'E-Commerce', 'Crypto/Web3', 'Fitness/Health',
    'Content/Media', 'NIL Education', 'Food & Hospitality', 'Fashion',
    'Marketing/Ads', 'Developer Tools', 'Music/Creative', 'Support Services',
    'Branding/Growth', 'NIL Community'
  ],
  luxury: [
    'All', 'Style', 'Vehicle', 'Event', 'Travel', 'Lifestyle',
    'Career/Brand', 'Business/Flex', 'Social Flex', 'Brand/Flex',
    'Flex/Travel', 'Content', 'Style/Flex', 'Brand/Image', 'Flex/Marketing',
    'Style/Brand'
  ]
};

export default function CardSelector({ type, onSelect }) {
  const [activeTab, setActiveTab] = useState('All');
  const [selectedCard, setSelectedCard] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [diceRoll, setDiceRoll] = useState('');

  const cards = type === 'investment' ? investmentCards : luxuryCards;
  const filtered = cards.filter((card) =>
    activeTab === 'All' ? true : card.category.includes(activeTab)
  );

  const handleCardClick = (card) => {
    if (type === 'investment') {
      setSelectedCard(card);
      setPaymentMethod('cash');
      setDiceRoll('');
      return;
    }

    // Luxury card
    if (onSelect) {
      onSelect({
        type: 'luxury',
        cardTitle: card.title,
        cost: card.cost,
        resale: card.resale,
        rep: card.rep,
      });
    }
  };

  const cancelApply = () => {
    setSelectedCard(null);
    setPaymentMethod('cash');
    setDiceRoll('');
  };

  const applyInvestment = () => {
    if (!selectedCard || !diceRoll) return;

    const risk = selectedCard.availableRisks?.[0];
    const rollIndex = parseInt(diceRoll, 10) - 1;
    const roiTable = selectedCard.roiTables?.[risk] || [];
    const percent = roiTable[rollIndex];

    if (typeof percent !== 'number') {
      console.warn('Invalid ROI lookup for', { risk, rollIndex, roiTable, card: selectedCard });
      return;
    }

    const cost = selectedCard.cost;
    const result = Math.floor((percent / 100) * cost);
    const newValue = cost + result;
    const borrowed = paymentMethod === 'finance';
    const interest = borrowed ? Math.floor(cost * 0.25) : 0;

    if (onSelect) {
      onSelect({
        type: 'investment',
        cardTitle: selectedCard.title,
        cost,
        borrowed,
        interest,
        diceRoll: parseInt(diceRoll, 10),
        percent,
        result,
        newValue
      });
    }

    cancelApply();
  };

  return (
    <div className="space-y-4">
      {/* Tabs */}
      <div className="flex flex-wrap gap-2">
        {tabs[type].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-3 py-1 rounded-full border text-sm ${
              activeTab === tab ? 'bg-black text-white' : 'bg-white text-black'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
        {filtered.map((card) => (
          <CardPreview key={card.id} card={card} onSelect={handleCardClick} />
        ))}
      </div>

      {/* Investment Apply Panel */}
      {type === 'investment' && selectedCard && (
        <div className="mt-2 rounded-xl border shadow-sm bg-white">
          <div className="p-4 space-y-3">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-base font-semibold">
                  Play Investment: <span className="text-blue-700">{selectedCard.title}</span>
                </h3>
                <p className="text-sm text-gray-600">Cost: ${selectedCard.cost.toLocaleString()}</p>
                <p className="text-sm text-gray-600">Risk: <strong>{selectedCard.availableRisks?.[0] || '—'}</strong></p>
              </div>
              <button
                onClick={cancelApply}
                className="text-sm px-3 py-1 rounded-md bg-gray-200 hover:bg-gray-300"
              >
                Close
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-sm font-medium mb-1">Payment Method</label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="w-full px-3 py-2 border rounded-md"
                >
                  <option value="cash">Pay with Cash</option>
                  <option value="finance">Finance (25% interest)</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Dice Roll (1–6)</label>
                <select
                  value={diceRoll}
                  onChange={(e) => setDiceRoll(e.target.value)}
                  className="w-full px-3 py-2 border rounded-md"
                >
                  <option value="">--</option>
                  {[1, 2, 3, 4, 5, 6].map((n) => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">ROI Table</label>
                <div className="text-xs text-gray-700 border rounded-md p-2">
                  {(selectedCard.roiTables?.[selectedCard.availableRisks?.[0]] || [])
                    .map((p, i) => `Roll ${i + 1}: ${p}%`)
                    .join('  •  ')}
                </div>
              </div>
            </div>

            <div className="flex gap-3 pt-1">
              <button
                onClick={applyInvestment}
                className="px-4 py-2 rounded-md bg-green-600 text-white font-semibold hover:bg-green-700"
              >
                Apply Investment Result
              </button>
              <button
                onClick={cancelApply}
                className="px-4 py-2 rounded-md bg-gray-200 hover:bg-gray-300"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
