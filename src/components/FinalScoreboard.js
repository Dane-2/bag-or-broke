import React, { useState } from 'react';
import { PieChart, Pie, Cell, Tooltip, Legend } from 'recharts';
import BOBReflectionForm from './BOBReflectionForm';

const shellClass =
  'min-h-[100dvh] bg-cover bg-center bg-no-repeat flex items-center justify-center p-4 py-8';

const mainCardClass =
  'w-full max-w-lg rounded-2xl bg-white/25 backdrop-blur-xl border border-white/45 shadow-xl shadow-slate-900/10 p-6 md:p-8 space-y-5';

const insetPanelClass =
  'rounded-2xl border border-white/50 bg-white/35 backdrop-blur-md p-4 md:p-5 shadow-inner';

const statRowClass = 'flex justify-between gap-3 text-sm text-slate-800 py-2.5';

// Archetype descriptions
const archetypeDescriptions = {
  'The Architect': 'Strategic, analytical, methodical planner; builds value quietly.',
  'The Legacy Maker': 'Impact-first, community-driven, cautious and consistent.',
  'The Hot Shot': 'Flashy, impulsive, starts strong but often struggles late-game.',
  'The Hustler': 'Relentless, street-smart, flips every loss, aggressive investor.',
  'The Survivor': 'Quiet underdog, faces many setbacks but shows resilience.',
  'The CEO in Training': 'Balanced, polished, invests wisely for the long-term.',
  'The Flexer': 'Status-driven, trendsetter, spends on luxury, weak financial discipline.',
  'The Flameout': 'High-risk, ego-driven, impulsive, often crashes out.',
};

// Archetype image map (match this to your /public/archetypes folder)
const archetypeImageMap = {
  'The Architect': '/archetypes/architect.png',
  'The Legacy Maker': '/archetypes/legacy.png',
  'The Hot Shot': '/archetypes/hotshot.png',
  'The Hustler': '/archetypes/hustler.png',
  'The Survivor': '/archetypes/survivor.png',
  'The CEO in Training': '/archetypes/CEO.png',
  'The Flexer': '/archetypes/flexer.png',
  'The Flameout': '/archetypes/flameout.png',
};

function FinalScoreboard({ data }) {
  const [showBOBForm, setShowBOBForm] = useState(false);

  if (!data) {
    return (
      <div className={shellClass} style={{ backgroundImage: "url('/moneyBG.png')" }}>
        <div className={mainCardClass}>
          <p className="text-center text-slate-800 font-medium">No final data to show.</p>
        </div>
      </div>
    );
  }

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
    summary,
    archetype,
    coachJBoUnlocked = false,
  } = data;

  const luxuryResale = luxuries.reduce((acc, item) => acc + item.resale, 0);
  const investmentReturns = investments.reduce((acc, i) => acc + (i.newValue || 0), 0);
  const repValue = rep * 5000;
  const careerValue = career * 10000;
  const creditBonus = credit >= 700 ? 10000 : credit >= 600 ? 5000 : credit >= 500 ? 2000 : 0;
  const balanceBonusValue = (data.balanceBonusAwarded || false) ? 250000 : 0;
  const netWorth =
    cash +
    investmentReturns +
    luxuryResale +
    repValue +
    careerValue +
    creditBonus +
    balanceBonusValue -
    debt -
    shadyDebt;

  const breakdownData = [
    { name: 'Cash', value: cash },
    { name: 'Investments', value: investmentReturns },
    { name: 'Luxuries', value: luxuryResale },
    { name: 'REP', value: repValue },
    { name: 'Career', value: careerValue },
    { name: 'Credit Bonus', value: creditBonus },
  ];

  const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ec4899', '#6366f1', '#14b8a6'];

  const actualArchetype = archetype && archetype.trim() !== '' ? archetype : 'The Hot Shot';
  const imageUrl = archetypeImageMap[actualArchetype] || null;

  const gameDataForPDF = {
    playerName,
    archetype: actualArchetype,
    netWorth,
    cash,
    debt,
    rep,
    career,
    credit,
    investments,
    luxuries,
    shadyDebt,
  };

  return (
    <div className={shellClass} style={{ backgroundImage: "url('/moneyBG.png')" }}>
      <div className={mainCardClass}>
        <div className="text-center space-y-1">
          <h2 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight">Final scoreboard</h2>
          <p className="text-sm text-slate-700">
            <span className="font-semibold text-slate-900">{playerName}</span>
          </p>
        </div>

        <div className={insetPanelClass}>
          <ul className="divide-y divide-white/25">
            <li className={statRowClass}>
              <span>💵 Cash</span>
              <span className="font-semibold tabular-nums">${cash.toLocaleString()}</span>
            </li>
            <li className={statRowClass}>
              <span>📈 Investments</span>
              <span className="font-semibold tabular-nums">${investmentReturns.toLocaleString()}</span>
            </li>
            <li className={statRowClass}>
              <span>💎 Luxury resale</span>
              <span className="font-semibold tabular-nums">${luxuryResale.toLocaleString()}</span>
            </li>
            <li className={statRowClass}>
              <span>🌟 REP value</span>
              <span className="font-semibold tabular-nums">${repValue.toLocaleString()}</span>
            </li>
            <li className={statRowClass}>
              <span>📚 Career value</span>
              <span className="font-semibold tabular-nums">${careerValue.toLocaleString()}</span>
            </li>
            <li className={statRowClass}>
              <span>🧠 Credit bonus</span>
              <span className="font-semibold tabular-nums">${creditBonus.toLocaleString()}</span>
            </li>
            <li className={statRowClass}>
              <span>💳 Debt</span>
              <span className="font-semibold text-red-800 tabular-nums">-${debt.toLocaleString()}</span>
            </li>
            <li className={statRowClass}>
              <span>📉 Shady deal debt</span>
              <span className="font-semibold text-red-800 tabular-nums">-${shadyDebt.toLocaleString()}</span>
            </li>
          </ul>
        </div>

        <div
          className={`${insetPanelClass} text-center border border-emerald-200/60 bg-gradient-to-br from-emerald-100/40 to-white/30`}
        >
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-600 mb-1">Net worth</p>
          <p className="text-2xl md:text-3xl font-black text-slate-900 tabular-nums">
            ${netWorth.toLocaleString()}
          </p>
        </div>

        <div className="flex justify-center overflow-x-auto -mx-1 px-1">
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

        {coachJBoUnlocked && (
          <div
            className={`${insetPanelClass} flex items-center gap-4 border-amber-300/60 bg-gradient-to-br from-amber-100/50 to-white/30`}
          >
            <img
              src="/avatars/IMG_4355.png"
              alt="Coach JBo"
              className="w-20 h-20 object-cover rounded-2xl border-2 border-amber-400/80 shadow-md shrink-0"
              onError={(e) => {
                e.target.onerror = null;
                e.target.src = '/IMG_4355.png';
              }}
            />
            <div>
              <h4 className="text-base font-bold text-amber-900">Coach JBo</h4>
              <p className="text-amber-900/90 text-sm leading-snug">
                You played the most conservative, defense-first style — closest match to Coach JBo!
              </p>
            </div>
          </div>
        )}

        {summary && (
          <div
            className={`${insetPanelClass} border-violet-200/50 bg-gradient-to-br from-violet-100/35 to-white/25`}
          >
            <h3 className="text-sm font-bold uppercase tracking-wide text-violet-900 mb-2">How did you play?</h3>
            <p className="text-slate-800 text-sm leading-relaxed whitespace-pre-line">{summary}</p>
          </div>
        )}

        <div
          className={`${insetPanelClass} flex items-center gap-4 border-l-4 border-l-violet-500 border border-white/50`}
        >
          {imageUrl && (
            <img
              src={imageUrl}
              alt={actualArchetype}
              className="w-24 h-24 object-contain rounded-2xl border border-white/50 bg-white/50 shrink-0"
              onError={(e) => {
                e.target.style.display = 'none';
              }}
            />
          )}
          <div className="min-w-0">
            <h4 className="text-sm font-bold text-slate-900 mb-1">
              Your archetype:{' '}
              <span className="text-violet-800 underline decoration-violet-300">{actualArchetype}</span>
            </h4>
            <p className="text-slate-700 text-sm leading-snug">
              {archetypeDescriptions[actualArchetype] || 'Unique player style!'}
            </p>
          </div>
        </div>

        <div className={`${insetPanelClass} border-indigo-200/50 bg-white/30`}>
          {!showBOBForm ? (
            <>
              <h3 className="text-base font-bold text-slate-900 mb-1">B.O.B. Decision Blueprint™</h3>
              <p className="text-sm text-slate-700 mb-4 leading-snug">
                Reflect on your decisions and download a PDF with your answers and game stats.
              </p>
              <button
                type="button"
                onClick={() => setShowBOBForm(true)}
                className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-indigo-500 to-violet-600 text-white font-semibold shadow-lg shadow-indigo-500/25 hover:from-indigo-600 hover:to-violet-700 active:scale-[0.99] transition"
              >
                Complete reflection &amp; download PDF
              </button>
            </>
          ) : (
            <div className="max-h-[60vh] overflow-y-auto pr-2">
              <BOBReflectionForm gameData={gameDataForPDF} />
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={() => window.location.reload()}
          className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-sky-500 to-blue-600 text-white font-semibold shadow-lg shadow-blue-600/25 hover:from-sky-600 hover:to-blue-700 active:scale-[0.99] transition"
        >
          Restart game
        </button>
      </div>
    </div>
  );
}

export default FinalScoreboard;
