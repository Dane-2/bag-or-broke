import React, { useState } from 'react';
import tiers from '../data/tiers';

const shellClass =
  'min-h-screen bg-cover bg-center bg-no-repeat flex items-center justify-center p-4';

const cardClass =
  'w-full max-w-md rounded-2xl bg-white/25 backdrop-blur-xl border border-white/45 shadow-xl shadow-slate-900/10 p-6 md:p-8 space-y-5';

const inputClass =
  'w-full px-4 py-3 rounded-2xl border border-slate-300/60 bg-white/70 text-slate-900 placeholder:text-slate-500 shadow-sm focus:outline-none focus:ring-2 focus:ring-sky-500/80 focus:border-sky-400 transition';

const selectClass =
  'w-full px-4 py-3 rounded-2xl border border-slate-300/60 bg-white/70 text-slate-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-sky-500/80 focus:border-sky-400 transition';

const labelClass = 'block text-xs font-semibold uppercase tracking-wide text-slate-700 mb-2';

function StartScreen({ onStart, onMultiplayer }) {
  const [step, setStep] = useState('mode'); // 'mode' | 'offline'
  const [playerName, setPlayerName] = useState('');
  const [rollValue, setRollValue] = useState('');
  const [gameLength, setGameLength] = useState('');

  const selectedTier = rollValue ? tiers[parseInt(rollValue)] : null;
  const totalCash = selectedTier ? selectedTier.amount + 2500 : 0;

  const bgStyle = { backgroundImage: 'url(/backgroundFinal.png)' };

  if (step === 'mode') {
    return (
      <div className={shellClass} style={bgStyle}>
        <div className={cardClass}>
          <div className="text-center space-y-1">
            <h1 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight">
              Start your NIL journey
            </h1>
            <p className="text-sm text-slate-700">Choose how you want to play</p>
          </div>

          <div className="space-y-3 pt-1">
            <button
              type="button"
              onClick={() => setStep('offline')}
              className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-emerald-500 to-green-600 text-white font-semibold shadow-lg shadow-emerald-600/25 hover:from-emerald-600 hover:to-green-700 active:scale-[0.99] transition"
            >
              Single player (offline)
            </button>

            <button
              type="button"
              onClick={onMultiplayer}
              className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-violet-500 to-purple-600 text-white font-semibold shadow-lg shadow-violet-600/25 hover:from-violet-600 hover:to-purple-700 active:scale-[0.99] transition"
            >
              Multiplayer
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={shellClass} style={bgStyle}>
      <div className={cardClass}>
        <button
          type="button"
          onClick={() => setStep('mode')}
          className="text-sm font-semibold text-slate-700 hover:text-slate-900 flex items-center gap-1 transition"
        >
          ← Back
        </button>

        <h1 className="text-xl md:text-2xl font-bold text-center text-slate-900">
          Single player (offline)
        </h1>

        <div>
          <label htmlFor="player-name" className={labelClass}>
            Player name
          </label>
          <input
            id="player-name"
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value)}
            placeholder="Enter your name"
            className={inputClass}
            autoComplete="name"
          />
        </div>

        <div>
          <label htmlFor="nil-roll" className={labelClass}>
            What did you roll (1–6)?
          </label>
          <select
            id="nil-roll"
            value={rollValue}
            onChange={(e) => setRollValue(e.target.value)}
            className={selectClass}
          >
            <option value="">Select your NIL deal</option>
            {[1, 2, 3, 4, 5, 6].map((num) => (
              <option key={num} value={num}>
                {num}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="game-length" className={labelClass}>
            Game length
          </label>
          <select
            id="game-length"
            value={gameLength}
            onChange={(e) => setGameLength(e.target.value)}
            className={selectClass}
          >
            <option value="">Choose length</option>
            <option value="5">Short game (5 laps)</option>
            <option value="10">Long game (10 laps)</option>
          </select>
        </div>

        {selectedTier && (
          <div className="rounded-2xl border border-white/50 bg-white/35 backdrop-blur-md p-5 space-y-3 text-center shadow-inner">
            <p className="text-base font-bold text-slate-900">
              NIL tier: {selectedTier.label}
            </p>
            <p className="text-sm text-slate-700">
              Base cash: ${selectedTier.amount.toLocaleString()}
            </p>
            <p className="text-sm text-slate-700">+ $2,500 scholarship</p>
            <p className="text-xl font-black text-sky-800 tabular-nums">
              Total: ${totalCash.toLocaleString()}
            </p>

            <button
              type="button"
              onClick={() =>
                onStart(playerName, totalCash, selectedTier.label, parseInt(gameLength, 10))
              }
              disabled={!playerName || !rollValue || !gameLength}
              className="w-full mt-2 py-3.5 rounded-2xl bg-gradient-to-r from-emerald-500 to-green-600 text-white font-semibold shadow-lg shadow-emerald-600/25 hover:from-emerald-600 hover:to-green-700 disabled:opacity-45 disabled:cursor-not-allowed disabled:shadow-none transition"
            >
              Start game
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default StartScreen;
