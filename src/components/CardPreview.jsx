import React from 'react';

export default function CardPreview({ card, onSelect }) {
  const isInvestment = card.roiTables !== undefined;

  return (
    <div
      className="border rounded-lg p-4 bg-white hover:shadow-md cursor-pointer transition"
      onClick={() => onSelect(card)}
    >
      <h3 className="text-md font-semibold text-gray-800">{card.title}</h3>
      <p className="text-sm text-gray-600">Cost: ${card.cost.toLocaleString()}</p>

      {isInvestment ? (
        <p className="text-xs text-blue-600 mt-1">
          Risk: {card.availableRisks?.[0] || 'N/A'}
        </p>
      ) : (
        <p className="text-xs text-pink-600 mt-1">
          REP: +{card.rep}
        </p>
      )}

      <p className="text-xs text-gray-500 mt-1">
        Category: {card.category}
      </p>
    </div>
  );
}
