import React from 'react';
import { formatCents } from '../rules/money';

const fieldClass = 'w-full px-3 py-2.5 rounded-xl border border-white/40 bg-white/25 text-slate-900';
const labelClass = 'block text-xs font-semibold uppercase tracking-wide text-slate-600 mb-2';

/**
 * Cash / financing choice with a live quote from the finance ledger.
 * kind: 'investment' (secured, at least 50% cash) or 'luxury' (unsecured credit, cash/credit/split).
 */
export default function PaymentPicker({ kind, cashOnly, method, setMethod, cashPortion, setCashPortion, quote }) {
  const financeLabel = kind === 'luxury' ? 'Credit or split' : 'Finance up to 50%';
  const ratePct = quote ? quote.rateBps / 100 : 0;

  return (
    <div className="space-y-3">
      <div>
        <label className={labelClass}>Payment</label>
        <select
          value={method}
          onChange={e => setMethod(e.target.value)}
          className={fieldClass}
          disabled={cashOnly}
        >
          <option value="cash">Pay with cash</option>
          <option value="finance" disabled={cashOnly}>
            {financeLabel}
            {cashOnly ? ' (not available)' : ''}
          </option>
        </select>
        {cashOnly && <p className="text-xs text-slate-600 mt-1.5">Cash purchase only</p>}
      </div>

      {method === 'finance' && (
        <div>
          <label className={labelClass}>Cash now ($)</label>
          <input
            type="number"
            inputMode="numeric"
            min="0"
            value={cashPortion}
            onChange={e => setCashPortion(e.target.value)}
            className={fieldClass}
          />
          {quote && quote.minCash > 0 && (
            <p className="text-xs text-slate-600 mt-1.5">Minimum cash: {formatCents(quote.minCash)}</p>
          )}
        </div>
      )}

      {quote && (
        <div className="rounded-xl bg-white/30 border border-white/40 p-3 text-sm text-slate-800 space-y-1">
          <div className="flex justify-between">
            <span>Cash now</span>
            <span className="font-semibold tabular-nums">{formatCents(quote.cashPart)}</span>
          </div>
          <div className="flex justify-between">
            <span>Cash after</span>
            <span className="font-semibold tabular-nums">{formatCents(quote.cashAfter)}</span>
          </div>
          {quote.borrow > 0 && (
            <>
              <div className="flex justify-between">
                <span>New debt</span>
                <span className="font-semibold tabular-nums text-red-800">{formatCents(quote.borrow)}</span>
              </div>
              <div className="flex justify-between">
                <span>Rate</span>
                <span className="font-semibold tabular-nums">{ratePct}% per lap, simple</span>
              </div>
              {quote.estimatedMinimum && (
                <div className="flex justify-between">
                  <span>Est. due at this lap's close</span>
                  <span className="font-semibold tabular-nums">{formatCents(quote.estimatedMinimum.total)}</span>
                </div>
              )}
              {quote.availableCredit !== null && (
                <div className="flex justify-between">
                  <span>Credit left after</span>
                  <span className="font-semibold tabular-nums">
                    {formatCents(Math.max(0, quote.availableCredit - quote.borrow))}
                  </span>
                </div>
              )}
              {kind === 'investment' && (
                <p className="text-xs text-slate-600">The loan is linked to this asset and repaid first if you sell it.</p>
              )}
            </>
          )}
          {quote.errors.map(err => (
            <p key={err} className="text-xs font-semibold text-red-700">{err}</p>
          ))}
        </div>
      )}
    </div>
  );
}
