import React from 'react';
import { PieChart, Pie, Cell, Tooltip, Legend } from 'recharts';

function FinalScoreboard({ data }) {
  if (!data) return <p>No final data to show.</p>;

  const {
    playerName,
    cash,
    luxuries = [],
    rep,
    career,
    debt,
    credit,
    investments = [],
    shadyDebt = 0,
    summary, // ✅ NEW: AI summary
  } = data;

  const luxuryResale = luxuries.reduce((acc, item) => acc + item.resale, 0);
  const investmentReturns = investments.reduce((acc, i) => acc + (i.newValue || 0), 0);
  const repValue = rep * 2500;
  const careerValue = career * 5000;
  const creditBonus = credit >= 700 ? 10000 : credit >= 600 ? 5000 : credit >= 500 ? 2000 : 0;
  const netWorth = cash + investmentReturns + luxuryResale + repValue + careerValue + creditBonus - debt - shadyDebt;

  const breakdownData = [
    { name: 'Cash', value: cash },
    { name: 'Investments', value: investmentReturns },
    { name: 'Luxuries', value: luxuryResale },
    { name: 'REP', value: repValue },
    { name: 'Career', value: careerValue },
    { name: 'Credit Bonus', value: creditBonus }
  ];

  const COLORS = ['#34D399', '#3B82F6', '#F59E0B', '#F472B6', '#6366F1', '#10B981'];

  return (
    <div
      className="min-h-screen flex items-center justify-center bg-no-repeat bg-center bg-cover px-4"
      style={{ backgroundImage: "url('/moneyBG.png')" }}
    >
      <div className="bg-white p-6 rounded-xl shadow-md w-full max-w-md space-y-6">
        <h2 className="text-2xl font-bold text-center text-indigo-700">🏁 Final Scoreboard</h2>

        <div className="text-center space-y-1 text-gray-700">
          <p><strong>Player:</strong> {playerName}</p>
        </div>

        <ul className="space-y-1 text-sm text-gray-800">
          <li>💵 <strong>Cash:</strong> ${cash.toLocaleString()}</li>
          <li>📈 <strong>Investments:</strong> ${investmentReturns.toLocaleString()}</li>
          <li>💎 <strong>Luxury Resale:</strong> ${luxuryResale.toLocaleString()}</li>
          <li>🌟 <strong>REP Value:</strong> ${repValue.toLocaleString()}</li>
          <li>📚 <strong>Career Value:</strong> ${careerValue.toLocaleString()}</li>
          <li>🧠 <strong>Credit Bonus:</strong> ${creditBonus.toLocaleString()}</li>
          <li>💳 <strong>Debt:</strong> -${debt.toLocaleString()}</li>
          <li>📉 <strong>Shady Deal Debt:</strong> -${shadyDebt.toLocaleString()}</li>
        </ul>

        <h3 className="text-xl font-bold text-center">
          Net Worth: ${netWorth.toLocaleString()}
        </h3>

        <div className="flex justify-center">
          <PieChart width={320} height={250}>
            <Pie
              data={breakdownData}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              outerRadius={80}
              fill="#8884d8"
              label={({ percent }) => `${(percent * 100).toFixed(0)}%`}
            >
              {breakdownData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip formatter={(value) => `$${value.toLocaleString()}`} />
            <Legend verticalAlign="bottom" height={36} />
          </PieChart>
        </div>

        {summary && (
          <div className="bg-indigo-50 border border-indigo-200 rounded mt-4 p-4 shadow-sm">
            <h3 className="text-lg font-bold text-indigo-800">💬 AI Summary</h3>
            <p className="text-gray-800 whitespace-pre-line">{summary}</p>
          </div>
        )}

        <button
          onClick={() => window.location.reload()}
          className="w-full bg-indigo-600 text-white font-semibold py-2 rounded hover:bg-indigo-700 transition"
        >
          Restart Game
        </button>
      </div>
    </div>
  );
}

export default FinalScoreboard;
