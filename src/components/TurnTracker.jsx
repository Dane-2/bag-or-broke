import React, { useState } from 'react';
import brand from '../rules/config/brand.json';
import { completedLaps, finalProgress, inFinalWindow, position } from '../rules/ledger';
import { boardSpace } from '../rules';

const SPACE_COLORS = {
  start: '#FFFFFF',
  green: brand.colors.green,
  yellow: brand.colors.yellow,
  diamond: brand.colors.diamond_aqua,
  red: brand.colors.red,
  blue: brand.colors.blue,
  purple: brand.colors.purple,
};

/** Category tab each landing opens in the companion app. */
export const SPACE_TABS = {
  green: 'invest',
  diamond: 'luxury',
  red: 'curveballs',
  blue: 'curveballs',
  purple: 'curveballs',
};

/**
 * Logs the player's own movement roll. Rolling is the payment deadline for the previous lap,
 * so it is the one place where board progress, lap closes and credit checkpoints happen.
 */
export default function TurnTracker({ ledger, onRoll, onOpenTab }) {
  const [diceCount, setDiceCount] = useState(ledger.diceCount || 1);
  const locked = ledger.diceCount !== null;
  const dice = locked ? ledger.diceCount : diceCount;
  const done = completedLaps(ledger);
  const final = inFinalWindow(ledger) || Boolean(ledger.snapshot);
  const pct = Math.min(100, Math.round((ledger.progress / finalProgress(ledger)) * 100));
  const space = ledger.progress > 0 && !final ? boardSpace(position(ledger)) : null;
  const options = Array.from({ length: 5 * dice + 1 }, (_, i) => i + dice);

  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center gap-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-700/80 flex items-center gap-2">
          <span aria-hidden>🏁</span> Game progress
        </h3>
        <span className="text-sm font-semibold text-slate-800 tabular-nums">
          Lap {done} / {ledger.totalLaps} complete
        </span>
      </div>

      <div className="h-3 rounded-full bg-white/30 overflow-hidden border border-white/25">
        <div
          className="h-full rounded-full bg-gradient-to-r from-violet-500 via-fuchsia-500 to-cyan-400 transition-all duration-500 ease-out shadow-sm"
          style={{ width: `${pct}%` }}
        />
      </div>

      {space && (
        <div className="flex items-center justify-between gap-2 rounded-xl bg-white/30 border border-white/40 px-3 py-2">
          <div className="flex items-center gap-2 min-w-0">
            <span
              className="w-4 h-4 rounded-full border border-slate-900/20 shrink-0"
              style={{ backgroundColor: SPACE_COLORS[space.category] }}
              aria-hidden
            />
            <span className="text-sm font-semibold text-slate-900 truncate">
              Space {space.index}: {space.label}
            </span>
          </div>
          {SPACE_TABS[space.category] && (
            <button
              type="button"
              onClick={() => onOpenTab(SPACE_TABS[space.category])}
              className="text-xs font-semibold px-3 py-1 rounded-full bg-white/50 border border-white/60 text-slate-900 shrink-0"
            >
              Open
            </button>
          )}
        </div>
      )}

      {final ? (
        <p className="text-sm font-semibold text-slate-900">
          Final lap reached. Use Finance to settle up, then Finish &amp; Reveal from your profile.
        </p>
      ) : (
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-700">Log your roll</p>
            {!locked && (
              <div className="flex rounded-full bg-white/30 border border-white/40 p-0.5 text-xs font-semibold">
                {[1, 2].map(n => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setDiceCount(n)}
                    className={`px-2.5 py-1 rounded-full ${diceCount === n ? 'bg-white/80 text-slate-900' : 'text-slate-700'}`}
                  >
                    {n} {n === 1 ? 'die' : 'dice'}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="grid grid-cols-6 gap-2">
            {options.map(n => (
              <button
                key={n}
                type="button"
                onClick={() => onRoll(n, dice)}
                className="rounded-xl py-2.5 bg-gradient-to-br from-sky-600 to-blue-600 text-white text-sm font-bold shadow-md shadow-blue-600/25 hover:from-sky-700 hover:to-blue-700 active:scale-[0.97] transition tabular-nums"
              >
                {n}
              </button>
            ))}
          </div>
          {!locked && (
            <p className="text-xs text-slate-700 mt-2">Choose 1 or 2 dice before your first roll. It stays the same all game.</p>
          )}
        </div>
      )}
    </div>
  );
}
