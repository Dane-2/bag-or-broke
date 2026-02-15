import React, { useState } from 'react';

function LifeInsuranceManager({ investments, setInvestments, setCash, addToast }) {
  const [selectedPolicyIndex, setSelectedPolicyIndex] = useState('');
  const [borrowAmount, setBorrowAmount] = useState('');

  const lifeInsurancePolicies = investments.filter(inv => inv.investmentType === 'lifeInsurance');

  const selectedPolicy = selectedPolicyIndex !== ''
    ? lifeInsurancePolicies[parseInt(selectedPolicyIndex, 10)]
    : null;

  const availableToBorrow = selectedPolicy
    ? (selectedPolicy.currentCashValue || selectedPolicy.maxCashValue || 0) - (selectedPolicy.outstandingLoans || 0)
    : 0;

  const handleBorrow = (e) => {
    e.preventDefault();
    const amount = parseInt(borrowAmount, 10);

    if (isNaN(amount) || amount <= 0) {
      addToast('Please enter a valid amount.', 'error');
      return;
    }
    if (!selectedPolicy) {
      addToast('Please select a policy.', 'error');
      return;
    }
    if (amount > availableToBorrow) {
      addToast(`You can only borrow up to $${availableToBorrow.toLocaleString()} from this policy.`, 'error');
      return;
    }

    // Update investment with new loan
    setInvestments(prev => prev.map((inv, idx) => {
      if (inv.investmentType === 'lifeInsurance' && 
          inv.cardId === selectedPolicy.cardId &&
          investments.indexOf(inv) === parseInt(selectedPolicyIndex, 10)) {
        return {
          ...inv,
          outstandingLoans: (inv.outstandingLoans || 0) + amount
        };
      }
      return inv;
    }));

    // Add cash
    setCash(prev => prev + amount);

    addToast(`Borrowed $${amount.toLocaleString()} from ${selectedPolicy.cardTitle}. Outstanding loans: $${((selectedPolicy.outstandingLoans || 0) + amount).toLocaleString()}`, 'success');
    
    // Reset form
    setSelectedPolicyIndex('');
    setBorrowAmount('');
  };

  if (lifeInsurancePolicies.length === 0) {
    return null;
  }

  return (
    <section className="bg-white rounded-xl shadow-md p-4">
      <h3 className="text-lg font-semibold text-blue-700 mb-2 flex items-center gap-2">
        🛡️ Life Insurance Manager
      </h3>

      <form onSubmit={handleBorrow} className="space-y-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Select Policy:</label>
          <select
            value={selectedPolicyIndex}
            onChange={(e) => {
              setSelectedPolicyIndex(e.target.value);
              setBorrowAmount('');
            }}
            className="w-full px-4 py-2 border rounded-md shadow-sm focus:ring-2 focus:ring-blue-500"
          >
            <option value="">-- Select a policy --</option>
            {lifeInsurancePolicies.map((policy, idx) => {
              const faceAmount = policy.currentFaceAmount || policy.faceAmount || 0;
              const cashValue = policy.currentCashValue || policy.maxCashValue || 0;
              const loans = policy.outstandingLoans || 0;
              const available = cashValue - loans;
              
              return (
                <option key={idx} value={idx}>
                  {policy.cardTitle} - Face: ${faceAmount.toLocaleString()}, Available: ${available.toLocaleString()}
                </option>
              );
            })}
          </select>
        </div>

        {selectedPolicy && (
          <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
            <p className="text-sm text-gray-700 mb-1">
              <strong>Face Amount:</strong> ${(selectedPolicy.currentFaceAmount || selectedPolicy.faceAmount || 0).toLocaleString()}
            </p>
            <p className="text-sm text-gray-700 mb-1">
              <strong>Max Cash Value:</strong> ${(selectedPolicy.currentCashValue || selectedPolicy.maxCashValue || 0).toLocaleString()}
            </p>
            <p className="text-sm text-gray-700 mb-1">
              <strong>Outstanding Loans:</strong> ${(selectedPolicy.outstandingLoans || 0).toLocaleString()}
            </p>
            <p className="text-sm font-semibold text-blue-700">
              <strong>Available to Borrow:</strong> ${availableToBorrow.toLocaleString()}
            </p>
          </div>
        )}

        {selectedPolicy && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Borrow Amount:</label>
            <input
              type="number"
              value={borrowAmount}
              onChange={(e) => setBorrowAmount(e.target.value)}
              placeholder="Amount to borrow"
              className="w-full px-4 py-2 border rounded-md shadow-sm focus:ring-2 focus:ring-blue-500"
              max={availableToBorrow}
              min="1"
            />
          </div>
        )}

        {selectedPolicy && (
          <button
            type="submit"
            className="w-full bg-blue-600 text-white font-semibold py-2 rounded hover:bg-blue-700 transition"
            disabled={!borrowAmount || parseInt(borrowAmount, 10) <= 0 || parseInt(borrowAmount, 10) > availableToBorrow}
          >
            Borrow Against Policy
          </button>
        )}
      </form>
    </section>
  );
}

export default LifeInsuranceManager;
