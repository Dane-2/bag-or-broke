import React, { useState, useEffect, useRef } from 'react';
import '../styles/cashAnimations.css';

/** Shared prompts so dashboard hero and tracker stay in sync without duplicating logic */
export function promptAddCashAmount(setCash) {
  const input = prompt('Enter amount to add:');
  if (!input) return;
  const amount = parseInt(input.replace(/,/g, ''), 10);
  if (!isNaN(amount)) setCash((prev) => prev + amount);
}

export function promptSubtractCashAmount(setCash) {
  const input = prompt('Enter amount to subtract:');
  if (!input) return;
  const amount = parseInt(input.replace(/,/g, ''), 10);
  if (!isNaN(amount)) setCash((prev) => prev - amount);
}

function CashTracker({ cash, setCash, variant = 'card' }) {
  const [animationClass, setAnimationClass] = useState('');
  const [valueClass, setValueClass] = useState('');
  const prevCashRef = useRef(cash);
  const animationTimeoutRef = useRef(null);

  // Detect cash changes and trigger animations
  useEffect(() => {
    // Skip on initial mount
    if (prevCashRef.current === cash) return;

    const diff = cash - prevCashRef.current;
    
    if (diff > 0) {
      // Cash increased
      setAnimationClass('cash-increase-animation');
      setValueClass('increasing');
      
      // Clear animation class after animation completes
      if (animationTimeoutRef.current) {
        clearTimeout(animationTimeoutRef.current);
      }
      animationTimeoutRef.current = setTimeout(() => {
        setAnimationClass('');
        // Reset color after a short delay
        setTimeout(() => {
          setValueClass('');
        }, 200);
      }, 600);
    } else if (diff < 0) {
      // Cash decreased
      setAnimationClass('cash-decrease-animation');
      setValueClass('decreasing');
      
      // Clear animation class after animation completes
      if (animationTimeoutRef.current) {
        clearTimeout(animationTimeoutRef.current);
      }
      animationTimeoutRef.current = setTimeout(() => {
        setAnimationClass('');
        // Reset color after a short delay
        setTimeout(() => {
          setValueClass('');
        }, 200);
      }, 500);
    }

    // Update previous cash value
    prevCashRef.current = cash;

    // Cleanup timeout on unmount
    return () => {
      if (animationTimeoutRef.current) {
        clearTimeout(animationTimeoutRef.current);
      }
    };
  }, [cash]);

  const handleAddCash = () => promptAddCashAmount(setCash);
  const handleSubtractCash = () => promptSubtractCashAmount(setCash);

  const amountEl = (
    <p
      className={`cash-value font-black tracking-tight text-slate-900 ${animationClass} ${valueClass} ${
        variant === 'amountOnly' ? 'text-4xl sm:text-5xl mb-0' : 'text-xl font-bold mb-4'
      }`}
    >
      ${cash.toLocaleString()}
    </p>
  );

  if (variant === 'amountOnly') {
    return amountEl;
  }

  return (
    <section className="rounded-2xl bg-white/20 backdrop-blur-lg border border-white/30 shadow-lg p-4 md:p-6">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-700/80 mb-2 flex items-center gap-2">
        💵 Cash Tracker
      </h3>
      {amountEl}

      <div className="flex gap-3">
        <button
          type="button"
          className="flex-1 rounded-full bg-gradient-to-r from-emerald-500 to-green-500 text-white font-semibold py-2.5 shadow-lg shadow-emerald-500/25 hover:from-emerald-600 hover:to-green-600 transition"
          onClick={handleAddCash}
        >
          + Add Cash
        </button>
        <button
          type="button"
          className="flex-1 rounded-full bg-white/30 backdrop-blur-md border border-white/40 text-red-800 font-semibold py-2.5 shadow-lg hover:bg-white/40 transition"
          onClick={handleSubtractCash}
        >
          − Spend Cash
        </button>
      </div>
    </section>
  );
}

export default CashTracker;
