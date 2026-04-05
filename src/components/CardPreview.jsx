import React from 'react';

export default function CardPreview({ card, onSelect, isSelected = false, isDisabled = false }) {
  const isInvestment = card.roiTables !== undefined;

  return (
    <div
      className={`rounded-2xl p-4 border transition-all duration-200 ${
        isDisabled
          ? 'border-white/20 bg-white/10 opacity-50 cursor-not-allowed'
          : isSelected
            ? 'border-emerald-400/80 bg-gradient-to-br from-white/35 to-emerald-100/30 shadow-lg shadow-emerald-500/15 ring-2 ring-emerald-400/50 cursor-pointer backdrop-blur-md'
            : 'border-white/35 bg-white/15 hover:bg-white/25 hover:border-white/50 cursor-pointer backdrop-blur-md shadow-md'
      }`}
      onClick={() => !isDisabled && onSelect(card)}
    >
      <h3 className="text-sm font-bold text-slate-900 leading-snug">{card.title}</h3>
      <p className="text-xs text-slate-700 mt-2 font-medium">Cost: ${card.cost.toLocaleString()}</p>

      {isInvestment ? (
        <p className="text-xs text-emerald-800 font-semibold mt-1">
          Risk: {card.availableRisks?.[0] || 'N/A'}
        </p>
      ) : (
        <p className="text-xs text-amber-800 font-semibold mt-1">
          REP: +{card.rep}
        </p>
      )}

      <p className="text-[11px] text-slate-600 mt-2 leading-tight">
        {card.category}
      </p>
    </div>
  );
}
