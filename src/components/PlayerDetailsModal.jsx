import React from "react";

export default function PlayerDetailsModal({ player, onClose }) {
  if (!player) return null;

  let investments = [];
  let luxuries = [];

  try {
    // Handle both parsed arrays and JSON strings
    if (Array.isArray(player.investments)) {
      investments = player.investments;
    } else if (typeof player.investments === 'string') {
      investments = JSON.parse(player.investments || "[]");
    }
    
    if (Array.isArray(player.luxuries)) {
      luxuries = player.luxuries;
    } else if (typeof player.luxuries === 'string') {
      luxuries = JSON.parse(player.luxuries || "[]");
    }
  } catch (e) {
    console.error("Error parsing player investments/luxuries:", e);
    investments = Array.isArray(player.investments) ? player.investments : [];
    luxuries = Array.isArray(player.luxuries) ? player.luxuries : [];
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl p-6 w-[90%] max-w-md shadow-xl space-y-4">
        <h2 className="text-xl font-bold text-gray-800 text-center">
          {player.name}'s Cards
        </h2>

        <div>
          <h3 className="font-semibold text-blue-700 mb-1">Investments</h3>
          {investments.length === 0 ? (
            <p className="text-gray-500 text-sm">No investments yet</p>
          ) : (
            <ul className="space-y-1">
              {investments.map((inv, i) => (
                <li
                  key={i}
                  className="p-2 bg-blue-50 border border-blue-200 rounded"
                >
                  {inv.cardTitle} — ${inv.cost}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div>
          <h3 className="font-semibold text-purple-700 mb-1">Luxuries</h3>
          {luxuries.length === 0 ? (
            <p className="text-gray-500 text-sm">No luxuries yet</p>
          ) : (
            <ul className="space-y-1">
              {luxuries.map((lux, i) => (
                <li
                  key={i}
                  className="p-2 bg-purple-50 border border-purple-200 rounded"
                >
                  {lux.name} — ${lux.cost} (+{lux.rep} REP)
                </li>
              ))}
            </ul>
          )}
        </div>

        <button
          className="w-full bg-gray-200 rounded-md py-2 font-semibold hover:bg-gray-300"
          onClick={onClose}
        >
          Close
        </button>
      </div>
    </div>
  );
}
