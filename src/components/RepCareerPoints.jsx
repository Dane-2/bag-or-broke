import React from 'react';

function RepCareerPoints({ rep, career }) {
  return (
    <section className="bg-white rounded-xl shadow-md p-4">
      <h3 className="text-lg font-semibold text-yellow-600 mb-2 flex items-center gap-2">
        🌟 REP & Career Points
      </h3>
      <p className="text-gray-800 text-sm mb-3">
        REP: <span className="font-bold">{rep}</span> &nbsp;|&nbsp; Career: <span className="font-bold">{career}</span>
      </p>
      <p className="text-xs text-gray-500 italic">
        Points are automatically awarded through gameplay
      </p>
    </section>
  );
}

export default RepCareerPoints;
