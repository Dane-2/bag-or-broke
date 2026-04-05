import React from 'react';

const cardClass =
  'w-full max-w-md rounded-2xl bg-white/25 backdrop-blur-xl border border-white/45 shadow-xl shadow-slate-900/10 p-6 md:p-8 space-y-5';

export default function MultiplayerModeScreen({ onSelect }) {
  return (
    <div
      className="min-h-screen bg-cover bg-center bg-no-repeat flex items-center justify-center p-4"
      style={{ backgroundImage: 'url(/backgroundFinal.png)' }}
    >
      <div className={cardClass}>
        <div className="text-center space-y-1">
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight">
            Multiplayer
          </h1>
          <p className="text-sm text-slate-700">Choose how you want to play</p>
        </div>

        <div className="space-y-3 pt-1">
          <button
            type="button"
            onClick={() => onSelect('host')}
            className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-sky-500 to-blue-600 text-white font-semibold shadow-lg shadow-blue-600/25 hover:from-sky-600 hover:to-blue-700 active:scale-[0.99] transition"
          >
            Host a room
          </button>

          <button
            type="button"
            onClick={() => onSelect('join')}
            className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-emerald-500 to-green-600 text-white font-semibold shadow-lg shadow-emerald-600/25 hover:from-emerald-600 hover:to-green-700 active:scale-[0.99] transition"
          >
            Join a room
          </button>

          <button
            type="button"
            onClick={() => onSelect('back')}
            className="w-full py-3 rounded-2xl bg-white/40 border border-white/50 text-slate-800 font-semibold hover:bg-white/55 active:scale-[0.99] transition"
          >
            ← Back to start
          </button>
        </div>
      </div>
    </div>
  );
}
