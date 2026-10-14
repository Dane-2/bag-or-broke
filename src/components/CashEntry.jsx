import React, { useState } from 'react';
import { TAX_RATE_BPS } from '../rules/finance';
import { applyBps, formatCents, toCents } from '../rules/money';

const TAX_PCT = TAX_RATE_BPS / 100;

/**
 * Manual money entry for the companion app. Taxable NIL income can be split between
 * Available Cash and the Tax Bucket at the moment it arrives.
 */
export default function CashEntry({ onIncome, onOther, onSpend, onInvoice }) {
  const [mode, setMode] = useState(null); // 'in' | 'spend'
  const [kind, setKind] = useState('nil'); // 'nil' | 'later' | 'other'
  const [amount, setAmount] = useState('');
  const [label, setLabel] = useState('');
  const [setAside, setSetAside] = useState(true);

  const cents = toCents(amount);
  const reserve = kind === 'nil' && setAside ? applyBps(cents, TAX_RATE_BPS) : 0;

  const reset = () => {
    setMode(null);
    setAmount('');
    setLabel('');
    setKind('nil');
    setSetAside(true);
  };

  const submit = e => {
    e.preventDefault();
    if (!(cents > 0)) return;
    let ok;
    if (mode === 'spend') ok = onSpend(cents, label || 'Spent cash');
    else if (kind === 'nil') ok = onIncome(cents, reserve, label || 'NIL income');
    else if (kind === 'later') ok = onInvoice(cents, label || 'NIL invoice');
    else ok = onOther(cents, label || 'Money in (not taxed)');
    if (ok !== false) reset();
  };

  if (!mode) {
    return (
      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => setMode('in')}
          className="flex-1 rounded-full py-3 px-4 bg-gradient-to-r from-emerald-500 to-green-600 text-white text-sm font-semibold shadow-lg shadow-emerald-500/30 hover:from-emerald-600 hover:to-green-700 transition"
        >
          + Add Cash
        </button>
        <button
          type="button"
          onClick={() => setMode('spend')}
          className="flex-1 rounded-full py-3 px-4 bg-white/35 backdrop-blur-md border border-white/50 text-red-900 text-sm font-semibold shadow-lg hover:bg-white/45 transition"
        >
          − Spend Cash
        </button>
      </div>
    );
  }

  const field = 'w-full px-3 py-2.5 rounded-xl border border-white/50 bg-white/50 text-slate-900';

  return (
    <form onSubmit={submit} className="space-y-3 rounded-2xl bg-white/30 border border-white/45 p-3">
      <p className="text-sm font-bold text-slate-900">{mode === 'spend' ? 'Spend cash' : 'Add cash'}</p>
      {mode === 'in' && (
        <div className="grid grid-cols-3 gap-2 text-xs font-semibold">
          {[
            ['nil', `NIL income (taxed ${TAX_PCT}%)`],
            ['later', 'NIL paid later (invoice)'],
            ['other', 'Other (not taxed)'],
          ].map(([k, text]) => (
            <button
              key={k}
              type="button"
              onClick={() => setKind(k)}
              className={`rounded-xl px-2 py-2 border ${kind === k ? 'bg-white/85 border-white text-slate-900' : 'bg-white/25 border-white/40 text-slate-800'}`}
            >
              {text}
            </button>
          ))}
        </div>
      )}
      <input
        autoFocus
        type="number"
        inputMode="numeric"
        min="0"
        placeholder="Amount ($)"
        value={amount}
        onChange={e => setAmount(e.target.value)}
        className={field}
      />
      <input
        type="text"
        placeholder="What was it? (optional)"
        value={label}
        onChange={e => setLabel(e.target.value)}
        className={field}
      />
      {mode === 'in' && kind === 'later' && (
        <p className="text-xs text-slate-800">Work is done; the sponsor pays in 2 turns (1 with a representative). It is taxed when the money arrives.</p>
      )}
      {mode === 'in' && kind === 'nil' && (
        <label className="flex items-start gap-2 text-sm text-slate-900">
          <input type="checkbox" checked={setAside} onChange={e => setSetAside(e.target.checked)} className="mt-1" />
          <span>
            Set aside {TAX_PCT}% ({formatCents(applyBps(cents, TAX_RATE_BPS))}) in your Tax Bucket. It is still your money;
            taxes are paid from Finance.
          </span>
        </label>
      )}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={!(cents > 0)}
          className="flex-1 rounded-full py-2.5 bg-slate-900 text-white text-sm font-semibold disabled:opacity-40"
        >
          Confirm
        </button>
        <button type="button" onClick={reset} className="rounded-full px-4 py-2.5 bg-white/40 text-slate-900 text-sm font-semibold">
          Cancel
        </button>
      </div>
    </form>
  );
}
