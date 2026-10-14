import React, { useState } from 'react';

/**
 * "What Would Coach J-Bo Do?" for one decision. The first time a decision is asked about it
 * spends one of three game credits; showing it again is free. `compute` builds the advice
 * from what is already on screen.
 */
export default function CoachButton({ ledger, act, decisionId, compute }) {
  const cached = ledger.coach.cache[decisionId];
  const [open, setOpen] = useState(Boolean(cached));
  const credits = ledger.coach.credits;

  const ask = () => {
    if (cached) {
      setOpen(v => !v);
      return;
    }
    const advice = compute();
    if (act('coach_advice', { decisionId, advice }, null, r => `Coach J-Bo advice (${r.credits} credit${r.credits === 1 ? '' : 's'} left)`)) setOpen(true);
  };

  const advice = cached;
  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={ask}
        disabled={!cached && credits <= 0}
        className="w-full rounded-xl px-3 py-2 text-xs font-bold border border-amber-300 bg-amber-100/80 text-amber-950 disabled:opacity-50"
      >
        🏈 {cached ? (open ? 'Hide Coach J-Bo advice' : 'Show Coach J-Bo advice again (free)') : `What Would Coach J-Bo Do? (${credits} credit${credits === 1 ? '' : 's'} left)`}
      </button>
      {open && advice && (
        <div className="rounded-xl bg-amber-50/90 border border-amber-200 p-3 text-xs text-slate-900 space-y-1">
          <p className="font-bold">Coach J-Bo: {advice.recommendation}</p>
          {(advice.reasons || []).map(r => (
            <p key={r}>• {r}</p>
          ))}
          <p>
            <span className="font-semibold">Tradeoff:</span> {advice.tradeoff}
          </p>
          {advice.alternative && (
            <p>
              <span className="font-semibold">Another good option:</span> {advice.alternative}
            </p>
          )}
          <p className="text-[10px] text-slate-600">Advice uses only what you can see. It can't see stored rolls, and the choice is yours.</p>
        </div>
      )}
    </div>
  );
}
