import React from 'react';

function LapTracker({
  laps,
  setLaps,
  investments,
  setInvestments,
  totalLaps,
  showFinal,
  playerSnapshot
}) {
  const handleCompleteLap = () => {
    const newLap = laps + 1;
    setLaps(newLap);

    setInvestments(prev =>
      prev.map(inv => ({
        ...inv,
        newValue: Math.floor(inv.newValue * 1.05)
      }))
    );

    if (newLap >= totalLaps) {
      showFinal({
        ...playerSnapshot,
        laps: newLap
      });
    }
  };

  return (
    <section className="bg-white rounded-xl shadow-md p-4">
      <h3 className="text-lg font-semibold text-indigo-700 mb-2 flex items-center gap-2">
        🔁 Laps
      </h3>
      <p className="text-gray-800 text-sm mb-3">
        Laps Completed: <span className="font-bold">{laps}</span> / {totalLaps}
      </p>
      <button
        onClick={handleCompleteLap}
        className="w-full bg-indigo-600 text-white font-semibold py-2 rounded hover:bg-indigo-700 transition"
      >
        Complete Lap
      </button>
    </section>
  );
}

export default LapTracker;
