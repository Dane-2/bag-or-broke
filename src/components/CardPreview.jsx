// CardPreview.jsx
export default function CardPreview({ card, onSelect }) {
  return (
    <div className="border rounded-xl p-4 shadow-sm hover:shadow-md transition">
      <h3 className="font-bold text-lg">{card.title}</h3>
      <p className="text-sm text-gray-600">Category: {card.category}</p>
      <p className="mt-1">Cost: ${card.cost.toLocaleString()}</p>
      {card.rep !== undefined && <p>REP: +{card.rep}</p>}
      {card.availableRisks && (
        <p className="text-sm text-gray-500">Risk: {card.availableRisks.join(', ')}</p>
      )}
      <button
        onClick={() => onSelect(card)}
        className="mt-2 px-3 py-1 bg-green-600 text-white rounded-full text-sm"
      >
        Select
      </button>
    </div>
  );
}
