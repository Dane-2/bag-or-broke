import React from 'react';

function LapTracker({ laps, totalLaps, setLaps, investments, setInvestments, setCash, addToast }) {
  const handleCompleteLap = () => {
    if (laps >= totalLaps) return;

    const updatedInvestments = investments.map((inv) => {
      const gain = Math.floor(inv.newValue * 0.05);
      const newValue = inv.newValue + gain;
      const result = newValue - inv.cost;
      const percent = Math.round((result / inv.cost) * 100);

      return {
        ...inv,
        newValue,
        result,
        percent
      };
    });

    setInvestments(updatedInvestments);
    setLaps((prev) => prev + 1);
    
    // Add NIL stipend of $2,500
    if (setCash) {
      setCash((prev) => prev + 2500);
    }
    
    // Show toast notification
    if (addToast) {
      addToast('NIL stipend received + $2,500', 'success', 3000);
    }
  };

  return (
    <section className="bg-white rounded-xl shadow-md p-4">
      <div className="flex justify-between items-center mb-2">
        <h3 className="text-lg font-semibold text-green-700">🏁 Progress</h3>
        <span className="text-sm text-gray-600">Lap {laps} of {totalLaps}</span>
      </div>

      <div className="flex gap-2">
        <button
          onClick={handleCompleteLap}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
          disabled={laps >= totalLaps}
        >
          Complete Lap
        </button>
      </div>
    </section>
  );
}

export default LapTracker;
