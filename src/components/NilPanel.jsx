import React from 'react';
import { yellowCard, yellowChoices, YELLOW_COPY, TASK_SLOTS, openTaskSlots } from '../rules/nil';
import { TAX_RATE_BPS } from '../rules/finance';
import { isActive } from '../rules/holdings';
import { formatCents } from '../rules/money';
import { adviseYellow } from '../rules/coach';
import CoachButton from './CoachButton';

const card = 'rounded-xl bg-white/35 border border-white/50 p-3 space-y-2';
const btn = 'rounded-full px-3 py-1.5 text-xs font-semibold border';
const primary = `${btn} bg-slate-900 text-white border-slate-900 disabled:opacity-40`;
const secondary = `${btn} bg-white/50 border-white/60 text-slate-900 disabled:opacity-40`;

function baseLine(y) {
  const b = y.base || {};
  if (b.token) return 'Emergency Fund added: pays up to $25,000 of one future covered curveball expense. No cash value.';
  if (b.recovered) return `${formatCents(b.recovered)} returned to your cash. This restores a loss; it is not new income.`;
  if (b.cash) {
    const tax = Math.round((b.cash * TAX_RATE_BPS) / 10000);
    return `${formatCents(b.cash)} added to your cash${b.target ? ` (license on ${b.target})` : ''}. It counts toward this lap's tax (about ${formatCents(tax)}).`;
  }
  return null;
}

function ChoiceButton({ choice, cardId, onChoose }) {
  let detail = null;
  if (choice.task) {
    detail = `Takes 1 task slot. Complete it on your next turn to earn ${formatCents(choice.reward)}. Skipping it costs nothing.`;
  } else if (cardId === 'Y12' && choice.id === 'use') {
    detail = 'No cash and no resale value. Adds $30,000 of NIL income at delivery (about $6,000 game tax). 0 REP.';
  } else if (cardId === 'Y12') {
    detail = 'No cost, no tax and no REP change.';
  }
  return (
    <button
      type="button"
      disabled={!choice.available}
      onClick={() => onChoose(choice.id)}
      className="w-full text-left rounded-xl bg-white/50 border border-white/60 px-3 py-2 disabled:opacity-50"
    >
      <p className="text-sm font-bold text-slate-900">{choice.label}</p>
      {detail && <p className="text-xs text-slate-700 mt-0.5">{detail}</p>}
      {choice.reason && <p className="text-xs text-red-800 mt-0.5">{choice.reason}</p>}
    </button>
  );
}

/** The yellow card drawn this turn, its choices, and the player's follow-up tasks. */
export default function NilPanel({ ledger, act }) {
  const y = ledger.yellow;
  const current = y && y.cardId ? yellowCard(y.cardId) : null;
  const tasks = ledger.tasks.filter(t => t.status === 'open');
  const recent = ledger.tasks.filter(t => t.status !== 'open').slice(-3).reverse();
  const tokens = ledger.assets.filter(a => isActive(a) && a.holding === 'token' && a.uses > 0);
  const used = openTaskSlots(ledger);

  if (!y && !tasks.length && !recent.length && !tokens.length) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-700/80">⭐ NIL opportunities &amp; tasks</h3>
        <span className="text-xs font-semibold text-slate-800">
          Tasks {used}/{TASK_SLOTS}
        </span>
      </div>

      {y && y.status === 'clear' && (
        <div className={card}>
          <p className="text-sm font-bold text-slate-900">All clear this turn</p>
          <p className="text-xs text-slate-700">No NIL opportunity fits your situation right now.</p>
        </div>
      )}

      {current && (
        <div className={`${card} bg-yellow-100/70 border-yellow-300`}>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-yellow-900">{YELLOW_COPY[current.id]?.benefit}</p>
          <p className="text-base font-bold text-slate-900">{current.title}</p>
          <p className="text-sm text-slate-800">{YELLOW_COPY[current.id]?.scene}</p>
          {baseLine(y) && <p className="text-sm font-semibold text-slate-900">{baseLine(y)}</p>}
          {y.status === 'pending' ? (
            <div className="space-y-2">
              <CoachButton ledger={ledger} act={act} decisionId={y.id} compute={() => adviseYellow(ledger)} />
              {yellowChoices(ledger, current).map(choice => (
                <ChoiceButton
                  key={choice.id}
                  choice={choice}
                  cardId={current.id}
                  onChoose={id => act('yellow_choose', { choiceId: id }, 'Choice saved')}
                />
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-700">Chosen: {ledger.yellowHistory[ledger.yellowHistory.length - 1]?.choice}</p>
          )}
        </div>
      )}

      {tasks.map(t => {
        const due = ledger.turn >= t.dueTurn;
        if (t.mandatory) {
          return (
            <div key={t.id} className={card}>
              <p className="text-sm font-bold text-slate-900">{t.label}</p>
              <p className="text-xs text-slate-700">{t.title} · uses {t.slots} slot{t.slots > 1 ? 's' : ''} · ends on its own after turn {t.dueTurn}</p>
            </div>
          );
        }
        const earns = t.reward > 0 ? `earns ${formatCents(t.reward)}` : t.onComplete && t.onComplete.length ? 'completes its follow-up' : 'no extra payment';
        return (
          <div key={t.id} className={card}>
            <p className="text-sm font-bold text-slate-900">{t.label}</p>
            <p className="text-xs text-slate-700">
              {t.title} · {earns} · {due ? 'due this turn' : 'due next turn'}
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                className={primary}
                disabled={!due}
                onClick={() => act('task_complete', { taskId: t.id }, null, r => {
                  const pts = r.points && (r.points.rep || r.points.career) ? ` · +${r.points.rep || 0} REP, +${r.points.career || 0} Career` : '';
                  return `Task done${r.reward > 0 ? `: +${formatCents(r.reward)}` : ''}${pts}`;
                })}
              >
                {due ? 'Complete task' : 'Complete next turn'}
              </button>
              <button
                type="button"
                className={secondary}
                onClick={() => {
                  if (window.confirm('Release this task? You keep everything already earned; this extra payment is forgone.')) {
                    act('task_release', { taskId: t.id }, 'Task released');
                  }
                }}
              >
                Release
              </button>
            </div>
          </div>
        );
      })}

      {recent.length > 0 && (
        <ul className="text-xs text-slate-800 space-y-0.5">
          {recent.map(t => (
            <li key={t.id}>
              {t.label}: {t.status === 'completed' ? `completed${t.reward > 0 ? ` (+${formatCents(t.reward)})` : ''}` : t.status}
            </li>
          ))}
        </ul>
      )}

      {tokens.length > 0 && (
        <p className="text-xs font-semibold text-slate-900">🛟 Emergency Fund ready: up to {formatCents(tokens[0].limit)} on one covered curveball.</p>
      )}
    </div>
  );
}
