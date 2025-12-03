import React from "react";

export default function MultiplayerModeScreen({ onSelect }) {
  return (
    <div className="min-h-screen bg-cover bg-center bg-no-repeat flex items-center justify-center"
      style={{ backgroundImage: "url(/backgroundFinal.png)" }}
    >
      <div className="w-[90%] max-w-md p-6 space-y-6 bg-white/70 backdrop-blur-md rounded-xl shadow-lg">

        <h1 className="text-2xl font-bold text-center text-gray-800">
          🎮 Multiplayer Mode
        </h1>

        <p className="text-center text-gray-600">
          Choose how you want to play:
        </p>

        {/* Host Button */}
        <button
          onClick={() => onSelect("host")}
          className="w-full bg-blue-600 text-white font-semibold py-3 rounded-lg hover:bg-blue-700 transition"
        >
          🏠 Host a Room
        </button>

        {/* Join Button */}
        <button
          onClick={() => onSelect("join")}
          className="w-full bg-green-600 text-white font-semibold py-3 rounded-lg hover:bg-green-700 transition"
        >
          🔑 Join a Room
        </button>

        {/* Back Button */}
        <button
          onClick={() => onSelect("back")}
          className="w-full bg-gray-300 text-gray-800 font-semibold py-2 rounded hover:bg-gray-400 transition"
        >
          ← Back to Start
        </button>

      </div>
    </div>
  );
}
