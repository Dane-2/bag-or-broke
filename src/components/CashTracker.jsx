import React from 'react';

function CashTracker({ cash, setCash }) {
  const handleAddCash = () => {
    const input = prompt('Enter amount to add:');
    if (!input) return;
    const amount = parseInt(input.replace(/,/g, ''), 10);
    if (!isNaN(amount)) setCash(prev => prev + amount);
  };

  const handleSubtractCash = () => {
    const input = prompt('Enter amount to subtract:');
    if (!input) return;
    const amount = parseInt(input.replace(/,/g, ''), 10);
    if (!isNaN(amount)) setCash(prev => prev - amount);
  };

  return (
    <section className="bg-white rounded-xl shadow-md p-4">
      <h3 className="text-lg font-semibold text-green-700 mb-2 flex items-center gap-2">💵 Cash Tracker</h3>
      <p className="text-xl font-bold text-gray-800 mb-4">${cash.toLocaleString()}</p>
      <div className="flex gap-2">
        <button
          className="w-1/2 bg-green-600 text-white font-semibold py-2 rounded hover:bg-green-700"
          onClick={handleAddCash}
        >
          + Add Cash
        </button>
        <button
          className="w-1/2 bg-red-600 text-white font-semibold py-2 rounded hover:bg-red-700"
          onClick={handleSubtractCash}
        >
          - Subtract Cash
        </button>
      </div>
    </section>
  );
}

export default CashTracker;
