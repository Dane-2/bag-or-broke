import React, { useEffect, useMemo, useRef, useState } from 'react';
import PaymentPicker from './PaymentPicker';
import {
  INVESTMENT_CATALOG, LUXURY_CATALOG, RETURN_PROFILES, ACTIVATION, LIFE_TERMS, ANNUITY_TERMS,
  LEGAL_SUPPORT, HEALTH_SUPPORT, isActivation,
} from '../rules/catalog';
import { landingStatus, quoteAcquire, finalProgress } from '../rules/ledger';
import { eligibility, launchValue } from '../rules/holdings';
import { buyAnnuity } from '../rules/finance';
import { formatCents, toCents } from '../rules/money';
import { rollDie } from '../utils/dice';

const glassPanel = 'rounded-2xl bg-white/20 backdrop-blur-lg border border-white/30 shadow-lg';
const selectClass =
  'w-full px-4 py-3 rounded-2xl border border-white/40 bg-white/30 backdrop-blur-md text-slate-900 text-base font-medium focus:outline-none focus:ring-2 focus:ring-cyan-400/80';
const label = 'block text-xs font-semibold uppercase tracking-wide text-slate-600 mb-2';
const pct = bps => `${bps > 0 ? '+' : ''}${bps / 100}%`;
const pctList = list => list.map(pct).join(' · ');

/** Plain-language description of what happens after purchase. */
function laterText(entry, ledger) {
  if (isActivation(entry)) {
    return 'One promotion per lap across both menus. Receipts are business income; no lasting asset is created.';
  }
  if (entry.kind === 'luxury') {
    switch (entry.type) {
      case 'owned_good':
        return `Resale starts at ${formatCents(entry.initialResale)} and falls ${entry.declineBps / 100}% each lap. Selling does not pay off credit used to buy it.`;
      case 'experience':
        return 'An experience: no resale value. You can book it again on a later diamond turn.';
      case 'gift':
        return 'A gift: your family member owns it. No resale value stays with you; any credit used is still yours to repay.';
      case 'companion':
        return `Includes setup and care for this lap. Each later lap, care costs ${formatCents(entry.renewalCare)} (cash or credit) or you can move your companion to trusted household care. No resale value.`;
      default:
        if (entry.completion) {
          const rep = entry.repMax ? ` Delivered work earns up to ${entry.repMax} REP (once per game for this kind of work).` : '';
          return `Delivered on a later turn: ${entry.completion.prompt}${rep}`;
        }
        return 'A service with no resale value.';
    }
  }
  const profile = RETURN_PROFILES[entry.profile] || {};
  switch (entry.type) {
    case 'business':
    case 'property':
    case 'upgrade':
      return profile.continuing_rate_by_launch_face_bps
        ? `After launch, value changes each lap at a rate set by your roll: ${pctList(profile.continuing_rate_by_launch_face_bps)}.${entry.type === 'upgrade' ? ' The upgrade becomes part of the asset it improves.' : ''}`
        : '';
    case 'market_position':
      return `Each full lap you own it, the app rolls a market move: ${pctList(profile.per_lap_draw_bps)}.`;
    case 'company':
    case 'company_property':
      return 'Keeps growing (or shrinking) at its launch rate every lap. High risk: an early result compounds for the rest of the game.';
    case 'event':
      return 'A one-time event: you pay the cost and receive the receipts once. Profit or loss is business income. Once per game.';
    case 'service':
      return entry.service
        ? `One-time discount: ${entry.service.bps / 100}% (up to ${formatCents(entry.service.cap)}) off a later technical-recovery bill for the business you pick. No asset value.`
        : '';
    case 'community_expense':
      return 'A community expense: +4 REP once per game. No asset value and no tax shield.';
    case 'protection': {
      const legal = entry.plan === 'legal';
      return legal
        ? `${entry.uses} future legal matter${entry.uses > 1 ? 's' : ''}. Pays ${LEGAL_SUPPORT.per_matter_assistance_bps / 100}% of eligible legal fees, up to ${formatCents(LEGAL_SUPPORT.per_matter_cap_cents)} per matter. Never pays settlements, taxes or debt. No asset value.`
        : `${entry.uses} future health incident${entry.uses > 1 ? 's' : ''}. Pays ${HEALTH_SUPPORT.assistance_basis_points / 100}% of the health expense, up to ${formatCents(HEALTH_SUPPORT.cap_per_incident_cents)} each. No asset value.`;
    }
    case 'fixed_contract':
      if (entry.life) {
        return `Cash value grows ${LIFE_TERMS.growth_bps / 100}% per owned lap. After one owned lap you can borrow up to 75% of it at 8% per lap. Death benefit ${formatCents(entry.life.face)} (not counted in your score).`;
      }
      if (entry.annuity) {
        const terms = buyAnnuity(entry.annuity, ledger.progress / ledger.boardSize);
        const due = [0, 1].filter(k => ledger.progress + (entry.annuity.wait + k) * ledger.boardSize <= finalProgress(ledger)).length;
        return `Pays ${formatCents(terms.payment1)} after ${entry.annuity.wait} owned lap${entry.annuity.wait > 1 ? 's' : ''} and ${formatCents(terms.payment2)} one lap later. ${due} of 2 payments expected before this game ends. Cancel before the first payment for its value less ${ANNUITY_TERMS.cancel_before_first_fee_bps / 100}%.`;
      }
      return '';
    default:
      return '';
  }
}

function Outcomes({ entry, price }) {
  if (isActivation(entry)) {
    return (
      <table className="w-full text-xs text-slate-800">
        <tbody>
          {ACTIVATION.outcomes.map(o => (
            <tr key={o.die} className="border-b border-white/30">
              <td className="py-1 font-bold">{o.die}</td>
              <td>{o.label}</td>
              <td className="text-right tabular-nums">{formatCents((price * o.gross_receipts_bps) / 10000)}</td>
              <td className="text-right">{o.rep_ceiling ? `up to ${o.rep_ceiling} REP` : ''}</td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  }
  if (!Array.isArray(entry.launchTable)) return null;
  const isEvent = entry.type === 'event';
  return (
    <div className="grid grid-cols-3 gap-1.5 text-xs">
      {entry.launchTable.map((bps, i) => (
        <div key={i} className="rounded-lg bg-white/35 border border-white/40 px-2 py-1.5 text-center">
          <p className="font-bold text-slate-900">{i + 1}</p>
          <p className={bps < 0 ? 'text-red-800' : 'text-emerald-800'}>{pct(bps)}</p>
          <p className="tabular-nums text-slate-700">
            {formatCents(launchValue(price, entry.launchTable, i + 1))}
            {isEvent ? ' back' : ''}
          </p>
        </div>
      ))}
    </div>
  );
}

function PurchasePanel({ entry, ledger, onAcquire, onClose }) {
  const [method, setMethod] = useState('cash');
  const [cashPortion, setCashPortion] = useState('');
  const [face, setFace] = useState(null);
  const [targetId, setTargetId] = useState('');
  const [optionBps, setOptionBps] = useState(entry.entryOptionsBps ? entry.entryOptionsBps[entry.entryOptionsBps.length - 1] : 10000);
  const [confirmed, setConfirmed] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    setTimeout(() => ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
  }, [entry.id]);

  const base = quoteAcquire(ledger, { entryId: entry.id, targetId: targetId || null, optionBps });
  const cashPart = method === 'cash' || entry.cashOnly ? base.price : Math.min(base.price, toCents(cashPortion));
  const q = quoteAcquire(ledger, { entryId: entry.id, cashPart, targetId: targetId || null, optionBps });
  const targets = eligibility(ledger, entry).targets || [];
  const needsTarget = isActivation(entry) || ['attach', 'attach_rental', 'service'].includes(entry.parentMode);
  const needsFace = isActivation(entry) || Array.isArray(entry.launchTable);
  const missing = [];
  if (needsTarget && !targetId) missing.push(isActivation(entry) ? 'Choose a business to promote.' : 'Choose the asset to upgrade.');
  if (needsFace && !face) missing.push('Enter your die roll.');
  if (entry.type === 'companion' && !confirmed) missing.push('Confirm housing and a backup caregiver.');
  const fundingKind = q.funding.kind;
  const canConfirm = q.ok && missing.length === 0;

  const changeMethod = m => {
    setMethod(m);
    if (m === 'finance') setCashPortion(String(fundingKind === 'investment' ? Math.ceil(base.price / 200) : 0));
  };

  return (
    <div ref={ref} className={`${glassPanel} p-4 md:p-6 space-y-4`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">{entry.typeLabel}</p>
          <h3 className="text-base font-bold text-slate-900">{entry.title}</h3>
          <p className="text-sm text-slate-800 mt-1">
            Price {formatCents(q.price)}
            {q.discount > 0 && <span className="text-emerald-800"> (creator discount −{formatCents(q.discount)})</span>}
          </p>
          {entry.scope && <p className="text-xs text-slate-700 mt-1">{entry.scope}</p>}
        </div>
        <button type="button" onClick={onClose} className="text-sm px-3 py-1.5 rounded-full bg-white/30 border border-white/40 text-slate-800 shrink-0">
          Close
        </button>
      </div>

      {(Array.isArray(entry.launchTable) || isActivation(entry)) && (
        <div className="space-y-2">
          <p className={label}>{entry.type === 'event' ? 'What you get back, by roll' : isActivation(entry) ? 'Receipts by roll' : 'Launch result by roll'}</p>
          <Outcomes entry={entry} price={q.price} />
        </div>
      )}

      <p className="text-sm text-slate-800">{laterText(entry, ledger)}</p>
      {entry.rules?.length > 0 && (
        <ul className="text-xs text-slate-700 space-y-1">
          {entry.rules.map(r => (
            <li key={r}>• {r}</li>
          ))}
        </ul>
      )}

      {entry.entryOptionsBps && entry.entryOptionsBps.length > 1 && (
        <div>
          <p className={label}>Ownership</p>
          <div className="grid grid-cols-2 gap-2">
            {entry.entryOptionsBps.map(bps => (
              <button
                key={bps}
                type="button"
                onClick={() => setOptionBps(bps)}
                className={`rounded-xl px-3 py-2 text-sm font-semibold border ${optionBps === bps ? 'bg-white/85 border-white text-slate-900' : 'bg-white/25 border-white/40 text-slate-800'}`}
              >
                {bps / 100}% — {formatCents((entry.price * bps) / 10000)}
              </button>
            ))}
          </div>
        </div>
      )}

      {needsTarget && (
        <div>
          <p className={label}>{isActivation(entry) ? 'Business to promote' : entry.parentMode === 'service' ? 'Business it supports' : 'Asset to upgrade'}</p>
          <select value={targetId} onChange={e => setTargetId(e.target.value)} className="w-full px-3 py-2.5 rounded-xl border border-white/40 bg-white/25 text-slate-900">
            <option value="">Choose…</option>
            {targets.map(t => (
              <option key={t.id} value={t.id}>
                {t.title}
              </option>
            ))}
          </select>
        </div>
      )}

      {needsFace && (
        <div>
          <p className={label}>Your die roll</p>
          <div className="grid grid-cols-7 gap-1.5">
            {[1, 2, 3, 4, 5, 6].map(n => (
              <button
                key={n}
                type="button"
                onClick={() => setFace(n)}
                className={`rounded-xl py-2 text-sm font-bold border ${face === n ? 'bg-slate-900 text-white border-slate-900' : 'bg-white/35 border-white/50 text-slate-900'}`}
              >
                {n}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setFace(rollDie())}
              className="rounded-xl py-2 text-[11px] font-semibold border bg-white/20 border-white/50 text-slate-900"
              title="Let the app roll a fair die"
            >
              🎲
            </button>
          </div>
        </div>
      )}

      {entry.type === 'companion' && (
        <label className="flex items-start gap-2 text-sm text-slate-900">
          <input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} className="mt-1" />
          <span>I have suitable housing and a backup caregiver for this companion.</span>
        </label>
      )}

      <PaymentPicker
        kind={fundingKind}
        cashOnly={entry.cashOnly}
        method={method}
        setMethod={changeMethod}
        cashPortion={cashPortion}
        setCashPortion={setCashPortion}
        quote={{ ...q.funding, errors: q.errors }}
      />

      <button
        type="button"
        disabled={!canConfirm}
        onClick={() => {
          if (onAcquire({ entryId: entry.id, cashPart, face, targetId: targetId || null, optionBps, confirmed })) onClose();
        }}
        className="w-full px-4 py-3 rounded-2xl bg-gradient-to-r from-emerald-500 to-green-600 text-white font-semibold shadow-lg disabled:opacity-45 disabled:cursor-not-allowed"
      >
        Confirm purchase
      </button>
      {q.ok && missing.length > 0 && <p className="text-xs text-slate-800">{missing[0]}</p>}
    </div>
  );
}

function Tile({ entry, ledger, selected, onSelect }) {
  const el = eligibility(ledger, entry);
  const muted = !el.ok;
  return (
    <button
      type="button"
      onClick={() => onSelect(entry)}
      className={`text-left rounded-2xl p-3 border transition ${
        selected
          ? 'border-emerald-400/80 bg-white/40 ring-2 ring-emerald-400/50'
          : muted
            ? 'border-white/20 bg-white/10'
            : 'border-white/35 bg-white/20 hover:bg-white/30'
      }`}
    >
      <p className={`text-sm font-bold leading-snug ${muted ? 'text-slate-700' : 'text-slate-900'}`}>{entry.title}</p>
      <p className="text-xs text-slate-800 mt-1 tabular-nums">{formatCents(entry.price)}</p>
      <p className="text-[11px] text-slate-700 mt-0.5">{entry.typeLabel}</p>
      {muted && <p className="text-[11px] text-red-900 mt-1 leading-tight">{el.reason}</p>}
    </button>
  );
}

/** Green or diamond catalog with a quote-driven purchase panel. */
export default function CatalogMenu({ kind, ledger, onAcquire }) {
  const catalog = kind === 'investment' ? INVESTMENT_CATALOG : LUXURY_CATALOG;
  const groups = useMemo(() => ['All', ...new Set(catalog.map(e => e.group))], [catalog]);
  const [group, setGroup] = useState('All');
  const [selected, setSelected] = useState(null);
  const landing = landingStatus(ledger, { kind });

  const shown = catalog.filter(e => group === 'All' || e.group === group);
  // Diamond landing: three suggestions you can buy now, rotating with the space you landed on.
  const picks = useMemo(() => {
    if (kind !== 'luxury' || !landing.ok) return [];
    const ok = LUXURY_CATALOG.filter(e => eligibility(ledger, e).ok && e.price <= ledger.cash);
    const start = ledger.opportunity ? (ledger.opportunity.index * 7) % Math.max(1, ok.length) : 0;
    return [0, 1, 2].map(i => ok[(start + i * 5) % ok.length]).filter((e, i, arr) => e && arr.indexOf(e) === i);
  }, [kind, landing.ok, ledger]);

  return (
    <div className="space-y-4">
      <div className={`rounded-2xl p-3 text-sm border ${landing.ok ? 'bg-emerald-100/70 border-emerald-300 text-emerald-950' : 'bg-white/30 border-white/45 text-slate-900'}`}>
        {landing.ok
          ? `You landed on a ${kind === 'investment' ? 'green' : 'diamond'} space: you can make one purchase.`
          : `${landing.reason} You can still browse.`}
      </div>

      {picks.length > 0 && (
        <div>
          <p className={label}>Picks for this space</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {picks.map(e => (
              <Tile key={e.id} entry={e} ledger={ledger} selected={selected?.id === e.id} onSelect={setSelected} />
            ))}
          </div>
        </div>
      )}

      <div>
        <label className={label} htmlFor={`group-${kind}`}>
          {kind === 'investment' ? 'Industry' : 'Category'}
        </label>
        <select id={`group-${kind}`} value={group} onChange={e => setGroup(e.target.value)} className={selectClass}>
          {groups.map(g => (
            <option key={g} value={g}>
              {g}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {shown.map(e => (
          <Tile key={e.id} entry={e} ledger={ledger} selected={selected?.id === e.id} onSelect={setSelected} />
        ))}
      </div>

      {selected && (
        <PurchasePanel key={selected.id} entry={selected} ledger={ledger} onAcquire={onAcquire} onClose={() => setSelected(null)} />
      )}
    </div>
  );
}
