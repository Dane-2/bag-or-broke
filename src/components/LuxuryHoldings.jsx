import React, { useState } from 'react';
import { catalogEntry } from '../rules/catalog';
import { assetValue, isActive } from '../rules/holdings';
import { availableUnsecured } from '../rules/ledger';
import { formatCents } from '../rules/money';

const card = 'rounded-xl bg-white/35 border border-white/50 p-3 space-y-1.5';
const btn = 'rounded-full px-3 py-1.5 text-xs font-semibold border';
const primary = `${btn} bg-slate-900 text-white border-slate-900 disabled:opacity-40`;
const secondary = `${btn} bg-white/50 border-white/60 text-slate-900 disabled:opacity-40`;

function ServiceCard({ ledger, a, act }) {
  const entry = catalogEntry(a.cardId);
  const choices = entry?.completion?.choices || null;
  const [choice, setChoice] = useState(choices ? choices[0] : null);
  const ready = ledger.progress > a.acquiredAt;
  return (
    <div className={card}>
      <p className="text-sm font-bold text-slate-900">{a.title}</p>
      <p className="text-xs text-slate-700">{entry?.completion?.prompt || 'Complete this service.'}</p>
      {choices && (
        <select value={choice} onChange={e => setChoice(e.target.value)} className="w-full px-3 py-1.5 rounded-lg border border-white/50 bg-white/60 text-sm text-slate-900">
          {choices.map(c => (
            <option key={c}>{c}</option>
          ))}
        </select>
      )}
      <button
        type="button"
        className={primary}
        disabled={!ready}
        onClick={() => act('complete_service', { assetId: a.id, choice }, null, r =>
          r.rep > 0 ? `${a.title} delivered: +${r.rep} REP` : `${a.title} delivered`
        )}
      >
        {ready ? 'Mark delivered' : 'Delivered on a later turn'}
      </button>
    </div>
  );
}

function CompanionCard({ ledger, a, act }) {
  const due = a.pendingCare;
  const credit = availableUnsecured(ledger);
  return (
    <div className={card}>
      <p className="text-sm font-bold text-slate-900">{a.title}</p>
      {due ? (
        <>
          <p className="text-xs text-slate-800">Care for lap {due.lap}: {formatCents(due.amount)}</p>
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              className={primary}
              disabled={ledger.cash < due.amount}
              onClick={() => act('companion_care', { assetId: a.id, method: 'cash' }, `Paid ${formatCents(due.amount)} for ${a.title}'s care`)}
            >
              Pay cash
            </button>
            <button
              type="button"
              className={secondary}
              disabled={credit < due.amount}
              onClick={() => act('companion_care', { assetId: a.id, method: 'credit', cashPart: 0 }, `${a.title}'s care put on credit`)}
            >
              Use credit
            </button>
            <button
              type="button"
              className={secondary}
              onClick={() => {
                if (window.confirm(`Move ${a.title} to permanent trusted household care? Future care stops. There is no resale value, and any existing debt stays.`)) {
                  act('companion_care', { assetId: a.id, method: 'rehome' }, `${a.title} is now in trusted household care`);
                }
              }}
            >
              Trusted household care
            </button>
          </div>
        </>
      ) : (
        <p className="text-xs text-slate-700">Care is paid for this lap.</p>
      )}
    </div>
  );
}

/** Owned luxury items, open services and companions. */
export default function LuxuryHoldings({ ledger, act }) {
  const mine = ledger.assets.filter(a => a.kind === 'luxury' && isActive(a));
  const goods = mine.filter(a => a.holding === 'lux_good');
  const services = mine.filter(a => a.holding === 'lux_service');
  const companions = mine.filter(a => a.holding === 'companion');
  const history = ledger.purchases.filter(p => p.kind === 'luxury' && !mine.some(a => a.id === p.assetId));

  if (!mine.length && !history.length) return <p className="text-sm text-slate-800">No luxury purchases yet.</p>;
  return (
    <div className="space-y-4">
      {companions.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-700">Companions</p>
          {companions.map(a => <CompanionCard key={a.id} ledger={ledger} a={a} act={act} />)}
        </div>
      )}
      {services.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-700">To deliver</p>
          {services.map(a => <ServiceCard key={a.id} ledger={ledger} a={a} act={act} />)}
        </div>
      )}
      {goods.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-700">Owned items</p>
          {goods.map(a => (
            <div key={a.id} className={`${card} flex items-center justify-between gap-2`}>
              <div>
                <p className="text-sm font-bold text-slate-900">{a.title}</p>
                <p className="text-xs text-slate-700">
                  Resale {formatCents(assetValue(ledger, a))} · falls {a.declineBps / 100}% per lap
                </p>
              </div>
              <button
                type="button"
                className={secondary}
                onClick={() => {
                  if (window.confirm(`Sell ${a.title} for ${formatCents(assetValue(ledger, a))}? Credit used to buy it is not paid off automatically.`)) {
                    act('sell_asset', { assetId: a.id }, `${a.title} sold for ${formatCents(assetValue(ledger, a))}`);
                  }
                }}
              >
                Sell
              </button>
            </div>
          ))}
        </div>
      )}
      {history.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-700">Past purchases</p>
          {history.map((p, i) => (
            <p key={`${p.entryId}-${i}`} className="text-xs text-slate-800">
              {p.title} — {formatCents(p.price)}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
