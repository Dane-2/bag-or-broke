import React from 'react';

function RepCareerPoints({ rep, career, setRep, setCareer }) {
  return (
    <section className="bg-white rounded-xl shadow-md p-4">
      <h3 className="text-lg font-semibold text-yellow-600 mb-2 flex items-center gap-2">
        🌟 REP & Career Points
      </h3>
      <p className="text-gray-800 text-sm mb-3">
        REP: <span className="font-bold">{rep}</span> &nbsp;|&nbsp; Career: <span className="font-bold">{career}</span>
      </p>
      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={() => setRep(rep + 1)}
          className="bg-yellow-500 text-white font-semibold py-2 rounded hover:bg-yellow-600 transition"
        >
          +1 REP
        </button>
        <button
          onClick={() => setRep(rep > 0 ? rep - 1 : 0)}
          className="bg-yellow-100 text-yellow-800 font-semibold py-2 rounded hover:bg-yellow-200 transition"
        >
          -1 REP
        </button>
        <button
          onClick={() => setCareer(career + 1)}
          className="bg-blue-500 text-white font-semibold py-2 rounded hover:bg-blue-600 transition"
        >
          +1 Career
        </button>
        <button
          onClick={() => setCareer(career > 0 ? career - 1 : 0)}
          className="bg-blue-100 text-blue-800 font-semibold py-2 rounded hover:bg-blue-200 transition"
        >
          -1 Career
        </button>
      </div>
    </section>
  );
}

export default RepCareerPoints;
