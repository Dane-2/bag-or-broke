import React from 'react';

function FinalSummary({ summary, onRestart }) {
  return (
    <div className="p-4 border rounded-xl bg-white shadow-md space-y-4">
      <h2 className="text-xl font-bold text-gray-800">🧠 NIL Summary & Archetype</h2>
      <p className="text-gray-700 whitespace-pre-line">{summary}</p>
      <button
        onClick={onRestart}
        className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
      >
        Restart Game
      </button>
    </div>
  );
}

export default FinalSummary;
