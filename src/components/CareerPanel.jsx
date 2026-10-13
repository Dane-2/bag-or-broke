import React, { useState } from 'react';
import { PATHS, family, path, familyChoices, familyScene, pathAllowed, INTERNSHIP } from '../rules/career';

const card = 'rounded-xl bg-white/35 border border-white/50 p-3 space-y-2';
const btn = 'rounded-full px-3 py-1.5 text-xs font-semibold border';
const primary = `${btn} bg-slate-900 text-white border-slate-900 disabled:opacity-40`;
const secondary = `${btn} bg-white/50 border-white/60 text-slate-900 disabled:opacity-40`;

function pointsLabel(f) {
  if (f.id === 'internship') return `${INTERNSHIP.completion_reward.rep} REP · ${INTERNSHIP.completion_reward.career} Career when completed next turn`;
  return `${f.rep} REP · ${f.career} Career`;
}

function Offer({ ledger, act }) {
  const offer = ledger.career.offer;
  const f = family(offer.family);
  const [pathId, setPathId] = useState('');
  const allowed = pathId ? pathAllowed(ledger, f.id, pathId) : { ok: true };
  const choices = pathId ? familyChoices(f.id, pathId) : [];
  const hasExperience = ledger.career.experience.length > 0;

  return (
    <div className={`${card} bg-violet-100/70 border-violet-300`}>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-violet-900">Career opportunity</p>
      <p className="text-base font-bold text-slate-900">{f.name}</p>
      <p className="text-xs font-semibold text-slate-800">{pointsLabel(f)}</p>
      <select value={pathId} onChange={e => setPathId(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-white/60 bg-white/70 text-sm text-slate-900">
        <option value="">Choose a career path…</option>
        {PATHS.map(p => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
      {pathId && <p className="text-sm text-slate-800">{familyScene(f.id, pathId)}</p>}
      {pathId && !allowed.ok && <p className="text-xs font-semibold text-red-800">{allowed.reason}</p>}
      {pathId && allowed.ok && (
        <div className="space-y-1.5">
          {choices.map(choice => {
            const blocked = f.id === 'resume_workshop' && choice.id === 'experience' && !hasExperience;
            return (
              <button
                key={choice.id}
                type="button"
                disabled={blocked}
                onClick={() =>
                  act('career_complete', { pathId, choiceId: choice.id }, null, r => {
                    if (r.accepted) return `Internship accepted. Follow up on your next turn for ${INTERNSHIP.completion_reward.rep} REP and ${INTERNSHIP.completion_reward.career} Career.`;
                    const pts = r.rewarded ? `+${r.rep} REP, +${r.career} Career` : 'no points (already rewarded this lap)';
                    return `${f.name} completed: ${pts}${r.referral ? ' · sports service referral added' : ''}`;
                  })
                }
                className="w-full text-left rounded-xl bg-white/60 border border-white/70 px-3 py-2 text-sm font-semibold text-slate-900 disabled:opacity-50"
              >
                {choice.label}
                {blocked && <span className="block text-xs font-normal text-slate-700">No experience cards yet</span>}
              </button>
            );
          })}
        </div>
      )}
      <button type="button" className={secondary} onClick={() => act('career_decline', {}, 'Opportunity declined (no penalty)')}>
        Decline
      </button>
    </div>
  );
}

function Internship({ ledger, act }) {
  const i = ledger.career.internship;
  const p = path(i.path);
  const due = ledger.turn >= i.dueTurn;
  const repair = i.state === 'repair';
  const done = r => (r.rewarded ? `Internship completed: +${r.rep} REP, +${r.career} Career` : 'Internship completed (no points: already rewarded this lap)');
  return (
    <div className={card}>
      <p className="text-sm font-bold text-slate-900">Internship: {p.role}</p>
      <p className="text-xs text-slate-700">
        {i.label} · {repair ? 'You missed the follow-up. One repair chance this turn.' : due ? 'Follow-up due this turn.' : 'Follow-up on your next turn.'}
        {i.state === 'extended' && ' (extended once)'}
      </p>
      <div className="flex flex-wrap gap-1.5">
        {repair ? (
          <>
            <button type="button" className={primary} disabled={!due} onClick={() => act('internship_action', { action: 'repair' }, null, done)}>
              Complete the repair task
            </button>
            <button type="button" className={secondary} onClick={() => act('internship_action', { action: 'decline_repair' }, 'Internship closed unfinished (no penalty)')}>
              Close it
            </button>
          </>
        ) : (
          <>
            <button type="button" className={primary} disabled={!due} onClick={() => act('internship_action', { action: 'complete' }, null, done)}>
              Complete
            </button>
            <button type="button" className={secondary} disabled={!due || i.extended} onClick={() => act('internship_action', { action: 'extend' }, 'Supervisor approved one extension')}>
              Ask for more time
            </button>
            <button type="button" className={secondary} onClick={() => act('internship_action', { action: 'withdraw' }, 'Withdrew with notice (no penalty)')}>
              Withdraw with notice
            </button>
          </>
        )}
      </div>
    </div>
  );
}

/** The purple opportunity drawn this turn and any internship in progress. */
export default function CareerPanel({ ledger, act }) {
  const c = ledger.career;
  const offer = c.offer;
  return (
    <div className="space-y-3">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-700/80">💼 Career</h3>
      {offer && offer.status === 'clear' && (
        <div className={card}>
          <p className="text-sm font-bold text-slate-900">Plan review</p>
          <p className="text-xs text-slate-700">No career activity is available right now. No points this turn.</p>
        </div>
      )}
      {offer && offer.status === 'offered' && <Offer key={offer.id} ledger={ledger} act={act} />}
      {c.internship && <Internship ledger={ledger} act={act} />}
      {c.referral && !c.referral.used && (
        <p className="text-xs font-semibold text-slate-900">🎟️ Sports service referral: 5% off a Youth Sports clinic (up to $2,500). No cash value.</p>
      )}
    </div>
  );
}

/** Career record for the Events tab: completed work, competencies and benefits. */
export function CareerRecord({ ledger }) {
  const c = ledger.career;
  const done = c.history.filter(h => h.status === 'completed');
  if (!c.history.length) return <p className="text-sm text-slate-800">Land on a purple space to start building your career record.</p>;
  return (
    <div className="space-y-2 text-sm text-slate-900">
      <p className="text-xs text-slate-700">
        {done.length} completed · {c.competencies.length} skills · {c.contacts.length} contacts{c.graduated ? ' · graduated' : ''}
      </p>
      <ul className="space-y-1">
        {[...c.history].reverse().slice(0, 12).map((h, i) => (
          <li key={i} className="text-xs">
            <span className="font-semibold">{family(h.family)?.name || 'Career'}</span>
            {h.path ? ` · ${path(h.path)?.name}` : ''} · {h.status.replace('_', ' ')}
            {h.rep || h.career ? ` (+${h.rep} REP, +${h.career} Career)` : ''}
          </li>
        ))}
      </ul>
    </div>
  );
}
