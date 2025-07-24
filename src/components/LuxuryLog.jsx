import React from 'react';

function LuxuryLog({ luxuries, setCash, setRep, setLuxuries }) {
  return (
    <section className="bg-white rounded-xl shadow-md p-4">
      <h3 className="text-lg font-semibold text-purple-700 mb-2 flex items-center gap-2">
        💸 Owned Luxuries
      </h3>
      {luxuries.length === 0 ? (
        <p className="text-gray-500">No luxuries owned</p>
      ) : (
        <ul className="space-y-2">
          {luxuries.map((lux, idx) => (
            <li key={idx} className="flex justify-between items-center border-b pb-1">
              <span>{lux.name} – Resale: ${lux.resale.toLocaleString()}</span>
              <button
                onClick={() => {
                  setCash(prev => prev + lux.resale);
                  setRep(prev => Math.max(0, prev - (lux.rep || 0)));
                  setLuxuries(prev => prev.filter((_, i) => i !== idx));
                }}
                className="bg-purple-600 text-white px-3 py-1 rounded hover:bg-purple-700 transition text-sm"
              >
                Sell
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default LuxuryLog;
