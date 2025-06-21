import React, { useState } from 'react';
import  CardModal  from './InvestmentModal'; // formerly CardModal
import LuxuryModal  from './LuxuryModal';

function PlayerDashboard({ playerName, avatar, startingCash, showFinal }) {
  const [cash, setCash] = useState(startingCash || 0);
  const [rep, setRep] = useState(0);
  const [career, setCareer] = useState(0);
  const [luxuries, setLuxuries] = useState([]);
  const [curveballs, setCurveballs] = useState([]);
  const [debt, setDebt] = useState(0);
  const [credit, setCredit] = useState(500);
  const [investments, setInvestments] = useState([]);

  return (
    <div className="max-w-md mx-auto px-4 py-6 space-y-6">
      <h2 className="text-2xl font-bold text-center text-gray-800 mb-4">Player Dashboard</h2>
      <div className="text-center text-gray-600">
        <p><strong>Name:</strong> {playerName}</p>
        <p><strong>NIL Tier:</strong> {avatar}</p>
    </div>
      

      {/* 💵 Cash Tracker */}
      <section className="bg-white rounded-xl shadow-md p-4">
        <h3 className="text-lg font-semibold text-green-700 mb-2 flex items-center gap-2">💵 Cash Tracker</h3>
        <p className="text-xl font-bold text-gray-800 mb-4">${cash.toLocaleString()}</p>
        <div className="flex gap-2">
          <button
            className="w-1/2 bg-green-600 text-white font-semibold py-2 rounded hover:bg-green-700"
            onClick={() => {
              const amount = parseInt(prompt('Enter amount to add:'), 10);
              if (!isNaN(amount)) setCash(cash + amount);
            }}
          >
            + Add Cash
          </button>
          <button
            className="w-1/2 bg-red-600 text-white font-semibold py-2 rounded hover:bg-red-700"
            onClick={() => {
              const amount = parseInt(prompt('Enter amount to subtract:'), 10);
              if (!isNaN(amount)) setCash(cash - amount);
            }}
          >
            - Subtract Cash
          </button>
        </div>
      </section>

      {/* 📈 Investments Log */}
      <section className="bg-white rounded-xl shadow-md p-4">
        <h3 className="text-lg font-semibold text-blue-700 mb-2">📈 Investments</h3>
        {investments.length === 0 ? (
          <p className="text-gray-500">No investments yet</p>
        ) : (
          <ul className="space-y-1 text-sm text-gray-700">
            {investments.map((inv, idx) => (
              <li key={idx}>
                {inv.card} → {inv.percent}% → ${inv.result >= 0 ? '+' : ''}{inv.result.toLocaleString()}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* 📦 Investment Modal */}
      <CardModal
        currentCash={cash}
        onApply={({ card, cost, result, newValue, percent, borrowed, interest }) => {
          setCash(prev => prev - (borrowed ? 0 : cost) + newValue);
          if (borrowed) {
            setDebt(prev => prev + cost + interest);
            setCredit(prev => prev - 20);
          }
          setInvestments(prev => [...prev, { card, result, percent }]);
          alert(`Result: ${percent}% → New Value: $${newValue.toLocaleString()}`);
        }}
      />

      {/* 💎 Luxury Modal */}
      <LuxuryModal
        currentCash={cash}
        onPurchase={({ card, cost, resale, rep: repGain }) => {
  setCash(prev => prev - cost);
  setRep(prev => prev + repGain);
  setLuxuries(prev => [...prev, { name: card, resale }]);
  alert(`Purchased ${card}! +${repGain} REP`);
}}

      />

      <section className="bg-white rounded-xl shadow-md p-4">
  <h3 className="text-lg font-semibold text-purple-700 mb-2 flex items-center gap-2">
    💎 Owned Luxuries
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


      {/* 💳 Debt & Credit Tracker */}
      <section className="bg-white rounded-xl shadow-md p-4">
  <h3 className="text-lg font-semibold text-black mb-2 flex items-center gap-2">
    💳 Debt & Credit
  </h3>

  <form
    onSubmit={(e) => {
      e.preventDefault();
      const amount = parseInt(e.target.loan.value, 10);
      if (isNaN(amount)) return;
      const interest = Math.floor(amount * 0.25);
      setDebt(debt + amount + interest);
      setCash(cash + amount);
      setCredit(credit - 20);
      e.target.reset();
    }}
    className="space-y-3"
  >
    <input
      name="loan"
      type="number"
      placeholder="Loan Amount"
      className="w-full px-4 py-2 border rounded-md shadow-sm focus:ring-2 focus:ring-black outline-none"
    />
    <button
      type="submit"
      className="w-full bg-black text-white font-semibold py-2 rounded hover:bg-gray-800 transition"
    >
      Take Loan (25% Interest)
    </button>
  </form>

  <div className="mt-4 text-sm text-gray-700 space-y-1">
    <p>
      <strong>Total Debt:</strong>{' '}
      <span className="text-red-600 font-semibold">
        ${debt.toLocaleString()}
      </span>
    </p>
    <p>
      <strong>Credit Score:</strong>{' '}
      <span className={`
        font-semibold
        ${credit >= 700 ? 'text-green-600' :
          credit >= 600 ? 'text-yellow-600' : 'text-red-600'}
      `}>
        {credit}
      </span>
    </p>
  </div>

  <button
    onClick={() => {
      if (cash >= debt && debt > 0) {
        setCash(cash - debt);
        setDebt(0);
        setCredit(credit + 50);
      } else {
        alert("Not enough cash or no debt to pay off.");
      }
    }}
    className="w-full bg-black text-white font-semibold py-2 rounded mt-3 hover:bg-gray-800 transition"
  >
    Pay Off Debt
  </button>
</section>

      
      <section className="bg-white rounded-xl shadow-md p-4">
  <h3 className="text-lg font-semibold text-red-600 mb-2 flex items-center gap-2">
    ❌ Curveballs
  </h3>
  <form
    onSubmit={(e) => {
      e.preventDefault();
      const desc = e.target.desc.value;
      const amount = parseInt(e.target.loss.value, 10);
      if (!desc || isNaN(amount)) return;
      setCurveballs([...curveballs, { desc, amount }]);
      setCash(cash - amount);
      e.target.reset();
    }}
    className="space-y-3"
  >
    <input
      name="desc"
      placeholder="e.g. Missed Media Training"
      className="w-full px-4 py-2 border rounded-md shadow-sm focus:ring-2 focus:ring-red-500 outline-none"
    />
    <input
      name="loss"
      type="number"
      placeholder="Loss $"
      className="w-full px-4 py-2 border rounded-md shadow-sm focus:ring-2 focus:ring-red-500 outline-none"
    />
    <button
      type="submit"
      className="w-full bg-red-600 text-white font-semibold py-2 rounded hover:bg-red-700 transition"
    >
      Add Curveball
    </button>
  </form>

  {curveballs.length > 0 && (
    <ul className="mt-4 text-sm text-gray-700 space-y-1">
      {curveballs.map((c, idx) => (
        <li key={idx}>
          <span className="font-semibold text-red-600">{c.desc}</span>: -${c.amount.toLocaleString()}
        </li>
      ))}
    </ul>
  )}
</section>

<section className="bg-white rounded-xl shadow-md p-4">
  <h3 className="text-lg font-semibold text-yellow-600 mb-2 flex items-center gap-2">
    🌟 REP & Career Points
  </h3>
  <p className="text-gray-800 text-sm mb-3">
    REP: <span className="font-bold">{rep}</span> &nbsp;|&nbsp; Career: <span className="font-bold">{career}</span>
  </p>
  <div className="grid grid-cols-2 gap-2">
    <button
      onClick={() => setRep(rep + 1)}
      className="bg-yellow-500 text-white font-semibold py-2 rounded hover:bg-yellow-600 transition"
    >
      +1 REP
    </button>
    <button
      onClick={() => setRep(rep > 0 ? rep - 1 : 0)}
      className="bg-yellow-100 text-yellow-800 font-semibold py-2 rounded hover:bg-yellow-200 transition"
    >
      -1 REP
    </button>
    <button
      onClick={() => setCareer(career + 1)}
      className="bg-blue-500 text-white font-semibold py-2 rounded hover:bg-blue-600 transition"
    >
      +1 Career
    </button>
    <button
      onClick={() => setCareer(career > 0 ? career - 1 : 0)}
      className="bg-blue-100 text-blue-800 font-semibold py-2 rounded hover:bg-blue-200 transition"
    >
      -1 Career
    </button>
  </div>
</section>


<section className="bg-white rounded-xl shadow-md p-4">
  <h3 className="text-lg font-semibold text-indigo-700 mb-2 flex items-center gap-2">
    📊 Final Net Worth
  </h3>
  {(() => {
    const luxuryResale = luxuries.reduce((acc, item) => acc + item.resale, 0);
    const repValue = rep * 2500;
    const careerValue = career * 5000;
    const creditBonus =
      credit >= 700 ? 10000 : credit >= 600 ? 5000 : credit >= 500 ? 2000 : 0;
    const netWorth =
      cash + luxuryResale + repValue + careerValue + creditBonus - debt;

    return (
      <div className="space-y-1 text-sm text-gray-800">
        <ul className="space-y-1">
          <li>💵 <strong>Cash:</strong> ${cash.toLocaleString()}</li>
          <li>💎 <strong>Luxury Resale:</strong> ${luxuryResale.toLocaleString()}</li>
          <li>🌟 <strong>REP Value:</strong> ${repValue.toLocaleString()}</li>
          <li>📚 <strong>Career Value:</strong> ${careerValue.toLocaleString()}</li>
          <li>🧠 <strong>Credit Bonus:</strong> ${creditBonus.toLocaleString()}</li>
          <li>💳 <strong>Debt:</strong> -${debt.toLocaleString()}</li>
        </ul>
        <h4 className="text-xl font-bold mt-3">Net Worth: ${netWorth.toLocaleString()}</h4>
        <button
          onClick={() => {

            const curveballLoss = curveballs.reduce((acc, c) => acc + c.amount, 0);
const totalLuxuries = luxuries.length;

let assignedProfile = "The CEO in Training"; // Default

if (rep >= 10 && luxuries.length <= 2 && debt <= 20000) {
  assignedProfile = "The Architect";
} else if (cash < 10000 && debt > 50000) {
  assignedProfile = "The Flameout";
} else if (career >= 8 && debt === 0) {
  assignedProfile = "The Legacy Maker";
} else if (debt >= 60000 && cash > 25000) {
  assignedProfile = "The Hustler";
} else if (totalLuxuries >= 6 && rep <= 2) {
  assignedProfile = "The Flexer";
} else if (curveballLoss >= 50000 && rep >= 5 && cash < 20000) {
  assignedProfile = "The Survivor";
} else if (cash > 100000 && totalLuxuries >= 4 && curveballLoss < 20000) {
  assignedProfile = "The Hot Shot";
}
            showFinal({
              playerName,
              cash,
              luxuries,
              rep,
              career,
              debt,
              credit
            });
          }}
          className="w-full bg-indigo-600 text-white font-semibold py-2 mt-4 rounded hover:bg-indigo-700 transition"
        >
          End Game & View Scoreboard
        </button>
      </div>
    );
  })()}
</section>

</div>

    
  );
}

export default PlayerDashboard;
