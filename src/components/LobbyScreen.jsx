import React, { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "../utils/supabaseClient";
import { startGame as startGameRequest, leaveRoom as leaveRoomRequest } from "../utils/roomApi";
import ConnectionStatus from "./ConnectionStatus";

export default function LobbyScreen({ roomInfo, onStartGame, onLeaveRoom }) {
  const { roomId, playerId, hostPlayerId, code } = roomInfo;

  const [players, setPlayers] = useState([]);
  const [connectionStatus, setConnectionStatus] = useState('connecting');
  const [reconnectTrigger, setReconnectTrigger] = useState(0);
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimeoutRef = useRef(null);
  const channelRef = useRef(null);

  const isHost = playerId === hostPlayerId;

  console.log("🔵 LobbyScreen loaded with:", roomInfo);

  // ----------------------------------------
  // LOAD PLAYERS INITIALLY
  // ----------------------------------------
  async function loadPlayers() {
    if (!roomId) return;

    const { data, error } = await supabase
      .from("player_state")
      .select("*")
      .eq("room_id", roomId)
      .order("updated_at", { ascending: true });

    if (error) {
      console.error("❌ Error loading players:", error);
      return;
    }

    if (data) {
      console.log("✅ Loaded players:", data.length);
      setPlayers(data);
    }
  }

  useEffect(() => {
    loadPlayers();
    
    // Polling fallback: refresh players every 2 seconds
    // This ensures players see updates even if realtime fails
    const pollInterval = setInterval(() => {
      loadPlayers();
    }, 2000);

    return () => clearInterval(pollInterval);
  }, [roomId]);

  // Reconnection handler (defined before useEffect to avoid scope issues)
  const handleReconnect = useRef(() => {});
  handleReconnect.current = () => {
    if (reconnectAttemptsRef.current >= 5) {
      setConnectionStatus('disconnected');
      return;
    }

    reconnectAttemptsRef.current += 1;
    const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current - 1), 30000);
    
    setConnectionStatus('reconnecting');

    reconnectTimeoutRef.current = setTimeout(() => {
      setConnectionStatus('connecting');
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      setReconnectTrigger(prev => prev + 1);
    }, delay);
  };

  // Check room status periodically (fallback for game start detection)
  useEffect(() => {
    if (!roomId || isHost) return; // Only non-host players need to poll for game start

    let isActive = true;

    const checkRoomStatus = async () => {
      if (!isActive) return;

      const { data, error } = await supabase
        .from("rooms")
        .select("status")
        .eq("id", roomId)
        .maybeSingle();

      if (error) {
        console.warn("⚠️ Error checking room status (polling):", error.message);
        return;
      }

      if (data?.status === "started") {
        console.log("🚀 Room status is 'started' (polling detected)");
        onStartGame();
      }
    };

    // Check immediately, then every 1 second for game start (only if not host)
    checkRoomStatus();
    const statusCheckInterval = setInterval(checkRoomStatus, 1000);

    return () => {
      isActive = false;
      clearInterval(statusCheckInterval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, isHost]);

  // ----------------------------------------
  // REALTIME LISTENERS (players + room status)
  // ----------------------------------------
  useEffect(() => {
    if (!roomId) return;

    // Clear any existing reconnection attempts
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    console.log("📡 Subscribing to realtime lobby updates for", roomId);

    const channel = supabase
      .channel(`lobby_${roomId}`)
      // LISTEN FOR PLAYER CHANGES
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "player_state",
          filter: `room_id=eq.${roomId}`,
        },
        (payload) => {
          console.log("🔄 Player state changed:", payload.eventType, payload.new || payload.old);
          // Immediately reload players when we get a realtime event
          loadPlayers();
        }
      )
      // LISTEN FOR GAME START
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "rooms",
          filter: `id=eq.${roomId}`,
        },
        (payload) => {
          console.log("🔄 Room status changed:", payload.new?.status);
          if (payload.new?.status === "started") {
            console.log("🚀 Room has switched to status=started (realtime detected)");
            onStartGame();
          }
        }
      )
      .subscribe((status) => {
        console.log("📡 Realtime subscription status:", status);
        channelRef.current = channel;
        
        if (status === "SUBSCRIBED") {
          console.log("✅ Successfully subscribed to lobby updates");
          setConnectionStatus('connected');
          reconnectAttemptsRef.current = 0; // Reset on successful connection
          // Immediately load players after subscription is confirmed
          loadPlayers();
        } else if (status === "CHANNEL_ERROR") {
          console.error("❌ Realtime channel error");
          // Don't immediately reconnect - let polling handle game start detection
          setConnectionStatus('disconnected');
          // Only reconnect if we're still in lobby (not transitioning to game)
          if (reconnectAttemptsRef.current < 3) {
            handleReconnect.current();
          }
        } else if (status === "TIMED_OUT") {
          console.warn("⚠️ Realtime subscription timed out");
          // Don't immediately reconnect - let polling handle game start detection
          setConnectionStatus('disconnected');
          // Only reconnect if we're still in lobby (not transitioning to game)
          if (reconnectAttemptsRef.current < 3) {
            handleReconnect.current();
          }
        } else if (status === "CLOSED") {
          console.log("🔌 Realtime channel closed");
          // Don't reconnect on CLOSED - it might be intentional (game starting)
          // Polling will handle game start detection
          setConnectionStatus('disconnected');
        }
      });

    return () => {
      console.log("🔌 Unsubscribing from lobby realtime");
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
    // Remove onStartGame from dependencies to prevent re-subscriptions
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, reconnectTrigger]);

  // ----------------------------------------
  // HOST: START THE GAME (EDGE FUNCTION)
  // ----------------------------------------
  async function handleStartGame() {
    console.log("🔥 Host starting game via Edge Function…");

    const res = await startGameRequest(roomId, roomInfo.totalLaps ?? 5);
    if (res?.error) {
      console.error("❌ startGame function error:", res.error);
      return;
    }

    // Wait a moment for the database update to propagate
    // Then verify the room status changed before transitioning
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Try to verify room status, but don't block on it
    const { data: roomData, error: roomError } = await supabase
      .from("rooms")
      .select("status")
      .eq("id", roomId)
      .maybeSingle(); // Use maybeSingle() instead of single() to avoid 400 errors

    if (roomError) {
      console.error("❌ Error verifying room status:", roomError);
      // Still transition - the edge function succeeded
      onStartGame();
      return;
    }

    if (roomData?.status === "started") {
      console.log("✅ Room status confirmed as 'started'");
      onStartGame();
    } else {
      console.warn("⚠️ Room status not 'started' yet, transitioning anyway");
      onStartGame();
    }
  }

  // ----------------------------------------
  // UI
  // ----------------------------------------
  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center">
      <div className="w-[90%] max-w-md p-6 bg-white shadow-lg rounded-xl space-y-4">

        <ConnectionStatus
          status={connectionStatus}
          onRetry={() => {
            reconnectAttemptsRef.current = 0;
            if (channelRef.current) {
              supabase.removeChannel(channelRef.current);
              channelRef.current = null;
            }
            setReconnectTrigger(prev => prev + 1);
          }}
        />

        <h2 className="text-2xl font-bold text-center">Game Lobby</h2>

        <p className="text-center text-blue-600 font-semibold">
          Room Code: {code}
        </p>

        <div>
          <h3 className="font-semibold mb-2">
            Players ({players.length}/6)
            {players.length >= 6 && (
              <span className="ml-2 text-xs text-red-600 font-normal">Room Full</span>
            )}
          </h3>

          <div className="space-y-2">
            {players.map((p) => (
              <div
                key={p.player_id}
                className="p-3 bg-gray-100 rounded flex justify-between items-center"
              >
                <div>
                  <p className="font-semibold">{p.name}</p>
                  <p className="text-sm text-gray-500">{p.avatar}</p>
                </div>

                {p.player_id === hostPlayerId && (
                  <span className="text-xs bg-yellow-400 px-2 py-1 rounded">
                    Host
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* HOST START BUTTON */}
        {isHost ? (
          <button
            onClick={handleStartGame}
            className="w-full bg-green-600 text-white py-3 rounded-lg hover:bg-green-700 transition"
          >
            Start Game
          </button>
        ) : (
          <p className="text-center text-gray-500">
            Waiting for the host to start…
          </p>
        )}

        {/* LEAVE ROOM BUTTON */}
        <button
          onClick={async () => {
            if (window.confirm("Are you sure you want to leave the room?")) {
              const res = await leaveRoomRequest(roomId, playerId);
              if (res?.error) {
                console.error("❌ Leave room error:", res.error);
                alert("Failed to leave room: " + res.error);
              } else {
                onLeaveRoom?.();
              }
            }
          }}
          className="w-full bg-red-500 text-white py-2 rounded-lg hover:bg-red-600 transition mt-2"
        >
          Leave Room
        </button>
      </div>
    </div>
  );
}
