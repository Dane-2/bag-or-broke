import React, { useState } from 'react';
import CardSelector from './CardSelector';
import investmentCards from '../data/investments';
import luxuryCards from '../data/luxuryCards';

function CategoryPicker({
  cash,
  setCash,
  setInvestments,
  setRep,
  setLuxuries
}) {
  const [showInvestment, setShowInvestment] = useState(false);
  const [showLuxury, setShowLuxury] = useState(false);

  const handleInvestmentSelect = (card) => {
    setCash(prev => prev - card.cost);
    setInvestments(prev => [
      ...prev,
      { card: card.title, cost: card.cost, percent: 0, newValue: card.cost }
    ]);
    setShowInvestment(false);
  };

  const handleLuxurySelect = (card) => {
    setCash(prev => prev - card.cost);
    setRep(prev => prev + card.rep);
    setLuxuries(prev => [
      ...prev,
      { name: card.title, resale: card.resale, rep: card.rep }
    ]);
    setShowLuxury(false);
  };

  return (
    <section className="bg-white rounded-xl shadow-md p-4 space-y-4">
      <div>
        <button
          onClick={() => setShowInvestment(!showInvestment)}
          className="w-full bg-blue-700 text-white px-4 py-2 rounded hover:bg-blue-800"
        >
          🎯 Pick Investment {showInvestment ? '▲' : '▼'}
        </button>
        {showInvestment && (
          <div className="mt-4">
            <CardSelector
              type="investment"
              cards={investmentCards}
              onSelect={handleInvestmentSelect}
            />
          </div>
        )}
      </div>

      <div>
        <button
          onClick={() => setShowLuxury(!showLuxury)}
          className="w-full bg-pink-600 text-white px-4 py-2 rounded hover:bg-pink-700"
        >
          💎 Pick Luxury {showLuxury ? '▲' : '▼'}
        </button>
        {showLuxury && (
          <div className="mt-4">
            <CardSelector
              type="luxury"
              cards={luxuryCards}
              onSelect={handleLuxurySelect}
            />
          </div>
        )}
      </div>
    </section>
  );
}

export default CategoryPicker;
