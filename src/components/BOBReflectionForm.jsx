import React, { useState } from 'react';
import { jsPDF } from 'jspdf';

/**
 * B.O.B. Decision Blueprint™ - Reflection. Ownership. Action.
 * Questions from THE B.O.B. DECISION BLUEPRINT PDF
 */
const SYSTEM_OPTIONS = [
  'Savings account',
  'Budget tracking',
  'Financial education',
  'Mentor or advisor',
  'Accountability partner',
];

function BOBReflectionForm({ gameData }) {
  const [answers, setAnswers] = useState({
    q1: '', q1Explain: '', q2: '', q3: '', q3Explain: '',
    q4: '', q5: '', q6: '', q7Before: '', q7After: '', q8: '',
    q9: 5, q9Why: '', q10: '', q11: [], q11Other: '', q11Explain: '',
    q12: '', q13: '',
    profileReflected: '', habitRefuse: '', identityBuild: '',
    signature: '', date: new Date().toISOString().slice(0, 10),
  });

  const update = (key, value) => setAnswers(prev => ({ ...prev, [key]: value }));

  const toggleQ11 = (opt) => {
    const arr = Array.isArray(answers.q11) ? answers.q11 : [];
    const next = arr.includes(opt) ? arr.filter(x => x !== opt) : [...arr, opt];
    update('q11', next);
  };

  const generatePDF = () => {
    const doc = new jsPDF({ font: 'helvetica', unit: 'pt' });
    let y = 40;
    const margin = 40;
    const pageW = doc.internal.pageSize.getWidth();
    const lineH = 14;

    const addText = (text, opts = {}) => {
      const { size = 10, bold = false } = opts;
      doc.setFontSize(size);
      doc.setFont('helvetica', bold ? 'bold' : 'normal');
      const lines = doc.splitTextToSize(text || '—', pageW - margin * 2);
      lines.forEach(line => {
        if (y > 750) { doc.addPage(); y = 40; }
        doc.text(line, margin, y);
        y += lineH;
      });
    };

    // Title
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('THE B.O.B. DECISION BLUEPRINT™', pageW / 2, y, { align: 'center' });
    y += 20;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text('Reflection. Ownership. Action.', pageW / 2, y, { align: 'center' });
    y += 30;

    // Game Stats
    addText('GAME STATISTICS', { size: 12, bold: true });
    y += 5;
    const stats = gameData ? [
      `Player: ${gameData.playerName || '—'}`,
      `Archetype: ${gameData.archetype || '—'}`,
      `Net Worth: $${(gameData.netWorth ?? 0).toLocaleString()}`,
      `Cash: $${(gameData.cash ?? 0).toLocaleString()} | Debt: $${(gameData.debt ?? 0).toLocaleString()}`,
      `REP: ${gameData.rep ?? 0} | Career: ${gameData.career ?? 0} | Credit: ${gameData.credit ?? 0}`,
      `Investments: ${(gameData.investments || []).length} | Luxuries: ${(gameData.luxuries || []).length}`,
    ] : [];
    stats.forEach(s => addText(s));
    y += 20;

    // Section 1
    addText('SECTION 1: THE REVEAL — Leadership Awareness', { size: 12, bold: true });
    y += 10;
    addText('1. Strategy clarity: ' + (answers.q1 || '—'));
    addText('   Explain: ' + (answers.q1Explain || '—'));
    addText('2. One-sentence strategy: ' + (answers.q2 || '—'));
    addText('3. Keep strategy in real life? ' + (answers.q3 || '—'));
    addText('   Explain: ' + (answers.q3Explain || '—'));
    addText('4. Greatest long-term impact decision: ' + (answers.q4 || '—'));
    addText('5. What within control failed to manage: ' + (answers.q5 || '—'));
    addText('6. Real-life habit that showed up: ' + (answers.q6 || '—'));
    addText('7. Before: ' + (answers.q7Before || '—'));
    addText('   After: ' + (answers.q7After || '—'));
    addText('8. Prepared or exposed: ' + (answers.q8 || '—'));
    addText('9. Preparation (1-10): ' + (answers.q9 || '—') + ' — ' + (answers.q9Why || '—'));
    y += 15;

    // Section 2
    addText('SECTION 2: THE SHIFT — Strategic Blueprint', { size: 12, bold: true });
    y += 10;
    addText('10. Decision habit to improve: ' + (answers.q10 || '—'));
    addText('11. Systems: ' + ((answers.q11 || []).join(', ') || '—') + (answers.q11Other ? ` | Other: ${answers.q11Other}` : ''));
    addText('    Plan: ' + (answers.q11Explain || '—'));
    addText('12. Lifestyle expense to delay: ' + (answers.q12 || '—'));
    addText('13. Who influences financial decisions: ' + (answers.q13 || '—'));
    y += 15;

    // Section 3
    addText('SECTION 3: THE IDENTITY DECISION', { size: 12, bold: true });
    y += 10;
    addText('Player Profile reflected most: ' + (answers.profileReflected || '—'));
    addText('Mindset/habit to refuse: ' + (answers.habitRefuse || '—'));
    addText('Identity to build: ' + (answers.identityBuild || '—'));
    addText('Signature: ' + (answers.signature || '—'));
    addText('Date: ' + (answers.date || '—'));
    y += 15;

    addText('THE COMMITMENT', { size: 11, bold: true });
    y += 5;
    const commitment = "I understand that financial literacy is not just information. It is a mentality. It is the way I think before I spend. The way I prepare before opportunity arrives. The way I respond under pressure. I understand that opportunity does not create character. It reveals it. I choose to think long-term before acting short-term. I choose preparation over impulse. I choose systems over excuses. I choose discipline over hype. I choose to build before I flex.";
    addText(commitment);

    doc.save(`B.O.B.-Decision-Blueprint-${(gameData?.playerName || 'Player').replace(/\s+/g, '-')}.pdf`);
  };

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-bold text-indigo-800 border-b-2 border-indigo-200 pb-2">
        THE B.O.B. DECISION BLUEPRINT™
      </h3>
      <p className="text-sm text-gray-600">Reflection. Ownership. Action.</p>

      {/* SECTION 1 */}
      <div className="space-y-4">
        <h4 className="font-semibold text-indigo-700">SECTION 1: THE REVEAL — Leadership Awareness</h4>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">1. Did you come into this game with a clear strategy, or were you mostly reacting?</label>
          <select value={answers.q1} onChange={e => update('q1', e.target.value)} className="w-full border rounded px-2 py-1 text-sm">
            <option value="">— Select —</option>
            <option value="I had a clear strategy">I had a clear strategy</option>
            <option value="I had a loose idea">I had a loose idea</option>
            <option value="I was mostly reacting">I was mostly reacting</option>
            <option value="I was completely reacting">I was completely reacting</option>
          </select>
          <input type="text" placeholder="Explain your answer" value={answers.q1Explain} onChange={e => update('q1Explain', e.target.value)} className="mt-1 w-full border rounded px-2 py-1 text-sm" />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">2. If you had to describe your strategy in one sentence, what was it?</label>
          <input type="text" value={answers.q2} onChange={e => update('q2', e.target.value)} className="w-full border rounded px-2 py-1 text-sm" placeholder="One sentence strategy" />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">3. Would you keep that same strategy in real life?</label>
          <select value={answers.q3} onChange={e => update('q3', e.target.value)} className="w-full border rounded px-2 py-1 text-sm">
            <option value="">— Select —</option>
            <option value="Yes">Yes</option>
            <option value="No">No</option>
            <option value="I would adjust it">I would adjust it</option>
          </select>
          <input type="text" placeholder="Explain" value={answers.q3Explain} onChange={e => update('q3Explain', e.target.value)} className="mt-1 w-full border rounded px-2 py-1 text-sm" />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">4. What decision had the greatest long-term impact, and what motivated you?</label>
          <textarea value={answers.q4} onChange={e => update('q4', e.target.value)} rows={2} className="w-full border rounded px-2 py-1 text-sm" />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">5. What was within your control that you failed to manage effectively?</label>
          <textarea value={answers.q5} onChange={e => update('q5', e.target.value)} rows={2} className="w-full border rounded px-2 py-1 text-sm" />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">6. What real-life habit showed up in how you played?</label>
          <textarea value={answers.q6} onChange={e => update('q6', e.target.value)} rows={2} className="w-full border rounded px-2 py-1 text-sm" />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">7. Before vs. After — How did you think about money and opportunity?</label>
          <input type="text" placeholder="Before" value={answers.q7Before} onChange={e => update('q7Before', e.target.value)} className="w-full border rounded px-2 py-1 text-sm mb-1" />
          <input type="text" placeholder="After" value={answers.q7After} onChange={e => update('q7After', e.target.value)} className="w-full border rounded px-2 py-1 text-sm" />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">8. If opportunity arrived tomorrow, would you be prepared or exposed? Explain.</label>
          <textarea value={answers.q8} onChange={e => update('q8', e.target.value)} rows={2} className="w-full border rounded px-2 py-1 text-sm" />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">9. On a scale of 1–10, how prepared are you to handle real financial opportunity?</label>
          <div className="flex gap-1 mb-1">
            {[1,2,3,4,5,6,7,8,9,10].map(n => (
              <button key={n} type="button" onClick={() => update('q9', n)} className={`w-8 h-8 rounded text-sm font-medium ${answers.q9 === n ? 'bg-indigo-600 text-white' : 'bg-gray-200'}`}>{n}</button>
            ))}
          </div>
          <input type="text" placeholder="Why that number?" value={answers.q9Why} onChange={e => update('q9Why', e.target.value)} className="w-full border rounded px-2 py-1 text-sm" />
        </div>
      </div>

      {/* SECTION 2 */}
      <div className="space-y-4">
        <h4 className="font-semibold text-indigo-700">SECTION 2: THE SHIFT — Strategic Blueprint</h4>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">10. One decision-making habit you will improve immediately?</label>
          <textarea value={answers.q10} onChange={e => update('q10', e.target.value)} rows={2} className="w-full border rounded px-2 py-1 text-sm" />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">11. System to protect your financial future:</label>
          <div className="space-y-1 mb-2">
            {SYSTEM_OPTIONS.map(opt => (
              <label key={opt} className="flex items-center gap-2">
                <input type="checkbox" checked={(answers.q11 || []).includes(opt)} onChange={() => toggleQ11(opt)} />
                <span className="text-sm">{opt}</span>
              </label>
            ))}
            <input type="text" placeholder="Other" value={answers.q11Other} onChange={e => update('q11Other', e.target.value)} className="w-full border rounded px-2 py-1 text-sm mt-1" />
          </div>
          <input type="text" placeholder="Explain your plan" value={answers.q11Explain} onChange={e => update('q11Explain', e.target.value)} className="w-full border rounded px-2 py-1 text-sm" />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">12. One lifestyle expense or impulse you will delay to build long-term stability?</label>
          <input type="text" value={answers.q12} onChange={e => update('q12', e.target.value)} className="w-full border rounded px-2 py-1 text-sm" />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">13. Who influences your financial decisions, and are they helping you think long-term?</label>
          <textarea value={answers.q13} onChange={e => update('q13', e.target.value)} rows={2} className="w-full border rounded px-2 py-1 text-sm" />
        </div>
      </div>

      {/* SECTION 3 */}
      <div className="space-y-4">
        <h4 className="font-semibold text-indigo-700">SECTION 3: THE IDENTITY DECISION — Personal Contract</h4>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">The Player Profile I reflected most today:</label>
          <input type="text" value={answers.profileReflected} onChange={e => update('profileReflected', e.target.value)} placeholder={gameData?.archetype} className="w-full border rounded px-2 py-1 text-sm" />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">The mindset or habit I refuse to carry into my real life:</label>
          <textarea value={answers.habitRefuse} onChange={e => update('habitRefuse', e.target.value)} rows={2} className="w-full border rounded px-2 py-1 text-sm" />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">The identity I choose to build starting today:</label>
          <textarea value={answers.identityBuild} onChange={e => update('identityBuild', e.target.value)} rows={2} className="w-full border rounded px-2 py-1 text-sm" />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Signature</label>
            <input type="text" value={answers.signature} onChange={e => update('signature', e.target.value)} className="w-full border rounded px-2 py-1 text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
            <input type="date" value={answers.date} onChange={e => update('date', e.target.value)} className="w-full border rounded px-2 py-1 text-sm" />
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={generatePDF}
        className="w-full bg-indigo-600 text-white font-semibold py-3 rounded-lg hover:bg-indigo-700 transition"
      >
        Download B.O.B. Blueprint PDF
      </button>
    </div>
  );
}

export default BOBReflectionForm;
