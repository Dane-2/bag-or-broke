import React, { useState } from 'react';
import { formatCents } from '../rules/money';
import { ventureBuyStatus, linkedDebt } from '../rules/ledger';
import { isActive } from '../rules/holdings';
import { GAIN_TAX_BPS } from '../rules/venture';

const card = 'rounded-xl bg-white/35 border border-white/50 p-3 space-y-2';
const btn = 'rounded-full px-3 py-1.5 text-xs font-semibold border';
const primary = `${btn} bg-slate-900 text-white border-slate-900 disabled:opacity-40`;
const secondary = `${btn} bg-white/50 border-white/60 text-slate-900 disabled:opacity-40`;

const pct = units => `${units / 100}%`;

/** My holding in a venture (founder's complex or a partner stake). */
function myHolding(ledger, ventureId) {
  return ledger.assets.find(a => isActive(a) && a.ventureId === ventureId && (a.holding === 'growth' || a.holding === 'venture_stake'));
}

/** Estimated seller net from this ledger's own basis and linked loans. */
function sellerEstimate(ledger, holding, units, gross) {
  const basisSold = Math.round((holding.basis * units) / holding.units);
  const tax = Math.round((Math.max(0, gross - basisSold) * GAIN_TAX_BPS) / 10000);
  const payoff = Math.round((linkedDebt(ledger, holding.id) * units) / holding.units);
  return { tax, payoff, net: gross - tax - payoff };
}

function Venture({ v, ledger, selfId, names, onBuy, onList }) {
  const mine = myHolding(ledger, v.id);
  const myUnits = (v.owners && v.owners[selfId]) || 0;
  const listedByMe = (v.listings && v.listings[selfId]) || 0;
  const [offer, setOffer] = useState(Math.min(2000, myUnits) || 100);
  const closed = v.stopped || v.failed;
  const lap = (v.founder_progress / 40).toFixed(1);
  const offerGross = Math.round((v.value_cents * offer) / 10000);
  const est = mine && offer <= mine.units ? sellerEstimate(ledger, mine, offer, offerGross) : null;

  return (
    <div className={card}>
      <div className="flex justify-between gap-2">
        <p className="text-sm font-bold text-slate-900">{v.title}</p>
        {closed && <span className="text-[11px] font-bold text-red-800">{v.failed ? 'Closed' : 'Founder finished'}</span>}
      </div>
      <p className="text-xs text-slate-700">
        Founder {v.founder_name || names[v.founder_id] || 'player'} · company value {formatCents(v.value_cents)} · founder's clock lap {lap}
      </p>
      <ul className="text-xs text-slate-800">
        {Object.entries(v.owners || {}).filter(([, u]) => u > 0).map(([id, u]) => (
          <li key={id}>
            {id === selfId ? 'You' : names[id] || 'Player'}: {pct(u)} ({formatCents(Math.round((v.value_cents * u) / 10000))})
            {v.frozen && v.frozen[id] ? ' · finished' : ''}
          </li>
        ))}
      </ul>

      {!closed && Object.entries(v.listings || {}).filter(([id, u]) => u > 0 && id !== selfId).map(([seller, units]) => {
        const gross = Math.round((v.value_cents * units) / 10000);
        const status = ventureBuyStatus(ledger, { gross, sellerId: seller, selfId, founderStopped: v.stopped });
        return (
          <div key={seller} className="rounded-lg bg-white/60 border border-white/70 p-2 text-xs text-slate-800">
            <p>
              {names[seller] || 'A player'} offers {pct(units)} for <span className="font-bold">{formatCents(gross)}</span> (cash only, no debt transfers to you)
            </p>
            <button type="button" className={`${primary} mt-1`} disabled={!status.ok} onClick={() => onBuy(v, seller, units)}>
              Buy {pct(units)}
            </button>
            {!status.ok && <p className="text-red-800 mt-1">{status.reason}</p>}
          </div>
        );
      })}

      {!closed && mine && myUnits > 0 && !(v.frozen && v.frozen[selfId]) && (
        <div className="space-y-1">
          <p className="text-xs font-semibold text-slate-900">
            You own {pct(myUnits)}{listedByMe ? ` · offering ${pct(listedByMe)}` : ''}
          </p>
          <div className="flex items-center gap-2">
            <select value={offer} onChange={e => setOffer(Number(e.target.value))} className="px-2 py-1 rounded-lg border border-white/60 bg-white/70 text-xs">
              {Array.from({ length: myUnits / 100 }, (_, i) => (i + 1) * 100).map(u => (
                <option key={u} value={u}>
                  {pct(u)} of the company
                </option>
              ))}
            </select>
            <button type="button" className={primary} onClick={() => onList(v.id, offer)}>
              Offer for sale
            </button>
            {listedByMe > 0 && (
              <button type="button" className={secondary} onClick={() => onList(v.id, 0)}>
                Withdraw
              </button>
            )}
          </div>
          {est && (
            <p className="text-[11px] text-slate-700">
              At today's value: {formatCents(offerGross)} gross, {formatCents(est.tax)} gain tax{est.payoff ? `, ${formatCents(est.payoff)} to your linked loan` : ''} → you receive about {formatCents(est.net)}.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

/** Shared sports complexes in this room: cap table, listings, buy and offer. */
export default function VenturePanel({ ventures, ledger, selfId, names, onBuy, onList }) {
  if (!ventures.length) {
    return <p className="text-sm text-slate-800">When a player buys the Sports Complex, its shares appear here.</p>;
  }
  return (
    <div className="space-y-3">
      <p className="text-xs text-slate-700">
        Percentages are of the whole company. The company grows on the founder's clock; buyers pay today's value and share later changes.
      </p>
      {ventures.map(v => (
        <Venture key={v.id} v={v} ledger={ledger} selfId={selfId} names={names} onBuy={onBuy} onList={onList} />
      ))}
    </div>
  );
}
