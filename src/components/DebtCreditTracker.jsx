import React from 'react';

function DebtCreditTracker({
  debt,
  credit,
  cash,
  setCash,
  setDebt,
  setCredit
}) {
  const getInterestRate = (score) => {
    if (score >= 750) return 0.05;
    if (score >= 700) return 0.10;
    if (score >= 650) return 0.15;
    if (score >= 600) return 0.20;
    return 0.25;
  };

  const interestRate = getInterestRate(credit);

  return (
    <section className="bg-white rounded-xl shadow-md p-4">
      <h3 className="text-lg font-semibold text-black mb-2 flex items-center gap-2">
        💳 Debt & Credit
      </h3>

      {/* Loan Form */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const amount = parseInt(e.target.loan.value, 10);
          if (isNaN(amount)) return;
          const interest = Math.floor(amount * interestRate);
          setDebt(debt + amount + interest);
          setCash(cash + amount);
          setCredit(credit - 20);
          e.target.reset();
        }}
        className="space-y-3"
      >
        <input
          name="loan"
          type="number"
          placeholder="Loan Amount"
          className="w-full px-4 py-2 border rounded-md shadow-sm focus:ring-2 focus:ring-black outline-none"
        />
        <button
          type="submit"
          className="w-full bg-black text-white font-semibold py-2 rounded hover:bg-gray-800 transition"
        >
          Take Loan
        </button>
      </form>

      {/* Info Display */}
      <div className="mt-4 text-sm text-gray-700 space-y-1">
        <p><strong>Total Debt:</strong> <span className="text-red-600 font-semibold">${debt.toLocaleString()}</span></p>
        <p><strong>Credit Score:</strong> <span className={
          `font-semibold ${credit >= 700 ? 'text-green-600' : credit >= 600 ? 'text-yellow-600' : 'text-red-600'}`
        }>{credit}</span></p>
        <p><strong>Interest Rate:</strong> {interestRate * 100}%</p>
      </div>

      {/* Payment Form */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const payment = parseInt(e.target.payment.value, 10);
          if (isNaN(payment) || payment <= 0) return;
          if (cash >= payment && debt > 0) {
            const actualPayment = Math.min(payment, debt);
            setCash(cash - actualPayment);
            setDebt(debt - actualPayment);

            if (actualPayment === debt) {
              setCredit(credit + 50);
            } else {
              const paymentPercent = actualPayment / debt;
              const bump = Math.ceil(paymentPercent * 20);
              setCredit(credit + bump);
            }
            e.target.reset();
          } else {
            alert("Not enough cash or no debt to pay.");
          }
        }}
        className="space-y-3 mt-4"
      >
        <input
          name="payment"
          type="number"
          placeholder="Amount to Pay"
          className="w-full px-4 py-2 border rounded-md shadow-sm focus:ring-2 focus:ring-black outline-none"
        />
        <button
          type="submit"
          className="w-full bg-black text-white font-semibold py-2 rounded hover:bg-gray-800 transition"
        >
          Pay Debt (Partial or Full)
        </button>
      </form>
    </section>
  );
}

export default DebtCreditTracker;
