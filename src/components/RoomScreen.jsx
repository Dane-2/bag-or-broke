import { useState } from "react";
import { createRoom, joinRoom } from "../utils/roomApi";
import { supabase } from "../utils/supabaseClient";
import tiers from "../data/tiers";

export default function RoomScreen({ hostMode, onJoin }) {
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [tierNumber, setTierNumber] = useState("1"); // Default to tier 1 (Walk-On)
  const [totalLaps] = useState(5); // host will set later in lobby (coming next)
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Calculate starting cash based on tier
  const selectedTier = tiers[parseInt(tierNumber)];
  const startingCash = selectedTier ? selectedTier.amount + 2500 : 12500; // + $2,500 scholarship
  const avatarLabel = selectedTier ? selectedTier.label : "Walk-On";

  // ----------------------------------------------------
  // HOST MODE — CREATE ROOM
  // ----------------------------------------------------
  async function handleHost() {
    if (!name.trim()) {
      setError("Enter your name");
      return;
    }

    setLoading(true);
    setError("");

    // 1. Create room via Edge Function
    const res = await createRoom();
    if (!res || res.error) {
      setError(res?.error || "Failed to create room");
      setLoading(false);
      return;
    }

    const { roomId, code } = res;
    if (!roomId) {
      setError("Invalid room response from server");
      setLoading(false);
      return;
    }

    // 2. Create host player entry
    const { data: player, error: insertErr } = await supabase
      .from("player_state")
      .insert({
        room_id: roomId,
        name,
        avatar: avatarLabel,
        cash: startingCash,
        rep: 0,
        credit: 500,
        debt: 0,
        shadyDebt: 0,
        laps: 0,
        investments: [],
        luxuries: [],
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (insertErr || !player) {
      setError(insertErr?.message || "Failed to create host player");
      setLoading(false);
      return;
    }

    // 3. Save host info to rooms table
    await supabase
      .from("rooms")
      .update({
        host_player_id: player.player_id,
        host_name: name
      })
      .eq("id", roomId);

    setLoading(false);

    // 4. Pass info back up
    onJoin({
      roomId,
      code,
      name,
      avatar: avatarLabel,
      playerId: player.player_id,
      hostPlayerId: player.player_id,
      isHost: true,
      startingCash,
      totalLaps
    });
  }

  // ----------------------------------------------------
  // JOIN MODE — JOIN EXISTING ROOM
  // ----------------------------------------------------
  async function handleJoin() {
    if (!name.trim() || !code.trim()) {
      setError("Enter your name and room code");
      return;
    }

    setLoading(true);
    setError("");

    const res = await joinRoom(code.trim().toUpperCase(), name.trim(), avatarLabel, startingCash);

    console.log("💬 joinRoom response:", res);
    setLoading(false);

    if (!res || res.error) {
      // User-friendly error messages
      const errorMsg = res?.error || "Failed to join room";
      if (errorMsg.includes("Room not found")) {
        setError("Room not found. Please check the room code and try again.");
      } else if (errorMsg.includes("full") || errorMsg.includes("maximum")) {
        setError("Room is full (6 players maximum). Please join another room.");
      } else if (errorMsg.includes("started") || errorMsg.includes("completed")) {
        setError("This game has already started. Please join another room.");
      } else {
        setError(errorMsg);
      }
      return;
    }

    const { room, player } = res;

    if (!room?.id) {
      setError("Room does not exist");
      return;
    }
    if (!player?.player_id) {
      setError("Failed to create your player entry");
      return;
    }

    const isHost = room.host_player_id === player.player_id;

    // Pass sanitized room info
    onJoin({
      roomId: room.id,
      code: room.code,
      name,
      avatar: avatarLabel,
      playerId: player.player_id,
      hostPlayerId: room.host_player_id || null,
      isHost,
      startingCash: player.cash || startingCash, // Use cash from player_state if available
      totalLaps
    });
  }

  // ----------------------------------------------------
  // UI RENDER
  // ----------------------------------------------------
  return (
    <div
      className="min-h-screen bg-cover bg-center flex items-center justify-center"
      style={{ backgroundImage: "url(/backgroundFinal.png)" }}
    >
      <div className="w-[90%] max-w-md p-6 space-y-6 bg-white/70 backdrop-blur-md rounded-xl shadow-lg">
        
        <h1 className="text-2xl font-bold text-center">
          {hostMode ? "🏠 Host a Room" : "🔑 Join a Room"}
        </h1>

        {/* NAME */}
        <input
          type="text"
          placeholder="Enter your name"
          className="w-full border p-2 rounded"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />

        {/* NIL TIER SELECTION */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">What did you roll (1–6)?</label>
          <select
            className="w-full border p-2 rounded"
            value={tierNumber}
            onChange={(e) => setTierNumber(e.target.value)}
          >
            {[1, 2, 3, 4, 5, 6].map(num => (
              <option key={num} value={num.toString()}>
                {num} - {tiers[num].label} (${(tiers[num].amount + 2500).toLocaleString()})
              </option>
            ))}
          </select>
          {selectedTier && (
            <div className="mt-2 p-2 bg-gray-100 rounded text-sm">
              <p className="font-semibold">🎲 NIL Tier: {selectedTier.label}</p>
              <p className="text-gray-700">Base Cash: ${selectedTier.amount.toLocaleString()}</p>
              <p className="text-gray-700">+ $2,500 Scholarship</p>
              <p className="text-lg font-bold text-blue-600">Total: ${startingCash.toLocaleString()}</p>
            </div>
          )}
        </div>

        {/* ROOM CODE (JOIN MODE ONLY) */}
        {!hostMode && (
          <input
            type="text"
            maxLength={6}
            placeholder="Room Code"
            className="w-full border p-2 rounded uppercase"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
          />
        )}

        {/* SUBMIT */}
        <button
          onClick={hostMode ? handleHost : handleJoin}
          disabled={!name.trim() || !tierNumber || loading}
          className={`w-full text-white font-semibold py-3 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed
            ${hostMode ? "bg-blue-600 hover:bg-blue-700" : "bg-green-600 hover:bg-green-700"}`}
        >
          {loading ? "Loading..." : hostMode ? "Create Room" : "Join Room"}
        </button>

        {error && <p className="text-center text-red-600">{error}</p>}
      </div>
    </div>
  );
}
