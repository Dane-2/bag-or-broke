import React from 'react';

function LuxuryLog({ luxuries, setLuxuries, setCash, setRep }) {
  const handleResell = (idx) => {
    const item = luxuries[idx];
    setCash((prev) => prev + item.resale);
    setRep((prev) => Math.max(prev - item.rep, 0));
    setLuxuries((prev) => prev.filter((_, i) => i !== idx));
    alert(`${item.name} resold for $${item.resale.toLocaleString()} (–${item.rep} REP)`);
  };

  return (
    <section className="bg-white rounded-xl shadow-md p-4">
      <h3 className="text-lg font-semibold text-pink-600 mb-2">💎 Luxuries</h3>
      {luxuries.length === 0 ? (
        <p className="text-gray-500">No luxury items owned</p>
      ) : (
        <ul className="space-y-1 text-sm text-gray-700">
          {luxuries.map((lux, idx) => (
            <li
              key={idx}
              className="flex justify-between items-center border-b pb-1"
            >
              <span>
                {lux.name} → REP: +{lux.rep} → Resale: ${lux.resale.toLocaleString()}
              </span>
              <button
                onClick={() => handleResell(idx)}
                className="ml-2 bg-red-500 text-white px-2 py-1 rounded text-xs hover:bg-red-600"
              >
                Resell
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default LuxuryLog;
