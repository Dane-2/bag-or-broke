import React, { useState } from 'react';
import { PieChart, Pie, Cell, Tooltip, Legend } from 'recharts';
import BOBReflectionForm from './BOBReflectionForm';
import { holdingsTotals, scoreBreakdown } from '../rules/portfolio';
import { fromCents, toCents } from '../rules/money';
import { DIMENSION_LABELS, PROFILE_COPY, revealTitle, nextTimeSuggestion } from '../rules/reveal';

const shellClass =
  'min-h-[100dvh] bg-cover bg-center bg-no-repeat flex items-center justify-center p-4 py-8';

const mainCardClass =
  'w-full max-w-lg rounded-2xl bg-white/25 backdrop-blur-xl border border-white/45 shadow-xl shadow-slate-900/10 p-6 md:p-8 space-y-5';

const insetPanelClass =
  'rounded-2xl border border-white/50 bg-white/35 backdrop-blur-md p-4 md:p-5 shadow-inner';

const statRowClass = 'flex justify-between gap-3 text-sm text-slate-800 py-2.5';

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

  // The frozen snapshot score from Finish & Reveal; recompute only if it is missing.
  const score =
    data.score ||
    scoreBreakdown({
      cash: toCents(cash),
      taxBucket: toCents(data.taxBucket || 0),
      ...holdingsTotals(investments, luxuries),
      ordinaryDebt: toCents(debt),
      taxesOwed: toCents(data.taxesOwed || 0),
      otherLiabilities: toCents(shadyDebt),
      rep,
      career,
      creditScore: credit,
    });
  const dollars = cents => fromCents(cents);
  const money = cents => `${cents < 0 ? '-' : ''}$${Math.abs(dollars(cents)).toLocaleString()}`;
  const netWorth = dollars(score.gameValue);

  const breakdownData = [
    { name: 'Cash', value: dollars(score.cash + score.taxBucket) },
    { name: 'Investments', value: dollars(score.assetsValue) },
    { name: 'Luxuries', value: dollars(score.luxuryResale) },
    { name: 'REP', value: dollars(score.repValue) },
    { name: 'Career', value: dollars(score.careerValue) },
    { name: 'Credit Bonus', value: dollars(score.creditBonus) },
  ].filter(d => d.value > 0);

  const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ec4899', '#6366f1', '#14b8a6'];

  // The rules engine picks the pattern from recorded choices; AI text never overrides it.
  const reveal = data.reveal || null;
  const evidence = data.evidence || { observations: [], setbacks: [] };
  const actualArchetype = reveal ? revealTitle(reveal) : archetype || 'Not enough evidence for a clear pattern';
  const revealProfiles = reveal ? reveal.profiles : [];
  const imageUrl = revealProfiles[0] ? archetypeImageMap[revealProfiles[0].name] || null : null;
  const chosen = evidence.observations.filter(o => !['recovery'].includes(o.dimension)).slice(-3).reverse();
  const adjusted = evidence.observations.filter(o => o.dimension === 'recovery' || o.dimension === 'purposeful_promotion').slice(-3).reverse();

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
            {[
              ['💵 Available Cash', score.cash],
              ['🧾 Tax Bucket', score.taxBucket],
              ['📈 Investments', score.assetsValue],
              ['💎 Luxury resale', score.luxuryResale],
              ['💳 Borrowing', -score.ordinaryDebt],
              ['🛡️ Policy loans', -score.policyDebt],
              ['🏛️ Taxes owed', -score.taxesOwed],
              ['🧾 Event bills', -score.otherLiabilities],
              ['= Financial wealth', score.financialWealth],
              ['🌟 REP value', score.repValue],
              ['📚 Career value', score.careerValue],
              ['🧠 Credit bonus', score.creditBonus],
            ]
              .filter(([label, value]) => value !== 0 || !label.match(/Policy|Taxes|Event|Bucket/))
              .map(([label, value]) => (
                <li key={label} className={statRowClass}>
                  <span>{label}</span>
                  <span className={`font-semibold tabular-nums ${value < 0 ? 'text-red-800' : ''}`}>{money(value)}</span>
                </li>
              ))}
          </ul>
        </div>

        <div
          className={`${insetPanelClass} text-center border border-emerald-200/60 bg-gradient-to-br from-emerald-100/40 to-white/30`}
        >
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-600 mb-1">Final game value</p>
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

        <div className={`${insetPanelClass} border-l-4 border-l-violet-500 border border-white/50 space-y-3`}>
          <p className="text-xs font-semibold uppercase tracking-wide text-violet-900">Your playstyle in this game</p>
          <div className="flex items-center gap-4">
            {imageUrl && (
              <img
                src={imageUrl}
                alt={actualArchetype}
                className="w-20 h-20 object-contain rounded-2xl border border-white/50 bg-white/50 shrink-0"
                onError={(e) => {
                  e.target.style.display = 'none';
                }}
              />
            )}
            <div className="min-w-0">
              <h4 className="text-base font-bold text-violet-900">{actualArchetype}</h4>
              {revealProfiles.map(p => (
                <p key={p.code} className="text-slate-800 text-sm leading-snug">{PROFILE_COPY[p.code]}</p>
              ))}
              {reveal && reveal.state === 'mixed' && <p className="text-xs text-slate-700 mt-1">Two patterns fit your choices almost equally.</p>}
              {reveal && reveal.state === 'unclassified' && <p className="text-xs text-slate-700">Your choices did not match one of the eight patterns closely.</p>}
              {reveal && reveal.state === 'insufficient_evidence' && (
                <p className="text-xs text-slate-700">A pattern needs at least 12 real decisions across 4 areas. You made {reveal.uniqueChoiceEvents}.</p>
              )}
              {reveal && reveal.state !== 'insufficient_evidence' && (
                <p className="text-[11px] text-slate-600 mt-1">
                  Evidence: {reveal.evidenceStrength === 'supported' ? 'supported' : 'emerging'} ({reveal.uniqueChoiceEvents} decisions). A description of this game's choices, not of you.
                </p>
              )}
            </div>
          </div>

          {reveal && Object.keys(reveal.metrics).length > 0 && (
            <div className="space-y-1">
              {Object.entries(reveal.metrics).map(([dim, m]) => (
                <div key={dim} className="text-xs text-slate-800">
                  <div className="flex justify-between">
                    <span>{DIMENSION_LABELS[dim] || dim}</span>
                    <span className="tabular-nums">{Math.round(m.mean * 100)}% of {m.n}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-white/50 overflow-hidden">
                    <div className="h-full bg-violet-500" style={{ width: `${Math.round(m.mean * 100)}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="grid gap-2 text-sm text-slate-800">
            <div>
              <p className="font-semibold text-slate-900">What you chose</p>
              {chosen.length ? chosen.map(o => <p key={o.event_id} className="text-xs">• {o.label}</p>) : <p className="text-xs">No recorded decisions yet.</p>}
            </div>
            <div>
              <p className="font-semibold text-slate-900">What happened outside your control</p>
              {evidence.setbacks.length ? evidence.setbacks.slice(-3).map(x => <p key={x.event_id} className="text-xs">• {x.label}</p>) : <p className="text-xs">No major setbacks.</p>}
            </div>
            <div>
              <p className="font-semibold text-slate-900">How you adjusted</p>
              {adjusted.length ? adjusted.map(o => <p key={o.event_id} className="text-xs">• {o.label}</p>) : <p className="text-xs">No recovery choices were needed or recorded.</p>}
            </div>
            {reveal && (
              <div>
                <p className="font-semibold text-slate-900">One option to explore next time</p>
                <p className="text-xs">{nextTimeSuggestion(reveal)}</p>
              </div>
            )}
          </div>
        </div>

        {summary && (
          <div
            className={`${insetPanelClass} border-violet-200/50 bg-gradient-to-br from-violet-100/35 to-white/25`}
          >
            <h3 className="text-sm font-bold uppercase tracking-wide text-violet-900 mb-2">Coach's recap</h3>
            <p className="text-slate-800 text-sm leading-relaxed whitespace-pre-line">{summary}</p>
          </div>
        )}

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
