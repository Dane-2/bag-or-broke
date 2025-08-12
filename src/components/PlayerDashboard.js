import React, { useState } from 'react';
import CardSelector from './CardSelector';

import LapTracker from './LapTracker';
import CashTracker from './CashTracker';
import InvestmentLog from './InvestmentLog';
import LuxuryLog from './LuxuryLog';
import DebtCreditTracker from './DebtCreditTracker';
import CurveballSection from './CurveballSection';
import RepCareerPoints from './RepCareerPoints';
import FinalNetWorth from './FinalNetWorth';

function PlayerDashboard({ playerName, avatar, startingCash, showFinal, totalLaps: initialTotalLaps }) {
  const [cash, setCash] = useState(startingCash || 0);
  const [rep, setRep] = useState(0);
  const [career, setCareer] = useState(0);
  const [luxuries, setLuxuries] = useState([]);
  const [curveballs, setCurveballs] = useState([]);
  const [debt, setDebt] = useState(0);
  const [credit, setCredit] = useState(500);
  const [investments, setInvestments] = useState([]);
  const [laps, setLaps] = useState(0);
  const totalLaps = initialTotalLaps || 5;
  const [shadyDebt, setShadyDebt] = useState(0);
  const [cardType, setCardType] = useState(''); // start empty

  const handleCardSelection = (cardResult) => {
    if (cardResult.type === 'investment') {
      const {
        cardTitle,
        cost,
        result,
        newValue,
        percent,
        borrowed,
        interest
      } = cardResult;

      setCash(prev => prev - (borrowed ? 0 : cost) + newValue);
      if (borrowed) {
        setDebt(prev => prev + cost + interest);
        setCredit(prev => prev - 20);
      }

      setInvestments(prev => [...prev, { ...cardResult }]);
      alert(`Result: ${percent}% → New Value: $${newValue.toLocaleString()}`);
    }

    if (cardResult.type === 'luxury') {
      const {
        cardTitle,
        cost,
        resale,
        rep: repGain
      } = cardResult;

      setCash(prev => prev - cost);
      setRep(prev => prev + repGain);
      setLuxuries(prev => [...prev, { name: cardTitle, resale, rep: repGain }]);
      alert(`Purchased ${cardTitle}! +${repGain} REP`);
    }
  };

  return (
    <div
      className="min-h-screen bg-no-repeat bg-center bg-[length:100%_auto] sm:bg-cover"
      style={{ backgroundImage: "url('/moneyBG.png')" }}
    >
      <div className="max-w-md mx-auto px-4 py-6 space-y-6 bg-white/80 rounded-xl shadow-xl">
        <div className="bg-white rounded-xl shadow-md p-4 text-center space-y-1">
          <h2 className="text-2xl font-bold text-gray-800">Player Dashboard</h2>
          <p className="text-gray-600"><strong>Name:</strong> {playerName}</p>
          <p className="text-gray-600"><strong>NIL Tier:</strong> {avatar}</p>
        </div>

        <LapTracker
          laps={laps}
          totalLaps={totalLaps}
          setLaps={setLaps}
          investments={investments}
          setInvestments={setInvestments}
          showFinal={showFinal}
          playerSnapshot={{
            playerName,
            cash,
            luxuries,
            rep,
            career,
            debt,
            credit,
            curveballs,
            shadyDebt
          }}
        />

        <CashTracker cash={cash} setCash={setCash} />

        {/* 🔽 Dropdown with Tailwind styling */}
        <div className="text-center">
          <label className="block text-sm font-medium text-gray-700 mb-1">Choose Card Type</label>
          <select
            value={cardType}
            onChange={(e) => setCardType(e.target.value)}
            className="mx-auto w-60 px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">-- Select Card Type --</option>
            <option value="investment">💼 Investment Cards</option>
            <option value="luxury">💎 Luxury Cards</option>
          </select>
        </div>

        {/* Only show CardSelector once a type is chosen */}
        {cardType && <CardSelector type={cardType} onSelect={handleCardSelection} />}

        <InvestmentLog
          investments={investments}
          setInvestments={setInvestments}
          setCash={setCash}
        />

        <LuxuryLog
          luxuries={luxuries}
          setLuxuries={setLuxuries}
          setCash={setCash}
          setRep={setRep}
        />

        <DebtCreditTracker
          cash={cash}
          setCash={setCash}
          debt={debt}
          setDebt={setDebt}
          credit={credit}
          setCredit={setCredit}
        />

        <CurveballSection
          curveballs={curveballs}
          setCurveballs={setCurveballs}
          setCash={setCash}
          setRep={setRep}
          setShadyDebt={setShadyDebt}
        />

        <RepCareerPoints
          rep={rep}
          career={career}
          setRep={setRep}
          setCareer={setCareer}
        />

        <FinalNetWorth
          cash={cash}
          luxuries={luxuries}
          rep={rep}
          career={career}
          credit={credit}
          debt={debt}
          curveballs={curveballs}
          playerName={playerName}
          showFinal={showFinal}
          shadyDebt={shadyDebt}
          investments={investments}
        />
      </div>
    </div>
  );
}

export default PlayerDashboard;
