import React, { useState, useEffect, useRef } from 'react';
import '../styles/cashAnimations.css';

function CashTracker({ cash, setCash }) {
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

  const handleAddCash = () => {
    const input = prompt('Enter amount to add:');
    if (!input) return;
    const amount = parseInt(input.replace(/,/g, ''), 10);
    if (!isNaN(amount)) setCash(prev => prev + amount);
  };

  const handleSubtractCash = () => {
    const input = prompt('Enter amount to subtract:');
    if (!input) return;
    const amount = parseInt(input.replace(/,/g, ''), 10);
    if (!isNaN(amount)) setCash(prev => prev - amount);
  };

  return (
    <section className="bg-white rounded-xl shadow-md p-4">
      <h3 className="text-lg font-semibold text-green-700 mb-2 flex items-center gap-2">💵 Cash Tracker</h3>
      <p className={`text-xl font-bold mb-4 cash-value ${animationClass} ${valueClass}`}>
        ${cash.toLocaleString()}
      </p>
      
      <div className="flex gap-2">
        <button
          className="w-1/2 bg-green-600 text-white font-semibold py-2 rounded hover:bg-green-700"
          onClick={handleAddCash}
        >
          + Add Cash
        </button>
        <button
          className="w-1/2 bg-red-600 text-white font-semibold py-2 rounded hover:bg-red-700"
          onClick={handleSubtractCash}
        >
          - Subtract Cash
        </button>
      </div>
    </section>
  );
}

export default CashTracker;
