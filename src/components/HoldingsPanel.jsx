import React, { useState } from 'react';
import { catalogEntry } from '../rules/catalog';
import {
  assetValue, policyLoanQuote, annuityCancelQuote, isActive,
} from '../rules/holdings';
import { holds, linkedDebt, quoteSell } from '../rules/ledger';
import { formatCents, toCents } from '../rules/money';

const card = 'rounded-xl bg-white/35 border border-white/50 p-3 space-y-1.5';
const btn = 'rounded-full px-3 py-1.5 text-xs font-semibold border';
const primary = `${btn} bg-slate-900 text-white border-slate-900 disabled:opacity-40`;
const secondary = `${btn} bg-white/50 border-white/60 text-slate-900`;
const pct = bps => `${bps > 0 ? '+' : ''}${bps / 100}%`;

function Row({ k, v, tone }) {
  return (
    <div className="flex justify-between gap-3 text-xs">
      <span className="text-slate-700">{k}</span>
      <span className={`tabular-nums font-semibold ${tone === 'bad' ? 'text-red-800' : 'text-slate-900'}`}>{v}</span>
    </div>
  );
}

function AmountRow({ button, onSubmit, presets = [] }) {
  const [v, setV] = useState('');
  return (
    <div className="space-y-1.5">
      {presets.length > 0 && (
        <div className="flex gap-1.5">
          {presets.map(([text, cents]) => (
            <button key={text} type="button" className={secondary} disabled={!(cents > 0)} onClick={() => onSubmit(cents)}>
              {text}
            </button>
          ))}
        </div>
      )}
      <form
        className="flex gap-2"
        onSubmit={e => {
          e.preventDefault();
          if (toCents(v) > 0 && onSubmit(toCents(v)) !== false) setV('');
        }}
      >
        <input
          type="number"
          inputMode="decimal"
          min="0"
          step="0.01"
          placeholder="Amount ($)"
          value={v}
          onChange={e => setV(e.target.value)}
          className="w-full px-3 py-1.5 rounded-lg border border-white/50 bg-white/60 text-sm text-slate-900"
        />
        <button type="submit" className={primary} disabled={!(toCents(v) > 0)}>
          {button}
        </button>
      </form>
    </div>
  );
}

function sellFlow(ledger, a, act) {
  const value = assetValue(ledger, a);
  let q = quoteSell(ledger, { assetId: a.id, value, basis: a.basis });
  let residualExit = false;
  if (!q.ok) {
    const r = quoteSell(ledger, { assetId: a.id, value, basis: a.basis, residualExit: true });
    if (!window.confirm(
      `${a.title} is worth ${formatCents(r.gross)} but its loan is ${formatCents(r.debtPaid + r.residual)}.\n\n` +
      `Sell anyway? ${formatCents(r.residual)} of the loan stays as debt and new borrowing pauses until it is repaid.`
    )) return;
    residualExit = true;
    q = r;
  } else {
    const lines = [`Sale value: ${formatCents(q.gross)}`];
    if (q.tax > 0) lines.push(`Gain tax (20%): -${formatCents(q.tax)}`);
    if (q.debtPaid > 0) lines.push(`Linked loan payoff: -${formatCents(q.debtPaid)}`);
    lines.push(q.cashDelta >= 0 ? `You receive: ${formatCents(q.cashDelta)}` : `You pay from cash: ${formatCents(-q.cashDelta)}`);
    if (!window.confirm(`Sell ${a.title}?\n\n${lines.join('\n')}`)) return;
  }
  act('sell_asset', { assetId: a.id, residualExit }, `${a.title} sold. Cash ${formatCents(q.cashDelta, { sign: true })}`);
}

function GrowthCard({ ledger, a, act }) {
  const entry = catalogEntry(a.cardId);
  const value = assetValue(ledger, a);
  const debt = linkedDebt(ledger, a.id);
  const market = a.holding === 'market';
  return (
    <div className={card}>
      <div className="flex justify-between gap-2">
        <p className="text-sm font-bold text-slate-900">{a.title}</p>
        {a.failed && <span className="text-[11px] font-bold text-red-800">Closed</span>}
      </div>
      {a.ownershipBps && a.ownershipBps !== 10000 && <p className="text-xs text-slate-700">You own {a.ownershipBps / 100}%</p>}
      <Row k="Value" v={formatCents(value)} />
      <Row k="Cost basis" v={formatCents(a.basis)} />
      {debt > 0 && <Row k="Linked loan" v={formatCents(debt)} tone="bad" />}
      {a.launchFace && entry?.launchTable && <Row k="Launch roll" v={`${a.launchFace} (${pct(entry.launchTable[a.launchFace - 1])})`} />}
      {!market && !a.failed && <Row k="Rate per lap" v={pct(a.rateBps)} />}
      {market && a.draws.length > 0 && <Row k="Market rolls" v={a.draws.map(d => pct(d.bps)).join(', ')} />}
      {(a.stages || []).length > 0 && (
        <Row k="Upgrades" v={a.stages.map(id => catalogEntry(id)?.title || id).join(', ')} />
      )}
      {entry?.saleRoute === 'central_market_sale' && (
        <button type="button" className={secondary} onClick={() => sellFlow(ledger, a, act)}>
          Sell
        </button>
      )}
    </div>
  );
}

function LifeCard({ ledger, a, act }) {
  const q = policyLoanQuote(ledger, a, holds(ledger).filter(h => h.code !== 'score'));
  const status = { ok: null, no_more_borrowing: 'No further borrowing; coverage active', at_risk: 'Coverage at risk' }[q.status];
  return (
    <div className={card}>
      <p className="text-sm font-bold text-slate-900">{a.title}</p>
      <Row k="Cash value" v={formatCents(q.value)} />
      <Row k="Policy loan" v={formatCents(q.balance)} tone={q.balance > 0 ? 'bad' : null} />
      <Row k="Net protection" v={formatCents(q.netProtection)} />
      {status && <p className="text-xs font-semibold text-red-800">{status}</p>}
      {q.waiting ? (
        <p className="text-xs text-slate-700">Loans available after one full owned lap.</p>
      ) : (
        <>
          <Row k="Available policy loan" v={formatCents(q.max)} />
          {q.max > 0 && (
            <AmountRow
              button="Borrow"
              presets={[['25%', Math.floor(q.max / 4)], ['50%', Math.floor(q.max / 2)], ['Max', q.max]]}
              onSubmit={amount => act('policy_loan', { assetId: a.id, amount }, `Borrowed ${formatCents(amount)} from ${a.title}`)}
            />
          )}
        </>
      )}
      {q.balance > 0 && (
        <AmountRow
          button="Repay"
          presets={[['Pay interest', q.interest], ['Pay off', q.balance]]}
          onSubmit={amount => act('policy_pay', { assetId: a.id, amount }, `Paid ${formatCents(amount)} on the policy loan`)}
        />
      )}
      <button
        type="button"
        className={secondary}
        onClick={() => {
          if (window.confirm(`Cancel ${a.title}? You receive ${formatCents(Math.max(0, q.value - q.balance))}, the loan is cleared and protection ends. Any gain over the premium is taxable.`)) {
            act('policy_cancel', { assetId: a.id }, `${a.title} cancelled`);
          }
        }}
      >
        Cancel policy
      </button>
    </div>
  );
}

function AnnuityCard({ ledger, a, act }) {
  const q = annuityCancelQuote(ledger, a);
  const nextDue = a.acquiredAt + (a.terms.wait + a.paymentsMade) * ledger.boardSize;
  return (
    <div className={card}>
      <p className="text-sm font-bold text-slate-900">{a.title}</p>
      <Row k="Contract value" v={formatCents(q.value)} />
      <Row k="Payments received" v={`${a.paymentsMade} of 2`} />
      {a.paymentsMade < 2 && (
        <Row
          k="Next payment"
          v={`${formatCents(a.paymentsMade === 0 ? a.terms.payment1 : a.terms.payment2)} at lap ${(nextDue / ledger.boardSize).toFixed(nextDue % ledger.boardSize ? 1 : 0)}`}
        />
      )}
      {q.allowed ? (
        <button
          type="button"
          className={secondary}
          onClick={() => {
            if (window.confirm(`Receive ${formatCents(q.proceeds)} now. The ${formatCents(q.fee)} cancellation charge is included. Your two future payments will end.`)) {
              act('annuity_cancel', { assetId: a.id }, `${a.title} cancelled: +${formatCents(q.proceeds)}`);
            }
          }}
        >
          Cancel and receive cash
        </button>
      ) : (
        <p className="text-xs text-slate-700">Payments have started; the remaining schedule is locked.</p>
      )}
    </div>
  );
}

function PlanCard({ a }) {
  return (
    <div className={card}>
      <p className="text-sm font-bold text-slate-900">{a.title}</p>
      <Row k="Uses left" v={`${a.uses} of ${a.usesBought}`} />
    </div>
  );
}

/** Owned investments, contracts and protection plans with their actions. */
export default function HoldingsPanel({ ledger, act }) {
  const [showClosed, setShowClosed] = useState(false);
  const mine = ledger.assets.filter(a => a.kind === 'investment');
  const active = mine.filter(isActive);
  const closed = mine.filter(a => !isActive(a));
  const section = (title, list, render) =>
    list.length > 0 && (
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-700">{title}</p>
        {list.map(render)}
      </div>
    );

  if (mine.length === 0) return <p className="text-sm text-slate-800">No investments yet.</p>;
  return (
    <div className="space-y-4">
      {section('Businesses & property', active.filter(a => a.holding === 'growth'), a => <GrowthCard key={a.id} ledger={ledger} a={a} act={act} />)}
      {section('Market positions', active.filter(a => a.holding === 'market'), a => <GrowthCard key={a.id} ledger={ledger} a={a} act={act} />)}
      {section('Life insurance', active.filter(a => a.holding === 'life'), a => <LifeCard key={a.id} ledger={ledger} a={a} act={act} />)}
      {section('Annuities', active.filter(a => a.holding === 'annuity'), a => <AnnuityCard key={a.id} ledger={ledger} a={a} act={act} />)}
      {section('Protections', active.filter(a => a.holding === 'plan'), a => <PlanCard key={a.id} a={a} />)}
      {closed.length > 0 && (
        <button type="button" className="text-xs font-semibold text-slate-900 underline" onClick={() => setShowClosed(v => !v)}>
          {showClosed ? 'Hide history' : `Show history (${closed.length})`}
        </button>
      )}
      {showClosed &&
        closed.map(a => (
          <p key={a.id} className="text-xs text-slate-800">
            {a.title}: {a.status.replace('_', ' ')}
            {a.closedValue ? ` at ${formatCents(a.closedValue)}` : ''}
          </p>
        ))}
    </div>
  );
}
