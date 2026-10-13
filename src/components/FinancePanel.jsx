import React, { useState } from 'react';
import {
  availableUnsecured, currentRateBps, holds, incomeLap, inFinalWindow, loanBalance, loanInterest,
  quoteAdvance, requiredPayment, taxesOwed, totalBorrowing, advanceableAssets, eventLiabilities, pressure,
} from '../rules/ledger';
import { holdingsValue } from '../rules/holdings';
import { annualTax, taxBillCharges, taxBillOwed, taxBillPrincipal } from '../rules/finance';
import { formatCents, fromCents, toCents } from '../rules/money';

const card = 'rounded-2xl bg-white/30 border border-white/45 p-4 space-y-3';
const h4 = 'text-xs font-semibold uppercase tracking-wide text-slate-700';
const field = 'w-full px-3 py-2.5 rounded-xl border border-white/50 bg-white/50 text-slate-900';
const primaryBtn =
  'rounded-full px-4 py-2.5 bg-slate-900 text-white text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed';

function Row({ label, value, strong, tone }) {
  const color = tone === 'bad' ? 'text-red-800' : tone === 'good' ? 'text-emerald-800' : 'text-slate-900';
  return (
    <div className="flex justify-between gap-3 text-sm">
      <span className="text-slate-800">{label}</span>
      <span className={`tabular-nums ${strong ? 'font-bold' : 'font-semibold'} ${color}`}>{value}</span>
    </div>
  );
}

function AmountForm({ placeholder = 'Amount ($)', buttonText, onSubmit, defaultCents }) {
  const [value, setValue] = useState(defaultCents ? String(fromCents(defaultCents)) : '');
  return (
    <form
      className="flex gap-2"
      onSubmit={e => {
        e.preventDefault();
        const cents = toCents(value);
        if (cents > 0 && onSubmit(cents) !== false) setValue('');
      }}
    >
      <input
        type="number"
        inputMode="decimal"
        min="0"
        step="0.01"
        placeholder={placeholder}
        value={value}
        onChange={e => setValue(e.target.value)}
        className={field}
      />
      <button type="submit" className={`${primaryBtn} shrink-0`} disabled={!(toCents(value) > 0)}>
        {buttonText}
      </button>
    </form>
  );
}

function billStatus(bill) {
  if (taxBillOwed(bill) === 0) return { text: 'Paid', tone: 'good' };
  if (bill.originalOverdue !== null) return { text: 'Overdue', tone: 'bad' };
  if (bill.provisional) return { text: 'Due at Finish & Reveal', tone: null };
  return { text: 'Due before your next roll', tone: null };
}

/**
 * Finance tab: Available Cash, Tax Bucket, Total Borrowing and Taxes Owed, with
 * voluntary Pay Debt / Pay Taxes actions. Nothing here advances the game clock.
 */
export default function FinancePanel({ ledger, act }) {
  const [taxSource, setTaxSource] = useState('bucket');
  const [advanceAsset, setAdvanceAsset] = useState('');
  const [showLoans, setShowLoans] = useState(false);

  const required = requiredPayment(ledger);
  const borrowing = totalBorrowing(ledger);
  const owedTax = taxesOwed(ledger);
  const restrictions = holds(ledger).filter(h => h.code !== 'final' || !ledger.snapshot);
  const rate = currentRateBps(ledger) / 100;
  const lap = incomeLap(ledger);
  const lapOpen = !ledger.closedLaps.includes(lap);
  const lapEstimate = lapOpen && ledger.taxIncome[lap] ? annualTax(ledger.taxIncome[lap]) : null;
  const advanceable = advanceableAssets(ledger);
  const selectedAsset = advanceable.find(a => a.id === advanceAsset);
  const advanceQuote = selectedAsset ? quoteAdvance(ledger, { assetId: selectedAsset.id }) : null;
  const policyDebt = holdingsValue(ledger).policyDebt;
  const finalWindow = inFinalWindow(ledger);

  return (
    <div className="space-y-4">
      {finalWindow && (
        <div className="rounded-2xl bg-amber-100/80 border border-amber-300 p-3 text-sm text-amber-950">
          Final lap reached. You can still pay debt and taxes or sell assets. New purchases and borrowing are closed.
          Finish &amp; Reveal is on your profile.
        </div>
      )}

      <section className={card}>
        <h4 className={h4}>Your money</h4>
        <Row label="Available Cash" value={formatCents(ledger.cash)} strong tone={ledger.cash < 0 ? 'bad' : null} />
        <Row label="Tax Bucket" value={formatCents(ledger.taxBucket)} />
        <Row label="Total Borrowing" value={formatCents(borrowing)} tone={borrowing > 0 ? 'bad' : null} />
        {policyDebt > 0 && <Row label="Policy loans (8%, pay from Invest)" value={formatCents(policyDebt)} tone="bad" />}
        {eventLiabilities(ledger) > 0 && <Row label="Event bills" value={formatCents(eventLiabilities(ledger))} tone="bad" />}
        <Row label="Taxes Owed" value={formatCents(owedTax)} tone={owedTax > 0 ? 'bad' : null} />
        <div className="border-t border-white/50 pt-3 space-y-1">
          {(() => {
            const p = pressure(ledger);
            const label = { steady: 'Steady', tight: 'Tight', strained: 'Strained' }[p.financial];
            return (
              <>
                <Row label="Due before your next roll" value={formatCents(p.due)} />
                <Row label="Financial pressure" value={`${label}${p.overdue ? ' · Overdue' : ''}`} tone={p.financial !== 'steady' || p.overdue ? 'bad' : null} />
                <Row label="Commitments" value={`${p.commitment[0].toUpperCase()}${p.commitment.slice(1)} (${p.slots}/3 slots)`} />
              </>
            );
          })()}
        </div>
        <div className="border-t border-white/50 pt-3 space-y-1">
          <Row label="Credit score" value={ledger.creditScore} strong />
          <Row label="Borrowing rate" value={`${rate}% per lap`} />
          <Row label="Available credit" value={formatCents(availableUnsecured(ledger))} />
        </div>
        {restrictions.length > 0 && (
          <ul className="text-xs text-red-900 space-y-1">
            {restrictions.map(h => (
              <li key={h.code}>• {h.message}</li>
            ))}
          </ul>
        )}
      </section>

      <section className={card}>
        <h4 className={h4}>Debt payments</h4>
        {borrowing === 0 ? (
          <p className="text-sm text-slate-800">You have no debt.</p>
        ) : (
          <>
            <Row label="Interest due" value={formatCents(required.interest)} />
            <Row label="Principal due" value={formatCents(required.principal)} />
            <Row label="Required payment" value={formatCents(required.total)} strong />
            {required.overdue > 0 && <Row label="Overdue" value={formatCents(required.overdue)} tone="bad" />}
            <p className="text-xs text-slate-700">
              Required amounts are posted when a lap closes and are due before your next roll. Missing one costs 50
              credit points and pauses new borrowing. Paying early stops interest on that principal.
            </p>
            {required.total > 0 && (
              <button
                type="button"
                className={`${primaryBtn} w-full`}
                disabled={ledger.cash < required.total}
                onClick={() => act('pay_debt', { amount: required.total }, `Paid ${formatCents(required.total)} toward debt`)}
              >
                Pay required {formatCents(required.total)}
              </button>
            )}
            <AmountForm
              buttonText="Pay more"
              onSubmit={amount => act('pay_debt', { amount }, `Paid ${formatCents(amount)} toward debt`)}
            />
            <button type="button" className="text-xs font-semibold text-slate-900 underline" onClick={() => setShowLoans(v => !v)}>
              {showLoans ? 'Hide loans' : `Show loans (${ledger.loans.length})`}
            </button>
            {showLoans &&
              ledger.loans.map(loan => (
                <div key={loan.id} className="rounded-xl bg-white/40 border border-white/50 p-3 space-y-1">
                  <p className="text-sm font-bold text-slate-900">{loan.label}</p>
                  <p className="text-xs text-slate-700">
                    {loan.assetId ? 'Linked to an asset' : loan.residualExit ? 'Left over after a sale' : 'Credit line'}
                  </p>
                  <Row label="Principal" value={formatCents(loan.principal)} />
                  <Row label="Interest owed" value={formatCents(loanInterest(ledger, loan))} />
                  <Row label="Balance" value={formatCents(loanBalance(ledger, loan))} strong />
                  <AmountForm
                    buttonText="Pay loan"
                    onSubmit={amount => act('pay_debt', { amount, loanId: loan.id }, `Paid ${formatCents(amount)} on ${loan.label}`)}
                  />
                </div>
              ))}
          </>
        )}
      </section>

      {(ledger.payables.some(p => p.amount > 0) || ledger.incomeShare) && (
        <section className={card}>
          <h4 className={h4}>Event bills</h4>
          <p className="text-xs text-slate-700">
            Bills from curveballs carry no interest. If one is overdue, new financed purchases pause until it is paid.
          </p>
          {ledger.payables.filter(p => p.amount > 0).map(p => (
            <div key={p.id} className="rounded-xl bg-white/40 border border-white/50 p-3 space-y-1">
              <div className="flex justify-between text-sm">
                <span className="font-bold text-slate-900">{p.label}</span>
                <span className={`text-xs font-semibold ${p.overdue ? 'text-red-800' : 'text-slate-700'}`}>
                  {p.overdue ? 'Overdue' : p.dueTurn <= ledger.turn + 1 ? 'Due before your next roll' : `Due by turn ${p.dueTurn}`}
                </span>
              </div>
              <Row label="Owed" value={formatCents(p.amount)} strong />
              <AmountForm
                buttonText="Pay"
                defaultCents={Math.min(p.amount, Math.max(0, ledger.cash))}
                onSubmit={amount => act('pay_payable', { payableId: p.id, amount }, `Paid ${formatCents(Math.min(amount, p.amount))} on ${p.label}`)}
              />
            </div>
          ))}
          {ledger.incomeShare && (
            <div className="rounded-xl bg-white/40 border border-white/50 p-3 space-y-1">
              <p className="text-sm font-bold text-slate-900">Future earnings advance claim</p>
              <Row label="Takes from each NIL payment" value={`${ledger.incomeShare.shareBps / 100}%`} />
              <Row label="Payments left" value={ledger.incomeShare.receiptLimit - ledger.incomeShare.receipts} />
              <Row label="Paid so far" value={formatCents(ledger.incomeShare.paid)} />
              <Row label="Minimum still owed" value={formatCents(Math.max(0, ledger.incomeShare.minTotal - ledger.incomeShare.paid))} tone="bad" />
              <Row label="Most it can take" value={formatCents(ledger.incomeShare.cap)} />
            </div>
          )}
        </section>
      )}

      <section className={card}>
        <h4 className={h4}>Taxes</h4>
        <p className="text-xs text-slate-700">
          NIL income and the lap award are taxed at 20% when each lap closes. Asset sale gains are taxed at the sale.
        </p>
        {lapEstimate && lapEstimate.tax > 0 && (
          <Row label={`Lap ${lap} so far (estimate)`} value={formatCents(lapEstimate.tax)} />
        )}
        {ledger.taxBills.length === 0 && <p className="text-sm text-slate-800">No tax bills yet.</p>}
        {[...ledger.taxBills].sort((a, b) => a.lap - b.lap).map(bill => {
          const status = billStatus(bill);
          return (
            <div key={bill.id} className="rounded-xl bg-white/40 border border-white/50 p-3 space-y-1">
              <div className="flex justify-between text-sm">
                <span className="font-bold text-slate-900">Lap {bill.lap} tax</span>
                <span className={`text-xs font-semibold ${status.tone === 'bad' ? 'text-red-800' : status.tone === 'good' ? 'text-emerald-800' : 'text-slate-700'}`}>
                  {status.text}
                </span>
              </div>
              <Row label="Assessed" value={formatCents(bill.assessed)} />
              {bill.paid > 0 && <Row label="Paid" value={formatCents(bill.paid)} />}
              {bill.lateFees > 0 && <Row label="Late charges" value={formatCents(bill.lateFees)} tone="bad" />}
              {taxBillOwed(bill) > 0 && (
                <Row label="Owed" value={formatCents(taxBillPrincipal(bill) + taxBillCharges(bill))} strong />
              )}
            </div>
          );
        })}
        {owedTax > 0 && (
          <>
            <div className="grid grid-cols-2 gap-2 text-xs font-semibold">
              {[
                ['bucket', `Tax Bucket (${formatCents(ledger.taxBucket)})`],
                ['cash', `Cash (${formatCents(ledger.cash)})`],
              ].map(([k, text]) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setTaxSource(k)}
                  className={`rounded-xl px-2 py-2 border ${taxSource === k ? 'bg-white/85 border-white text-slate-900' : 'bg-white/25 border-white/40 text-slate-800'}`}
                >
                  Pay from {text}
                </button>
              ))}
            </div>
            <button
              type="button"
              className={`${primaryBtn} w-full`}
              disabled={(taxSource === 'bucket' ? ledger.taxBucket : ledger.cash) <= 0}
              onClick={() => {
                const amount = Math.min(owedTax, taxSource === 'bucket' ? ledger.taxBucket : ledger.cash);
                act('pay_taxes', { amount, source: taxSource }, `Paid ${formatCents(amount)} in taxes`);
              }}
            >
              Pay {formatCents(Math.min(owedTax, Math.max(0, taxSource === 'bucket' ? ledger.taxBucket : ledger.cash)))}
            </button>
            <AmountForm
              buttonText="Pay part"
              onSubmit={amount => act('pay_taxes', { amount, source: taxSource }, `Paid ${formatCents(amount)} in taxes`)}
            />
          </>
        )}
      </section>

      <section className={card}>
        <h4 className={h4}>Tax Bucket</h4>
        <p className="text-xs text-slate-700">
          Money you set aside for taxes. It still counts as yours; moving money in or out is not a tax payment.
        </p>
        <AmountForm
          buttonText="Set aside"
          onSubmit={amount => act('reserve', { amount }, `Moved ${formatCents(amount)} to the Tax Bucket`)}
        />
        {ledger.taxBucket > 0 && (
          <AmountForm
            buttonText="Withdraw"
            onSubmit={amount => act('release', { amount }, `Moved ${formatCents(amount)} back to cash`)}
          />
        )}
      </section>

      <section className={card}>
        <h4 className={h4}>Borrow against an asset</h4>
        <p className="text-xs text-slate-700">
          Borrow up to 50% of an investment's current value, less any loan already linked to it, at your current rate.
        </p>
        {advanceable.length === 0 ? (
          <p className="text-sm text-slate-800">No investments to borrow against yet.</p>
        ) : (
          <>
            <select value={advanceAsset} onChange={e => setAdvanceAsset(e.target.value)} className={field}>
              <option value="">Choose an investment</option>
              {advanceable.map(a => (
                <option key={a.id} value={a.id}>
                  {a.title} — value {formatCents(quoteAdvance(ledger, { assetId: a.id }).value)}
                </option>
              ))}
            </select>
            {advanceQuote && (
              <>
                <Row label="Linked debt" value={formatCents(advanceQuote.linkedDebt)} />
                <Row label="You can borrow" value={formatCents(advanceQuote.max)} strong />
                {advanceQuote.holds.length > 0 && <p className="text-xs text-red-900">{advanceQuote.holds[0].message}</p>}
                {advanceQuote.max > 0 && (
                  <AmountForm
                    buttonText="Borrow"
                    onSubmit={amount =>
                      act(
                        'advance',
                        { assetId: selectedAsset.id, label: selectedAsset.title, amount },
                        `Borrowed ${formatCents(amount)} against ${selectedAsset.title}`
                      )
                    }
                  />
                )}
              </>
            )}
          </>
        )}
      </section>

      {ledger.journal.length > 0 && (
        <section className={card}>
          <h4 className={h4}>Recent activity</h4>
          <ul className="space-y-1">
            {[...ledger.journal].reverse().slice(0, 10).map(entry => (
              <li key={entry.seq} className="flex justify-between gap-3 text-xs text-slate-800">
                <span className="truncate">{entry.label}</span>
                {entry.cashDelta ? (
                  <span className={`tabular-nums font-semibold ${entry.cashDelta < 0 ? 'text-red-800' : 'text-emerald-800'}`}>
                    {formatCents(entry.cashDelta, { sign: true })}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
