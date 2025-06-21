import React from 'react';

const avatarImagePaths = {
  "The Architect": "/avatars/architect.png",
  "The Flameout": "/avatars/flameout.png",
  "The Legacy Maker": "/avatars/legacy.png",
  "The Hustler": "/avatars/hustler.png",
  "The Flexer": "/avatars/flexer.png",
  "The Survivor": "/avatars/survivor.png",
  "The CEO in Training": "/avatars/ceo.png",
  "The Hot Shot": "/avatars/hotshot.png"
};

const avatarDescriptions = {
  "The Architect": {
    sport: "Tennis 🎾",
    blurb: "You were never just playing the game—you were designing it. Strategic, disciplined, and legacy-focused.",
  },
  "The Flameout": {
    sport: "Basketball 🏀",
    blurb: "You came in hot with NIL deals and luxury—but big risks led to burnout. Fast fame, hard lessons.",
  },
  "The Legacy Maker": {
    sport: "Track & Field 🏃‍♂️",
    blurb: "Every move was intentional. You invested in purpose and came out with stability and respect.",
  },
  "The Hustler": {
    sport: "Softball 🥎",
    blurb: "Every dollar had a mission. You played with grit and turned pressure into profit.",
  },
  "The Flexer": {
    sport: "Soccer ⚽",
    blurb: "The drip was strong. Luxury was life. But investments and REP took a backseat.",
  },
  "The Survivor": {
    sport: "Wrestling 🤼‍♂️",
    blurb: "Curveballs came heavy, but you adapted. Resourceful, respected, and resilient.",
  },
  "The CEO in Training": {
    sport: "Golf ⛳",
    blurb: "Smart plays, steady cash flow, and future-ready. You’re built for boardrooms.",
  },
  "The Hot Shot": {
    sport: "Football 🏈",
    blurb: "NIL superstar, headline-maker. But without planning, the fire faded fast.",
  }
};

function determineAvatar({ cash, luxuries, rep, career, debt, credit }) {
  const totalLuxury = luxuries.reduce((sum, l) => sum + l.resale, 0);

  if (rep >= 12 && career >= 4 && cash >= 100000) return "The Architect";
  if (rep < 2 && totalLuxury >= 100000) return "The Flexer";
  if (debt >= 100000 && rep < 3) return "The Flameout";
  if (credit < 500 && cash < 10000) return "The Survivor";
  if (rep >= 10 && cash >= 150000) return "The CEO in Training";
  if (career >= 5 && rep >= 5) return "The Legacy Maker";
  if (rep >= 4 && totalLuxury < 25000 && cash < 50000) return "The Hustler";
  if (cash >= 200000 && rep < 2) return "The Hot Shot";

  return "The Survivor";
}

function FinalScoreboard({ data }) {
  if (!data) return <p>No final data to show.</p>;

  const {
    playerName,
    cash,
    luxuries,
    rep,
    career,
    debt,
    credit
  } = data;

  const luxuryResale = (luxuries || []).reduce((acc, item) => acc + item.resale, 0);
  const repValue = rep * 2500;
  const careerValue = career * 5000;
  const creditBonus =
    credit >= 700 ? 10000 :
    credit >= 600 ? 5000 :
    credit >= 500 ? 2000 : 0;

  const netWorth =
    cash + luxuryResale + repValue + careerValue + creditBonus - debt;

  const finalAvatar = determineAvatar({ cash, luxuries, rep, career, debt, credit });
  const description = avatarDescriptions[finalAvatar];

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 px-4">
      <div className="bg-white p-6 rounded-xl shadow-md w-full max-w-md space-y-6">
        <h2 className="text-2xl font-bold text-center text-indigo-700">🏁 Final Scoreboard</h2>

        <div className="text-center space-y-1 text-gray-700">
          <p><strong>Player:</strong> {playerName}</p>
          <p><strong>Avatar:</strong> {finalAvatar}</p>
        </div>

        <ul className="space-y-1 text-sm text-gray-800">
          <li>💵 <strong>Cash:</strong> ${cash.toLocaleString()}</li>
          <li>💎 <strong>Luxury Resale:</strong> ${luxuryResale.toLocaleString()}</li>
          <li>🌟 <strong>REP Value:</strong> ${repValue.toLocaleString()}</li>
          <li>📚 <strong>Career Value:</strong> ${careerValue.toLocaleString()}</li>
          <li>🧠 <strong>Credit Bonus:</strong> ${creditBonus.toLocaleString()}</li>
          <li>💳 <strong>Debt:</strong> -${debt.toLocaleString()}</li>
        </ul>

        <h3 className="text-xl font-bold text-center">
          Net Worth: ${netWorth.toLocaleString()}
        </h3>

        {description && (
          <div className="bg-indigo-50 border border-indigo-200 rounded mt-4 p-4 shadow-sm">
            <img
              src={avatarImagePaths[finalAvatar]}
              alt={finalAvatar}
              className="w-32 h-32 object-contain mx-auto mb-3"
            />
            <h3 className="text-lg font-bold text-indigo-800">{finalAvatar}</h3>
            <p className="text-sm text-gray-600 italic mb-2">{description.sport}</p>
            <p className="text-gray-800">{description.blurb}</p>
          </div>
        )}

        <button
          onClick={() => window.location.reload()}
          className="w-full bg-indigo-600 text-white font-semibold py-2 rounded hover:bg-indigo-700 transition"
        >
          Restart Game
        </button>
      </div>
    </div>
  );
}

export default FinalScoreboard;
