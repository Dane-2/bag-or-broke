import React, { useState } from 'react';

const tiers = {
  1: { label: 'Walk-On', amount: 10000 },
  2: { label: 'D1 Reserve', amount: 25000 },
  3: { label: 'D1 Starter', amount: 50000 },
  4: { label: '3-Star Recruit', amount: 75000 },
  5: { label: '4-Star Recruit', amount: 100000 },
  6: { label: '5-Star Recruit', amount: 150000 }
};

function StartScreen({ onStart }) {
  const [playerName, setPlayerName] = useState('');
  const [rollValue, setRollValue] = useState('');
  const [gameLength, setGameLength] = useState('');

  const selectedTier = rollValue ? tiers[parseInt(rollValue)] : null;
  const totalCash = selectedTier ? selectedTier.amount + 2500 : 0;

  return (
    <div
      className="min-h-screen bg-cover bg-center bg-no-repeat flex items-center justify-center"
      style={{ backgroundImage: 'url(/backgroundFinal.png)' }}
    >
      <div className="w-[90%] max-w-md p-6 space-y-4 bg-white/70 backdrop-blur-md rounded-xl shadow-lg">
        <h1 className="text-2xl font-bold text-center text-gray-800">🎓 Start Your NIL Journey</h1>

        <input
          value={playerName}
          onChange={(e) => setPlayerName(e.target.value)}
          placeholder="Enter your name"
          className="w-full px-4 py-2 border rounded-md shadow-sm focus:ring-2 focus:ring-blue-500"
        />

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">What did you roll (1–6)?</label>
          <select
            value={rollValue}
            onChange={(e) => setRollValue(e.target.value)}
            className="w-full px-4 py-2 border rounded-md shadow-sm focus:ring-2 focus:ring-blue-500"
          >
            <option value="">-- Select your NIL Deal --</option>
            {[1, 2, 3, 4, 5, 6].map(num => (
              <option key={num} value={num}>{num}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Select Game Length:</label>
          <select
            value={gameLength}
            onChange={(e) => setGameLength(e.target.value)}
            className="w-full px-4 py-2 border rounded-md shadow-sm focus:ring-2 focus:ring-blue-500"
          >
            <option value="">-- Choose --</option>
            <option value="5">Short Game (5 Laps)</option>
            <option value="10">Long Game (10 Laps)</option>
          </select>
        </div>

        {selectedTier && (
          <div className="p-4 bg-gray-100 rounded text-center space-y-2">
            <p className="text-lg font-semibold">🎲 NIL Tier: {selectedTier.label}</p>
            <p className="text-gray-700">Base Cash: ${selectedTier.amount.toLocaleString()}</p>
            <p className="text-gray-700">+ $2,500 Scholarship</p>
            <p className="text-xl font-bold text-blue-600">Total: ${totalCash.toLocaleString()}</p>

            <button
              onClick={() =>
                onStart(playerName, totalCash, selectedTier.label, parseInt(gameLength, 10))
              }
              disabled={!playerName || !rollValue || !gameLength}
              className="w-full bg-green-600 text-white font-semibold py-2 rounded hover:bg-green-700 transition disabled:opacity-50"
            >
              Start Game
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default StartScreen;
