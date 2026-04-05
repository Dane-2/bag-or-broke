import { useState, useEffect, useRef } from 'react';
import CardPreview from './CardPreview';

import investmentCards from '../data/investments';
import luxuryCards from '../data/luxuryCards';

const tabs = {
  investment: [
    'All', 'Life Insurance', 'Annuities', 'Defensive Planning', 'Offensive Planning', 'Real Estate', 'E-Commerce', 'Crypto/Web3', 'Fitness/Health',
    'Content/Media', 'NIL Education', 'Food & Hospitality', 'Fashion',
    'Marketing/Ads', 'Developer Tools', 'Music/Creative', 'Support Services',
    'Branding/Growth', 'NIL Community'
  ],
  luxury: [
    'All', 'Style', 'Vehicle', 'Event', 'Travel', 'Lifestyle',
    'Career/Brand', 'Business/Flex', 'Social Flex', 'Brand/Flex',
    'Flex/Travel', 'Content', 'Style/Flex', 'Brand/Image', 'Flex/Marketing',
    'Style/Brand', 'Brand Image', 'Flex Marketing', 'Access Luxury',
    'Ownership Flex', 'Security & Privacy', 'Performance Luxury',
    'Time Luxury', 'Family / Loyalty Flex'
  ]
};

const glassPanel =
  'rounded-2xl bg-white/20 backdrop-blur-lg border border-white/30 shadow-lg';
const selectClass =
  'w-full px-4 py-3 rounded-2xl border border-white/40 bg-white/30 backdrop-blur-md text-slate-900 text-base font-medium focus:outline-none focus:ring-2 focus:ring-cyan-400/80';

export default function CardSelector({ onSelect, investments = [], forcedCardType = null }) {
  const [cardType, setCardType] = useState(forcedCardType || '');
  const [activeTab, setActiveTab] = useState('All');
  const [selectedCard, setSelectedCard] = useState(null);

  useEffect(() => {
    if (forcedCardType) {
      setCardType(forcedCardType);
      setActiveTab('All');
      setSelectedCard(null);
    }
  }, [forcedCardType]);

  // shared purchase state
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [diceRoll, setDiceRoll] = useState('');

  const cards = cardType === 'investment' ? investmentCards : luxuryCards;
  const filtered = cards.filter((card) =>
    activeTab === 'All' ? true : String(card.category || '').includes(activeTab)
  );

  // Check if player meets card requirements
  const checkRequirements = (card) => {
    if (!card.requirements) return { valid: true, message: '' };
    
    const requirements = card.requirements;
    
    // Check for rental property requirement
    if (requirements.hasRentalProperty) {
      const hasRental = investments.some(inv => 
        inv.cardTitle && (
          inv.cardTitle.includes('Rent') || 
          inv.cardTitle.includes('Property') ||
          inv.cardTitle.includes('Duplex') ||
          inv.cardTitle.includes('Triplex') ||
          inv.cardTitle.includes('Fourplex')
        )
      );
      if (!hasRental) {
        return { 
          valid: false, 
          message: 'Requires: You must own at least one rental property' 
        };
      }
    }
    
    // Check for multi-unit requirement
    if (requirements.hasMultiUnit) {
      const hasMultiUnit = investments.some(inv => 
        inv.cardTitle && (
          inv.cardTitle.includes('Duplex') ||
          inv.cardTitle.includes('Triplex') ||
          inv.cardTitle.includes('Fourplex')
        )
      );
      if (!hasMultiUnit) {
        return { 
          valid: false, 
          message: 'Requires: You must own at least one Multi-Unit property' 
        };
      }
    }
    
    return { valid: true, message: '' };
  };

  // Ref for the payment/dice section to scroll to
  const paymentSectionRef = useRef(null);

  const handleCardClick = (card) => {
    setSelectedCard(card);
    setPaymentMethod('cash');
    setDiceRoll('');
  };

  // Auto-scroll to payment section when a card is selected
  useEffect(() => {
    if (selectedCard && paymentSectionRef.current) {
      // Small delay to ensure the section is rendered
      setTimeout(() => {
        paymentSectionRef.current?.scrollIntoView({ 
          behavior: 'smooth', 
          block: 'start' 
        });
      }, 100);
    }
  }, [selectedCard]);

  const cancelApply = () => {
    setSelectedCard(null);
    setPaymentMethod('cash');
    setDiceRoll('');
  };

  const applyInvestment = () => {
    if (!selectedCard) return;

    // Check requirements
    const reqCheck = checkRequirements(selectedCard);
    if (!reqCheck.valid) {
      alert(reqCheck.message);
      return;
    }

    const cost = Number(selectedCard.cost) || 0;
    const isCashOnly = selectedCard.cashOnly === true;
    const noDice = selectedCard.noDice === true;

    // Cash-only cards (Life Insurance, Annuities) - no financing, no dice
    if (isCashOnly || noDice) {
      if (paymentMethod === 'finance') {
        alert('This investment can only be purchased with cash. No financing allowed.');
        return;
      }

      // Handle Life Insurance
      if (selectedCard.type === 'Life Insurance') {
        onSelect?.({
          type: 'investment',
          cardTitle: selectedCard.title,
          cardId: selectedCard.id,
          cost,
          result: 0,
          newValue: cost, // Initial value equals cost
          percent: 0,
          borrowed: false,
          interest: 0,
          investmentType: 'lifeInsurance',
          faceAmount: selectedCard.startingFaceAmount || 0,
          maxCashValue: selectedCard.startingCashValue || 0,
          currentFaceAmount: selectedCard.startingFaceAmount || 0,
          currentCashValue: selectedCard.startingCashValue || 0,
          outstandingLoans: 0,
          portfolioEffects: selectedCard.portfolioEffects || {},
          protectionFlags: selectedCard.protectionFlags || {},
          protectionInteraction: selectedCard.protectionInteraction || {}
        });
        cancelApply();
        return;
      }

      // Handle Annuities
      if (selectedCard.type === 'Annuity') {
        onSelect?.({
          type: 'investment',
          cardTitle: selectedCard.title,
          cardId: selectedCard.id,
          cost,
          result: 0,
          newValue: cost,
          percent: 0,
          borrowed: false,
          interest: 0,
          investmentType: 'annuity',
          maturityLaps: selectedCard.maturityLaps || 0,
          perLapPayout: selectedCard.perLapPayout || 0,
          purchaseLap: 0, // Will be set when lap is tracked
          isMatured: false,
          totalIncomeEarned: 0,
          portfolioEffects: selectedCard.portfolioEffects || {},
          protectionFlags: selectedCard.protectionFlags || {},
          protectionInteraction: selectedCard.protectionInteraction || {}
        });
        cancelApply();
        return;
      }

      // Handle Defensive Protection cards
      if (selectedCard.type === 'Defensive Protection') {
        // Check if player already owns Umbrella (non-repeatable)
        if (selectedCard.id === 'DEF_UMBRELLA' && investments.some(inv => inv.cardId === 'DEF_UMBRELLA')) {
          alert('You can only own one Umbrella Liability Coverage policy.');
          return;
        }

        onSelect?.({
          type: 'investment',
          cardTitle: selectedCard.title,
          cardId: selectedCard.id,
          cost,
          result: 0,
          newValue: cost, // For net worth calculation
          percent: 0,
          borrowed: false,
          interest: 0,
          investmentType: selectedCard.investmentType,
          protectionType: selectedCard.protectionType,
          usesRemaining: selectedCard.usesRemaining || 0,
          protectsAgainst: selectedCard.protectsAgainst || []
        });
        cancelApply();
        return;
      }
    }

    // Regular investments require dice roll
    if (!diceRoll) {
      alert('Please select a dice roll (1-6)');
      return;
    }

    const risk = selectedCard.availableRisks?.[0];
    const rollIndex = parseInt(diceRoll, 10) - 1;
    const roiTable = selectedCard.roiTables?.[risk] || [];
    const percent = roiTable[rollIndex];

    if (typeof percent !== 'number') return;

    const borrowed = paymentMethod === 'finance';
    const interest = borrowed ? Math.floor(cost * 0.25) : 0;
    const result = Math.floor((percent / 100) * cost);
    const newValue = cost + result;

    // Handle Offensive Planning investments
    const investmentData = {
      type: 'investment',
      cardTitle: selectedCard.title,
      cardId: selectedCard.id,
      cost,
      result,
      newValue,
      percent,
      borrowed,
      interest,
      portfolioEffects: selectedCard.portfolioEffects || {},
      protectionFlags: selectedCard.protectionFlags || {},
      protectionInteraction: selectedCard.protectionInteraction || {}
    };

    // Add offensive planning specific fields
    if (selectedCard.investmentType === 'offensivePlanning') {
      investmentData.investmentType = 'offensivePlanning';
      investmentData.rolledROI = percent; // Store the rolled ROI percentage for compounding
    }

    onSelect?.(investmentData);

    cancelApply();
  };

  const applyLuxury = () => {
    if (!selectedCard) return;

    const cost = Number(selectedCard.cost) || 0;
    const resale = Number(selectedCard.resale) || 0;
    const rep = Number(selectedCard.rep) || 0;

    const borrowed = paymentMethod === 'finance';
    const interest = borrowed ? Math.floor(cost * 0.25) : 0;

    onSelect?.({
      type: 'luxury',
      cardTitle: selectedCard.title,
      cost,
      resale,
      rep,
      borrowed,
      interest,
      category: selectedCard.category
    });

    cancelApply();
  };

  return (
    <div className="space-y-4 md:space-y-6">
      {!forcedCardType && (
        <div className={`${glassPanel} p-4 md:p-6 text-center space-y-3`}>
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-800">🎴 Card type</h3>
          <select
            value={cardType}
            onChange={(e) => {
              setCardType(e.target.value);
              setActiveTab('All');
              setSelectedCard(null);
            }}
            className={`mt-1 ${selectClass}`}
          >
            <option value="">-- Select Card Type --</option>
            <option value="investment">💼 Investment Cards</option>
            <option value="luxury">💎 Luxury Cards</option>
          </select>
        </div>
      )}

      {cardType && (
        <>
          <div className={`${glassPanel} p-4 md:p-5`}>
            <label
              htmlFor={`card-category-${cardType}`}
              className="block text-xs font-semibold uppercase tracking-wide text-slate-800 mb-2"
            >
              Category
            </label>
            <select
              id={`card-category-${cardType}`}
              value={activeTab}
              onChange={(e) => setActiveTab(e.target.value)}
              className={selectClass}
            >
              {tabs[cardType].map((tab) => (
                <option key={tab} value={tab}>
                  {tab}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4">
            {filtered.map((card) => {
              const reqCheck = checkRequirements(card);
              const isDisabled = !reqCheck.valid;
              
              return (
                <CardPreview 
                  key={card.id} 
                  card={card} 
                  onSelect={isDisabled ? () => alert(reqCheck.message) : handleCardClick}
                  isSelected={selectedCard?.id === card.id}
                  isDisabled={isDisabled}
                />
              );
            })}
          </div>
        </>
      )}

      {/* Investment Apply Panel */}
      {cardType === 'investment' && selectedCard && (
        <div ref={paymentSectionRef} className={`${glassPanel} mt-2 overflow-hidden`}>
          <div className="p-4 md:p-6 space-y-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-600 mb-1">Play investment</p>
                <h3 className="text-base font-bold text-slate-900">{selectedCard.title}</h3>
                <p className="text-sm text-slate-700 mt-1">
                  Cost: ${Number(selectedCard.cost).toLocaleString()}
                </p>
                <p className="text-sm text-slate-700">
                  Risk: <span className="font-semibold">{selectedCard.availableRisks?.[0] || '—'}</span>
                </p>
              </div>
              <button
                type="button"
                onClick={cancelApply}
                className="text-sm px-3 py-1.5 rounded-full bg-white/30 border border-white/40 text-slate-800 hover:bg-white/45 shrink-0"
              >
                Close
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-slate-600 mb-2">Payment method</label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-white/40 bg-white/25 text-slate-900"
                  disabled={selectedCard.cashOnly === true}
                >
                  <option value="cash">Pay with Cash</option>
                  <option value="finance" disabled={selectedCard.cashOnly === true}>
                    Finance (25% interest) {selectedCard.cashOnly ? '(Not Available)' : ''}
                  </option>
                </select>
                {selectedCard.cashOnly && (
                  <p className="text-xs text-slate-600 mt-1.5">Cash purchase only</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-slate-600 mb-2">
                  Dice roll (1–6) {selectedCard.noDice ? '(not required)' : ''}
                </label>
                <select
                  value={diceRoll}
                  onChange={(e) => setDiceRoll(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-white/40 bg-white/25 text-slate-900"
                  disabled={selectedCard.noDice === true}
                >
                  <option value="">--</option>
                  {[1, 2, 3, 4, 5, 6].map((n) => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
                {selectedCard.noDice && (
                  <p className="text-xs text-slate-600 mt-1.5">No dice roll required</p>
                )}
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 pt-1">
              <button
                type="button"
                onClick={applyInvestment}
                className="flex-1 px-4 py-3 rounded-2xl bg-gradient-to-r from-emerald-500 to-green-600 text-white font-semibold shadow-lg shadow-emerald-500/25 hover:from-emerald-600 hover:to-green-700 disabled:opacity-45 disabled:cursor-not-allowed transition"
                disabled={!selectedCard.noDice && !diceRoll}
              >
                {selectedCard.noDice ? 'Purchase investment' : 'Apply investment result'}
              </button>
              <button
                type="button"
                onClick={cancelApply}
                className="px-4 py-3 rounded-2xl bg-white/25 border border-white/40 text-slate-800 font-semibold hover:bg-white/35 transition"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Luxury Apply Panel (no dice) */}
      {cardType === 'luxury' && selectedCard && (
        <div ref={paymentSectionRef} className={`${glassPanel} mt-2 overflow-hidden`}>
          <div className="p-4 md:p-6 space-y-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-600 mb-1">Buy luxury</p>
                <h3 className="text-base font-bold text-slate-900">{selectedCard.title}</h3>
                <p className="text-sm text-slate-700 mt-1">
                  Cost: ${Number(selectedCard.cost).toLocaleString()}
                </p>
                <p className="text-sm text-slate-700">
                  Resale: ${Number(selectedCard.resale).toLocaleString()}
                </p>
                <p className="text-sm font-semibold text-amber-800">REP: +{Number(selectedCard.rep)}</p>
              </div>
              <button
                type="button"
                onClick={cancelApply}
                className="text-sm px-3 py-1.5 rounded-full bg-white/30 border border-white/40 text-slate-800 hover:bg-white/45 shrink-0"
              >
                Close
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-slate-600 mb-2">Payment method</label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-white/40 bg-white/25 text-slate-900"
                >
                  <option value="cash">Pay with Cash</option>
                  <option value="finance">Finance (25% interest)</option>
                </select>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 pt-1">
              <button
                type="button"
                onClick={applyLuxury}
                className="flex-1 px-4 py-3 rounded-2xl bg-gradient-to-r from-fuchsia-500 to-violet-600 text-white font-semibold shadow-lg shadow-violet-500/25 hover:from-fuchsia-600 hover:to-violet-700 transition"
              >
                Confirm purchase
              </button>
              <button
                type="button"
                onClick={cancelApply}
                className="px-4 py-3 rounded-2xl bg-white/25 border border-white/40 text-slate-800 font-semibold hover:bg-white/35 transition"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
