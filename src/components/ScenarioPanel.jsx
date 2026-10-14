import React, { useState } from 'react';
import { curveball, requirementMet, activeRestrictions, RESTRICTION_LABELS, COMPONENT_LABELS } from '../rules/scenarios';
import { quoteScenario } from '../rules/ledger';
import { isActive } from '../rules/holdings';
import { formatCents } from '../rules/money';

const card = 'rounded-xl bg-white/35 border border-white/50 p-3 space-y-2';
const btn = 'rounded-full px-3 py-1.5 text-xs font-semibold border';
const primary = `${btn} bg-slate-900 text-white border-slate-900 disabled:opacity-40`;
const secondary = `${btn} bg-white/50 border-white/60 text-slate-900 disabled:opacity-40`;

/** Describe effects without numbers that depend on hidden rolls. */
function describe(effects, card) {
  return effects
    .map(e => {
      switch (e.op) {
        case 'expense':
          return `${COMPONENT_LABELS[e.component] || e.component}${e.amount?.fixed_cents ? ` ${formatCents(e.amount.fixed_cents)}` : ''}`;
        case 'event_payable':
          return `${COMPONENT_LABELS[e.component] || 'Bill'} ${formatCents(e.amount.fixed_cents)} due in ${e.due_own_turns} turn${e.due_own_turns > 1 ? 's' : ''}`;
        case 'restriction':
          return `${RESTRICTION_LABELS[e.kind] || e.kind.replace(/_/g, ' ')} for ${e.own_turns} turn${e.own_turns > 1 ? 's' : ''}`;
        case 'task':
          return `Takes ${e.slots} task slot${e.slots > 1 ? 's' : ''}; due next turn`;
        case 'resolve_table':
          return 'Outcome uses a die roll (table below)';
        case 'rep_delta':
          return `${e.points > 0 ? '+' : ''}${e.points} REP`;
        case 'cash_advance':
          return `Receive ${formatCents(e.amount.fixed_cents)} now (borrowed, not income)`;
        case 'start_transfer_process':
          return e.mode === 'entered' ? 'Enter the transfer portal (no guaranteed return)' : 'Search while keeping your place';
        case 'asset_write_down':
        case 'asset_write_down_tagged':
          return 'Lowers the value of the affected holding';
        case 'restore_prior_value_loss':
          return 'Restores lost value';
        case 'income_share_contract':
          return `Claim: ${e.share_basis_points / 100}% of your next ${e.receipt_limit} NIL payments, capped at ${formatCents(e.total_cap_cents)}`;
        default:
          return null;
      }
    })
    .filter(Boolean);
}

function scheduledText(choice) {
  return (choice.scheduled || []).flatMap(sc =>
    sc.effects.map(e => {
      if (e.op === 'cash_income') return `Complete the task to earn ${formatCents(e.amount.fixed_cents)}`;
      if (e.op === 'rep_delta' || e.op === 'career_delta') return `Complete the task for +${e.points} ${e.op === 'rep_delta' ? 'REP' : 'Career'} (once per game)`;
      if (e.op === 'refund_loss') return `Some money comes back in ${sc.after_own_turns} turns`;
      if (e.op === 'restore_prior_value_loss') return e.requires ? 'Complete the task to restore value' : `Value partly restored in ${sc.after_own_turns} turns`;
      if (e.op === 'reduce_existing_payable') return `Complete the task to cut the bill by ${formatCents(e.amount.fixed_cents)}`;
      return null;
    })
  ).filter(Boolean);
}

function ChanceTable({ table }) {
  return (
    <div className="grid grid-cols-6 gap-1 text-[10px]">
      {Object.entries(table.die_faces).map(([face, effects]) => (
        <div key={face} className="rounded bg-white/50 border border-white/60 p-1 text-center">
          <p className="font-bold text-slate-900">{face}</p>
          <p className="text-slate-700 leading-tight">
            {effects.length === 0
              ? 'No further cost'
              : effects.map(e => (e.amount?.fixed_cents !== undefined ? formatCents(e.amount.fixed_cents) : e.op === 'clear_event_restriction' ? 'Lifted' : e.op === 'refund_loss' ? `${(e.amount.basis_points || 0) / 100}% back` : e.op === 'record_outcome' ? 'OK' : '')).join(' ')}
          </p>
        </div>
      ))}
    </div>
  );
}

function Pending({ ledger, act }) {
  const sc = ledger.scenario;
  const c = curveball(sc.cardId);
  const [choiceId, setChoiceId] = useState(null);
  const plans = ledger.assets.filter(a => isActive(a) && a.uses > 0);
  const has = plan => plans.some(a => a.holding === 'plan' && a.plan === plan);
  const hasToken = plans.some(a => a.holding === 'token');
  const target0 = sc.targetId ? ledger.assets.find(a => a.id === sc.targetId) : null;
  const hasService = plans.some(a => a.holding === 'service_credit' && a.targetId === sc.targetId) ||
    (ledger.career.referral && !ledger.career.referral.used && target0 && ['YSH_TEAM', 'YSH_CENTER', 'YSH_COMPLEX'].includes(target0.cardId));
  const allEffects = [...(c.immediate || []), ...c.choices.flatMap(ch => ch.effects), ...Object.values(c.chance || {}).flatMap(t => Object.values(t.die_faces).flat())];
  const uses = comp => allEffects.some(e => e.op === 'expense' && e.component === comp);
  const [elect, setElect] = useState({ legal: false, health: false, token: false, service: false });
  const options = [
    has('legal') && uses('eligible_legal_fee') && ['legal', 'Use Legal Support (80% of legal fees)'],
    has('health') && uses('health_expense') && ['health', 'Use Health Support (80% of health expense)'],
    hasService && ['website_platform_remediation', 'operating_remediation', 'equipment_repair'].some(uses) && ['service', 'Use a service discount (Coach, Web Developer or sports referral)'],
    hasToken && (c.immediate || []).some(e => e.op === 'expense') && ['token', 'Use Emergency Fund on what remains'],
  ].filter(Boolean);
  const target = sc.targetId ? ledger.assets.find(a => a.id === sc.targetId) : null;

  return (
    <div className={`${card} ${c.color === 'red' ? 'bg-red-100/70 border-red-300' : 'bg-sky-100/70 border-sky-300'}`}>
      <p className={`text-[11px] font-semibold uppercase tracking-wide ${c.color === 'red' ? 'text-red-900' : 'text-sky-900'}`}>
        {c.color === 'red' ? 'Financial curveball' : 'Life & sport curveball'}
      </p>
      <p className="text-base font-bold text-slate-900">{c.title}</p>
      <p className="text-sm text-slate-800">{c.scene}</p>
      {sc.targetTitle && <p className="text-xs font-semibold text-slate-800">Affects: {sc.targetTitle}</p>}
      {(c.immediate || []).length > 0 && (
        <div className="text-xs text-slate-800">
          <p className="font-semibold">Happens either way:</p>
          <ul>{describe(c.immediate, c).map(t => <li key={t}>• {t}</li>)}</ul>
        </div>
      )}
      {options.length > 0 && (
        <div className="space-y-1">
          {options.map(([key, text]) => (
            <label key={key} className="flex items-center gap-2 text-xs font-semibold text-slate-900">
              <input type="checkbox" checked={elect[key]} onChange={e => setElect(prev => ({ ...prev, [key]: e.target.checked }))} />
              {text}
            </label>
          ))}
        </div>
      )}
      <div className="space-y-2">
        {c.choices.map(choice => {
          const met = choice.requires.every(r => requirementMet(ledger, r, target));
          const q = met ? quoteScenario(ledger, choice.id, elect) : { available: false, reason: 'Not available right now.' };
          const selected = choiceId === choice.id;
          const table = choice.effects.find(e => e.op === 'resolve_table');
          return (
            <button
              key={choice.id}
              type="button"
              disabled={!q.available}
              onClick={() => setChoiceId(choice.id)}
              className={`w-full text-left rounded-xl px-3 py-2 border disabled:opacity-50 ${selected ? 'bg-white border-slate-900' : 'bg-white/60 border-white/70'}`}
            >
              <p className="text-sm font-bold text-slate-900">{choice.label}</p>
              <ul className="text-xs text-slate-700">
                {describe(choice.effects, c).map(t => <li key={t}>• {t}</li>)}
                {scheduledText(choice).map(t => <li key={t}>• {t}</li>)}
              </ul>
              {q.available && (
                <p className="text-xs font-semibold text-slate-900 mt-1">
                  Cash now {formatCents(q.cashDelta, { sign: true })}
                  {q.assistance > 0 && ` · support pays ${formatCents(q.assistance)}`}
                  {q.newBills.length > 0 && ` · new bills ${formatCents(q.newBills.reduce((t, b) => t + b.amount, 0))}`}
                  {q.chance && ' · plus the roll result'}
                </p>
              )}
              {!q.available && <p className="text-xs text-red-800 mt-1">{q.reason}</p>}
              {selected && table && <div className="mt-2"><ChanceTable table={c.chance[table.table]} /></div>}
            </button>
          );
        })}
      </div>
      <button
        type="button"
        className={`${primary} w-full py-2`}
        disabled={!choiceId}
        onClick={() =>
          act('scenario_respond', { choiceId, elect }, null, r => {
            const parts = [`Cash ${formatCents(r.cashDelta, { sign: true })}`];
            if (r.assistance > 0) parts.push(`support paid ${formatCents(r.assistance)}`);
            const roll = r.lines.find(l => l.kind === 'roll');
            if (roll) parts.push(`rolled ${roll.face}`);
            if (r.points.rep) parts.push(`${r.points.rep > 0 ? '+' : ''}${r.points.rep} REP`);
            return `${c.title}: ${parts.join(' · ')}`;
          })
        }
      >
        Confirm response
      </button>
    </div>
  );
}

function Portal({ ledger, act }) {
  const p = ledger.portal;
  return (
    <div className={card}>
      <p className="text-sm font-bold text-slate-900">Transfer portal ({p.mode === 'entered' ? 'entered' : 'gathering information'})</p>
      {p.stage === 'searching' && <p className="text-xs text-slate-700">Offers arrive at the start of your next turn.</p>}
      {p.stage === 'placed' && <p className="text-xs text-slate-700">You transferred. Finish the academic paperwork task; the new team fit shows up after it.</p>}
      {p.stage === 'offers' &&
        p.offers.map(o => (
          <div key={o.id} className="rounded-lg bg-white/60 border border-white/70 p-2 text-xs text-slate-800">
            <p className="font-bold text-slate-900">{o.title}</p>
            <p>
              Signing NIL {formatCents(o.nil_signing_cash_cents)} · moving cost {formatCents(o.uncovered_move_cost_cents)} · {o.role} · academic task {o.academic_task_slots} slot
              {o.academic_task_slots > 1 ? 's' : ''}
            </p>
            <button type="button" className={`${primary} mt-1`} onClick={() => act('portal_accept', { offerId: o.id }, `Accepted: ${o.title}`)}>
              Accept
            </button>
          </div>
        ))}
      <button type="button" className={secondary} onClick={() => act('portal_stay', {}, p.mode === 'information' ? 'You stayed with your current team' : 'You left the transfer process')}>
        {p.mode === 'information' ? 'Stay with my current team' : 'Stop the transfer process'}
      </button>
      <p className="text-[11px] text-slate-600">Fictional game timing and odds, not real NCAA transfer rules.</p>
    </div>
  );
}

/** Current curveball, transfer portal and active restrictions. */
export default function ScenarioPanel({ ledger, act }) {
  const sc = ledger.scenario;
  const restrictions = activeRestrictions(ledger);
  const last = ledger.scenarioHistory[ledger.scenarioHistory.length - 1];
  return (
    <div className="space-y-3">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-700/80">⚡ Curveballs</h3>
      {sc && sc.status === 'clear' && (
        <div className={card}>
          <p className="text-sm font-bold text-slate-900">All clear this turn</p>
          <p className="text-xs text-slate-700">No curveball fits your situation right now.</p>
        </div>
      )}
      {sc && sc.status === 'pending' && <Pending key={sc.id} ledger={ledger} act={act} />}
      {sc && sc.status === 'resolved' && last && last.turn === sc.turn && (
        <div className={card}>
          <p className="text-sm font-bold text-slate-900">{last.title}</p>
          <p className="text-xs text-slate-700">Chose: {last.choice}</p>
          <ul className="text-xs text-slate-800">
            {last.lines.map((l, i) => (
              <li key={i}>
                {l.kind === 'expense' && `• ${l.label}: ${formatCents(l.gross)}${l.help ? ` (support ${formatCents(l.help)})` : ''}, paid ${formatCents(l.paidNow)}`}
                {l.kind === 'payable' && `• Bill: ${l.label} ${formatCents(l.amount)}`}
                {l.kind === 'value' && `• ${l.label} value ${formatCents(l.amount, { sign: true })}`}
                {l.kind === 'refund' && `• Recovered ${formatCents(l.amount)}`}
                {l.kind === 'advance' && `• ${l.label}: ${formatCents(l.amount)}`}
                {l.kind === 'roll' && `• Rolled ${l.face}`}
                {l.kind === 'income' && `• ${l.label} ${formatCents(l.amount)}`}
                {l.kind === 'paid' && `• ${l.label} ${formatCents(l.amount)}`}
                {l.kind === 'restriction' && `• ${RESTRICTION_LABELS[l.kind2] || l.kind2} for ${l.turns} turn${l.turns > 1 ? 's' : ''}`}
              </li>
            ))}
          </ul>
        </div>
      )}
      {ledger.portal && <Portal ledger={ledger} act={act} />}
      {restrictions.length > 0 && (
        <ul className="text-xs text-slate-900">
          {restrictions.map((r, i) => (
            <li key={i}>⛔ {RESTRICTION_LABELS[r.kind] || r.kind.replace(/_/g, ' ')} — through turn {r.untilTurn}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Curveball history for the Events tab. */
export function ScenarioHistory({ ledger }) {
  if (!ledger.scenarioHistory.length) return <p className="text-sm text-slate-800">Land on a red or blue space to face a curveball.</p>;
  return (
    <ul className="space-y-1 text-xs text-slate-900">
      {[...ledger.scenarioHistory].reverse().map((h, i) => (
        <li key={i}>
          <span className={`font-semibold ${h.color === 'red' ? 'text-red-800' : 'text-sky-800'}`}>{h.title}</span> — {h.choice} · cash{' '}
          {formatCents(h.cashDelta, { sign: true })}
          {h.assistance > 0 && ` · support ${formatCents(h.assistance)}`}
        </li>
      ))}
    </ul>
  );
}
