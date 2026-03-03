import React, { useState, useEffect, useRef } from "react";
import useNetWorthHistory from "../hooks/useNetworthHistory";
import PlayerDetailsModal from "./PlayerDetailsModal";

export default function RoomHUD({ roomPlayers, currentPlayerId, roomStatus }) {
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const [highlightedPlayers, setHighlightedPlayers] = useState(new Set());
  const deltas = useNetWorthHistory(roomPlayers);
  const prevPlayersRef = useRef({});
  
  // Detect changes and highlight players
  useEffect(() => {
    const currentPlayerIds = Object.keys(roomPlayers);
    
    // Find players with changes
    const changedPlayers = new Set();
    
    currentPlayerIds.forEach(playerId => {
      const current = roomPlayers[playerId];
      const prev = prevPlayersRef.current[playerId];
      
      if (prev) {
        // Check if cash, investments, or luxuries changed
        if (
          current.cash !== prev.cash ||
          JSON.stringify(current.investments) !== JSON.stringify(prev.investments) ||
          JSON.stringify(current.luxuries) !== JSON.stringify(prev.luxuries) ||
          current.rep !== prev.rep ||
          current.debt !== prev.debt
        ) {
          changedPlayers.add(playerId);
        }
      }
    });
    
    if (changedPlayers.size > 0) {
      setHighlightedPlayers(changedPlayers);
      // Remove highlight after animation
      setTimeout(() => {
        setHighlightedPlayers(new Set());
      }, 2000);
    }
    
    prevPlayersRef.current = { ...roomPlayers };
  }, [roomPlayers]);

  if (!roomPlayers || Object.keys(roomPlayers).length === 0) return null;

  // Calculate net worth for each player (matching FinalScoreboard formula)
  const calculateNetWorth = (player) => {
    const cash = player.cash || 0;
    const debt = player.debt || 0;
    const shadyDebt = player.shadyDebt || 0;
    const rep = player.rep || 0;
    const career = player.career || 0;
    const credit = player.credit || 500;
    
    // Parse investments and luxuries if they're strings
    let investments = player.investments || [];
    let luxuries = player.luxuries || [];
    
    if (typeof investments === 'string') {
      try {
        investments = JSON.parse(investments || "[]");
      } catch (e) {
        investments = [];
      }
    }
    if (typeof luxuries === 'string') {
      try {
        luxuries = JSON.parse(luxuries || "[]");
      } catch (e) {
        luxuries = [];
      }
    }
    
    const investmentReturns = Array.isArray(investments)
      ? investments.reduce((acc, i) => acc + (i.newValue || 0), 0)
      : 0;
    const luxuryResale = Array.isArray(luxuries)
      ? luxuries.reduce((acc, item) => acc + (item.resale || 0), 0)
      : 0;
    // Updated scoring formula per PDF: rep * 5000, career * 10000, balance bonus +250000
    const repValue = rep * 5000;
    const careerValue = career * 10000;
    const creditBonus = credit >= 700 ? 10000 : credit >= 600 ? 5000 : credit >= 500 ? 2000 : 0;
    const balanceBonusValue = (player.balanceBonusAwarded || false) ? 250000 : 0;
    
    return cash + investmentReturns + luxuryResale + repValue + careerValue + creditBonus + balanceBonusValue - debt - shadyDebt;
  };

  // Sort players by NET WORTH (top to bottom)
  const players = Object.values(roomPlayers).sort((a, b) => {
    const netA = calculateNetWorth(a);
    const netB = calculateNetWorth(b);
    return netB - netA; // descending
  });

  function arrowFor(playerId) {
    const d = deltas[playerId];
    if (d === "up") return "⬆️";
    if (d === "down") return "⬇️";
    return "•";
  }

  return (
    <>
      <div className="bg-white/95 backdrop-blur-md p-3 rounded-xl shadow-md border mb-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-bold text-gray-800">🏆 Leaderboard</h3>
          {roomStatus && (
            <span className="text-xs uppercase tracking-wide text-gray-500">
              {roomStatus}
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 gap-2">
          {players.map((p, idx) => (
            <button
              key={p.player_id}
              onClick={() => setSelectedPlayer(p)}
              className={`p-2 rounded-lg flex justify-between items-center w-full text-left border transition-all duration-300
                ${
                  highlightedPlayers.has(p.player_id)
                    ? "ring-2 ring-yellow-400 ring-opacity-75 shadow-lg scale-105"
                    : ""
                }
                ${
                  p.isDisconnected
                    ? "bg-gray-200 border-gray-300 opacity-60"
                    : p.player_id === currentPlayerId
                    ? "bg-blue-100 border-blue-400"
                    : "bg-gray-100"
                }
              `}
            >
              <div>
                <p className={`font-semibold ${p.isDisconnected ? 'text-gray-400 line-through' : 'text-gray-800'}`}>
                  #{idx + 1} {p.name}
                  {p.isDisconnected && <span className="ml-2 text-xs text-red-500">⚠️ Disconnected</span>}
                </p>
                <p className={`text-xs ${p.isDisconnected ? 'text-gray-400' : 'text-gray-600'}`}>
                  Laps: {p.laps || 0}
                </p>
              </div>

              <div className="text-right text-sm">
                <p>💰 ${p.cash?.toLocaleString() || 0}</p>
                <p>💳 Debt: ${p.debt?.toLocaleString() || 0}</p>
                <p>⭐ REP: {p.rep || 0}</p>
                {(() => {
                  const invs = Array.isArray(p.investments) ? p.investments : [];
                  const luxs = Array.isArray(p.luxuries) ? p.luxuries : [];
                  if (invs.length > 0 || luxs.length > 0) {
                    return (
                      <p className="text-xs text-gray-500">
                        📈 {invs.length} 💎 {luxs.length}
                      </p>
                    );
                  }
                  return null;
                })()}
                <p className="text-lg">{arrowFor(p.player_id)}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Tap-To-View Modal */}
      {selectedPlayer && (
        <PlayerDetailsModal
          player={selectedPlayer}
          onClose={() => setSelectedPlayer(null)}
        />
      )}
    </>
  );
}
