import React from 'react';
import { formatCents } from '../rules/money';
import { assetValue, policyLoanQuote, isActive } from '../rules/holdings';

function FinalNetWorth({ cash, luxuries, rep, career, credit, debt, curveballs, showFinal, ledger, score, finalWindow = false, lossAvoided = 0, isGeneratingSummary }) {
  const active = ledger.assets.filter(isActive);
  const policies = active.filter(a => a.holding === 'life');
  const annuities = ledger.assets.filter(a => a.holding === 'annuity');
  const plans = active.filter(a => a.holding === 'plan');
  const netProtection = policies.reduce((t, a) => t + policyLoanQuote(ledger, a).netProtection, 0);
  const annuityCash = annuities.reduce((t, a) => t + (a.cashReceived || 0), 0);
  const annuityRemaining = annuities.filter(isActive).reduce((t, a) => t + assetValue(ledger, a), 0);
  const legalUses = plans.filter(a => a.plan === 'legal').reduce((t, a) => t + a.uses, 0);
  const healthUses = plans.filter(a => a.plan === 'health').reduce((t, a) => t + a.uses, 0);

  const curveballLoss = curveballs.reduce((acc, c) => acc + (c.amount || 0), 0);
  const totalLuxuries = luxuries.length;

  let assignedProfile = 'The CEO in Training';
  if (rep >= 10 && totalLuxuries <= 2 && debt <= 20000) {
    assignedProfile = 'The Architect';
  } else if (cash < 10000 && debt > 50000) {
    assignedProfile = 'The Flameout';
  } else if (career >= 8 && debt === 0) {
    assignedProfile = 'The Legacy Maker';
  } else if (debt >= 60000 && cash > 25000) {
    assignedProfile = 'The Hustler';
  } else if (totalLuxuries >= 6 && rep <= 2) {
    assignedProfile = 'The Flexer';
  } else if (curveballLoss >= 50000 && rep >= 5 && cash < 20000) {
    assignedProfile = 'The Survivor';
  } else if (cash > 100000 && totalLuxuries >= 4 && curveballLoss < 20000) {
    assignedProfile = 'The Hot Shot';
  }

  return (
    <section className="bg-white rounded-xl shadow-md p-4">
      <h3 className="text-lg font-semibold text-indigo-700 mb-2 flex items-center gap-2">
        📊 Final Game Value
      </h3>
      <div className="space-y-1 text-sm text-gray-800">
        {/* Central finance portfolio: financial wealth, then noncash points, shown separately */}
        <ul className="space-y-1">
          <li>💵 <strong>Available Cash:</strong> {formatCents(score.cash)}</li>
          <li>🧾 <strong>Tax Bucket:</strong> {formatCents(score.taxBucket)}</li>
          <li>📈 <strong>Investments &amp; contracts:</strong> {formatCents(score.assetsValue)}</li>
          <li>💎 <strong>Luxury resale:</strong> {formatCents(score.luxuryResale)}</li>
          <li>💳 <strong>Borrowing:</strong> -{formatCents(score.ordinaryDebt)}</li>
          {score.policyDebt > 0 && <li>🛡️ <strong>Policy loans:</strong> -{formatCents(score.policyDebt)}</li>}
          {score.taxesOwed > 0 && <li>🏛️ <strong>Taxes owed:</strong> -{formatCents(score.taxesOwed)}</li>}
          {score.otherLiabilities > 0 && <li>⚫ <strong>Shady Debt:</strong> -{formatCents(score.otherLiabilities)}</li>}
          <li className="pt-1 font-semibold">= Financial wealth: {formatCents(score.financialWealth)}</li>
          <li>🌟 <strong>REP ({rep} × $2,500):</strong> {formatCents(score.repValue)}</li>
          <li>📚 <strong>Career ({career} × $5,000):</strong> {formatCents(score.careerValue)}</li>
          <li>🧠 <strong>Credit bonus (score {credit}):</strong> {formatCents(score.creditBonus)}</li>
        </ul>

        {lossAvoided > 0 && (
          <div className="mt-3 p-2 bg-green-50 rounded border border-green-200">
            <p className="text-sm font-semibold text-green-700">
              🛡️ Paid by Legal or Health Support: ${lossAvoided.toLocaleString()}
            </p>
          </div>
        )}

        {(policies.length > 0 || annuities.length > 0 || plans.length > 0) && (
          <div className="mt-3 p-3 bg-indigo-50 rounded border border-indigo-200">
            <p className="text-sm font-semibold text-indigo-700 mb-2">🛡️ Protection &amp; contracts (not counted again in wealth)</p>
            <ul className="text-xs text-gray-700 space-y-1">
              {policies.length > 0 && <li><strong>Life insurance net protection:</strong> {formatCents(netProtection)}</li>}
              {annuities.length > 0 && (
                <li>
                  <strong>Annuities:</strong> {formatCents(annuityCash)} received, {formatCents(annuityRemaining)} still in contracts
                </li>
              )}
              {plans.length > 0 && <li><strong>Support uses left:</strong> {legalUses} legal, {healthUses} health (no cash value)</li>}
            </ul>
          </div>
        )}

        <h4 className="text-xl font-bold mt-3">Final game value: {formatCents(score.gameValue)}</h4>
        <p className="text-xs text-gray-500">The credit bonus and point values count only in this final score; they are not spendable cash.</p>
        <p className="text-sm text-gray-600 mt-1">Profile: {assignedProfile}</p>
        <button
          onClick={() => {
            // Call handleEndGame (passed as showFinal prop) which will generate AI summary
            if (showFinal && typeof showFinal === 'function') {
              showFinal();
            }
          }}
          className="w-full bg-indigo-600 text-white font-semibold py-2 mt-4 rounded hover:bg-indigo-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={!showFinal || isGeneratingSummary}
        >
          {isGeneratingSummary ? 'Generating Summary...' : finalWindow ? 'Finish & Reveal' : 'Finish Early & Reveal'}
        </button>
      </div>
    </section>
  );
}

export default FinalNetWorth;
