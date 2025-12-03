import React from "react";

export default function MultiplayerMode({ onSelectMode }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="bg-white shadow-lg rounded-xl p-6 w-[90%] max-w-md space-y-4 text-center">

        <h1 className="text-2xl font-bold text-gray-800">
          Choose Game Mode
        </h1>

        <button
          onClick={() => onSelectMode("offline")}
          className="w-full py-3 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700"
        >
          Offline Game
        </button>

        <button
          onClick={() => onSelectMode("online")}
          className="w-full py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700"
        >
          Multiplayer Game
        </button>

      </div>
    </div>
  );
}
