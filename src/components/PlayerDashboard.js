import React, { useState, useEffect, useRef } from 'react';
import CardSelector from './CardSelector';

import LapTracker from './LapTracker';
import CashTracker from './CashTracker';
import InvestmentLog from './InvestmentLog';
import LuxuryLog from './LuxuryLog';
import DebtCreditTracker from './DebtCreditTracker';
import CurveballSection from './CurveballSection';
import RepCareerPoints from './RepCareerPoints';
import FinalNetWorth from './FinalNetWorth';

import { fetchAiSummary } from '../utils/fetchAiSummary';
import { supabase, isSupabaseConfigured } from '../utils/supabaseClient';
import RoomHUD from "./RoomHUD";
import ToastContainer from "./ToastContainer";
import ConnectionStatus from "./ConnectionStatus";
import { leaveRoom as leaveRoomRequest } from '../utils/roomApi';

function PlayerDashboard({
  playerName,
  avatar,
  startingCash,
  showFinal,
  totalLaps: initialTotalLaps,
  roomInfo, // multiplayer info (null in offline mode)
  onLeaveRoom // callback when player leaves room
}) {
  // =====================================================
  // LOCAL GAME STATE
  // =====================================================
  const [cash, setCash] = useState(startingCash || 0);
  const [rep, setRep] = useState(0);
  const [career, setCareer] = useState(0);
  const [luxuries, setLuxuries] = useState([]);
  const [curveballs, setCurveballs] = useState([]);
  const [debt, setDebt] = useState(0);
  const [credit, setCredit] = useState(500);
  const [investments, setInvestments] = useState([]);
  const [laps, setLaps] = useState(0);
  const [shadyDebt, setShadyDebt] = useState(0);
  const totalLaps = initialTotalLaps || 5;

  // Holds all players in multiplayer room
  const [roomPlayers, setRoomPlayers] = useState({});
  const [roomStatus, setRoomStatus] = useState(roomInfo?.status || "lobby");
  const roomId = roomInfo?.roomId;
  const currentPlayerId =
    roomInfo?.player?.player_id || roomInfo?.playerId || null;
  
  // Toast notifications for player actions
  const [toasts, setToasts] = useState([]);
  
  const addToast = (message, type = 'info', duration = 3000) => {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev, { id, message, type, duration }]);
  };
  
  const removeToast = (id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  // Connection status tracking
  const [connectionStatus, setConnectionStatus] = useState('connecting');
  const [reconnectTrigger, setReconnectTrigger] = useState(0);
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimeoutRef = useRef(null);
  const channelRef = useRef(null);

  // =====================================================
  // AUTOSAVE / AUTOLOAD
  // =====================================================
  const restoringRef = useRef(false);
  const saveKey = `bagorbroke_save_${playerName || 'Player'}`;

  useEffect(() => {
    const saved = localStorage.getItem(saveKey);
    if (!saved) return;

    try {
      const s = JSON.parse(saved);
      restoringRef.current = true;

      if (typeof s.cash === 'number') setCash(s.cash);
      if (typeof s.rep === 'number') setRep(s.rep);
      if (typeof s.career === 'number') setCareer(s.career);
      if (Array.isArray(s.luxuries)) setLuxuries(s.luxuries);
      if (Array.isArray(s.curveballs)) setCurveballs(s.curveballs);
      if (typeof s.debt === 'number') setDebt(s.debt);
      if (typeof s.credit === 'number') setCredit(s.credit);
      if (Array.isArray(s.investments)) setInvestments(s.investments);
      if (typeof s.laps === 'number') setLaps(s.laps);
      if (typeof s.shadyDebt === 'number') setShadyDebt(s.shadyDebt);

    } catch (e) {
      console.error('Failed to parse saved game:', e);
    } finally {
      setTimeout(() => {
        restoringRef.current = false;
      }, 0);
    }
  }, [saveKey]);

  useEffect(() => {
    if (restoringRef.current) return;

    const snapshot = {
      playerName,
      cash,
      rep,
      career,
      luxuries,
      curveballs,
      debt,
      credit,
      investments,
      laps,
      shadyDebt,
      totalLaps,
    };

    try {
      localStorage.setItem(saveKey, JSON.stringify(snapshot));
    } catch (e) {
      console.error('Failed to save game:', e);
    }
  }, [
    saveKey,
    playerName,
    cash,
    rep,
    career,
    luxuries,
    curveballs,
    debt,
    credit,
    investments,
    laps,
    shadyDebt,
    totalLaps,
  ]);

  const clearSave = () => {
    localStorage.removeItem(saveKey);
  };

  // =====================================================
  // MULTIPLAYER — LOAD + LISTEN
  // =====================================================

  // Load initial players
  useEffect(() => {
    if (!roomId || !isSupabaseConfigured) return;

    async function loadPlayers() {
      const { data, error } = await supabase
        .from("player_state")
        .select("*")
        .eq("room_id", roomId);

      if (error) {
        console.error("❌ Error loading players:", error);
        return;
      }

      if (data) {
        const mapped = {};
        const now = new Date();
        const DISCONNECT_THRESHOLD = 30000; // 30 seconds of no activity = disconnected
        
        data.forEach((p) => {
          // Parse JSON strings for investments and luxuries
          const parsed = { ...p };
          try {
            if (typeof parsed.investments === 'string') {
              parsed.investments = JSON.parse(parsed.investments || "[]");
            }
            if (typeof parsed.luxuries === 'string') {
              parsed.luxuries = JSON.parse(parsed.luxuries || "[]");
            }
          } catch (e) {
            console.error("Error parsing player data:", e);
            parsed.investments = Array.isArray(parsed.investments) ? parsed.investments : [];
            parsed.luxuries = Array.isArray(parsed.luxuries) ? parsed.luxuries : [];
          }
          
          // Check if player is disconnected (no activity for 30 seconds)
          if (parsed.updated_at) {
            const lastSeen = new Date(parsed.updated_at);
            const timeSinceUpdate = now - lastSeen;
            parsed.isDisconnected = timeSinceUpdate > DISCONNECT_THRESHOLD;
            parsed.lastSeen = parsed.updated_at;
          } else {
            parsed.isDisconnected = true; // No timestamp = disconnected
          }
          
          mapped[p.player_id] = parsed;
        });
        setRoomPlayers(mapped);
        console.log("✅ Loaded room players:", Object.keys(mapped).length);
      }
    }

    loadPlayers();
    
    // Periodically check for disconnected players (every 15 seconds)
    const disconnectCheckInterval = setInterval(() => {
      setRoomPlayers(prev => {
        const now = new Date();
        const DISCONNECT_THRESHOLD = 30000; // 30 seconds
        const updated = { ...prev };
        
        Object.keys(updated).forEach(playerId => {
          const player = updated[playerId];
          if (player.updated_at) {
            const lastSeen = new Date(player.updated_at);
            const timeSinceUpdate = now - lastSeen;
            updated[playerId] = {
              ...player,
              isDisconnected: timeSinceUpdate > DISCONNECT_THRESHOLD
            };
          }
        });
        
        return updated;
      });
    }, 15000); // Check every 15 seconds
    
    return () => clearInterval(disconnectCheckInterval);
  }, [roomId]);

  // Reconnection logic with exponential backoff
  const attemptReconnect = useRef(() => {});
  attemptReconnect.current = () => {
    if (reconnectAttemptsRef.current >= 5) {
      setConnectionStatus('disconnected');
      addToast('Connection failed. Please refresh the page.', 'error', 5000);
      return;
    }

    reconnectAttemptsRef.current += 1;
    const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current - 1), 30000);
    
    setConnectionStatus('reconnecting');
    addToast(`Reconnecting... (Attempt ${reconnectAttemptsRef.current}/5)`, 'warning', 3000);

    reconnectTimeoutRef.current = setTimeout(() => {
      // Re-subscribe by triggering useEffect with reconnectTrigger
      setConnectionStatus('connecting');
      // Force re-render to re-subscribe by incrementing trigger
      const currentChannel = channelRef.current;
      if (currentChannel) {
        supabase.removeChannel(currentChannel);
        channelRef.current = null;
      }
      setReconnectTrigger(prev => prev + 1);
    }, delay);
  };

  // Listen for realtime updates with reconnection
  useEffect(() => {
    if (!roomId || !isSupabaseConfigured) return;

    // Clear any existing reconnection attempts
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    console.log("🔴 Subscribing to realtime room:", roomId, reconnectTrigger > 0 ? "(Reconnecting)" : "");
    setConnectionStatus('connecting');

    const channel = supabase
      .channel(`room_${roomId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "player_state",
          filter: `room_id=eq.${roomId}`,
        },
        (payload) => {
          console.log("🔄 Player state changed:", payload.eventType);
          if (payload.eventType === "DELETE") {
            const removed = payload.old?.player_id;
            if (!removed) return;
            setRoomPlayers(prev => {
              const next = { ...prev };
              delete next[removed];
              return next;
            });
            return;
          }

          const nextPlayer = payload.new;
          if (!nextPlayer?.player_id) return;
          
          // Parse JSON strings for investments and luxuries
          const parsedPlayer = { ...nextPlayer };
          try {
            if (typeof parsedPlayer.investments === 'string') {
              parsedPlayer.investments = JSON.parse(parsedPlayer.investments || "[]");
            }
            if (typeof parsedPlayer.luxuries === 'string') {
              parsedPlayer.luxuries = JSON.parse(parsedPlayer.luxuries || "[]");
            }
          } catch (e) {
            console.error("Error parsing player update:", e);
            parsedPlayer.investments = Array.isArray(parsedPlayer.investments) ? parsedPlayer.investments : [];
            parsedPlayer.luxuries = Array.isArray(parsedPlayer.luxuries) ? parsedPlayer.luxuries : [];
          }
          
          // Check if player is disconnected (no activity for 30 seconds)
          const now = new Date();
          const DISCONNECT_THRESHOLD = 30000; // 30 seconds
          if (parsedPlayer.updated_at) {
            const lastSeen = new Date(parsedPlayer.updated_at);
            const timeSinceUpdate = now - lastSeen;
            parsedPlayer.isDisconnected = timeSinceUpdate > DISCONNECT_THRESHOLD;
            parsedPlayer.lastSeen = parsedPlayer.updated_at;
          } else {
            parsedPlayer.isDisconnected = true;
          }
          
          // Detect actions: Compare with previous state to detect new investments/luxuries
          setRoomPlayers(prev => {
            const prevPlayer = prev[parsedPlayer.player_id];
            
            // Only show notifications for other players (not yourself)
            if (prevPlayer && parsedPlayer.player_id !== currentPlayerId) {
              const prevInvestments = Array.isArray(prevPlayer.investments) ? prevPlayer.investments : [];
              const prevLuxuries = Array.isArray(prevPlayer.luxuries) ? prevPlayer.luxuries : [];
              const newInvestments = Array.isArray(parsedPlayer.investments) ? parsedPlayer.investments : [];
              const newLuxuries = Array.isArray(parsedPlayer.luxuries) ? parsedPlayer.luxuries : [];
              
              // Check for new investments (use setTimeout to call outside setState)
              if (newInvestments.length > prevInvestments.length) {
                const newInvestment = newInvestments[newInvestments.length - 1];
                setTimeout(() => {
                  addToast(
                    `💰 ${parsedPlayer.name} bought investment: ${newInvestment.cardTitle || 'Investment'}`,
                    'info',
                    4000
                  );
                }, 0);
              }
              
              // Check for new luxuries
              if (newLuxuries.length > prevLuxuries.length) {
                const newLuxury = newLuxuries[newLuxuries.length - 1];
                setTimeout(() => {
                  addToast(
                    `💎 ${parsedPlayer.name} bought luxury: ${newLuxury.name || 'Luxury Item'}`,
                    'success',
                    4000
                  );
                }, 0);
              }
              
              // Check for significant cash changes (might indicate big purchase)
              if (prevPlayer.cash && parsedPlayer.cash) {
                const cashDiff = prevPlayer.cash - parsedPlayer.cash;
                if (cashDiff > 50000) {
                  setTimeout(() => {
                    addToast(
                      `💸 ${parsedPlayer.name} made a big purchase!`,
                      'warning',
                      3000
                    );
                  }, 0);
                }
              }
            }
            
            return {
              ...prev,
              [parsedPlayer.player_id]: parsedPlayer
            };
          });
          
          console.log("🔄 Updated player:", parsedPlayer.player_id, "Investments:", parsedPlayer.investments?.length || 0, "Luxuries:", parsedPlayer.luxuries?.length || 0, parsedPlayer.isDisconnected ? "⚠️ DISCONNECTED" : "✅ Active");
        }
      )
      .subscribe((status) => {
        console.log("📡 Player state subscription status:", status);
        channelRef.current = channel;
        
        if (status === "SUBSCRIBED") {
          console.log("✅ Successfully subscribed to player state");
          setConnectionStatus('connected');
          reconnectAttemptsRef.current = 0; // Reset on successful connection
        } else if (status === "CHANNEL_ERROR") {
          console.error("❌ Player state channel error");
          setConnectionStatus('disconnected');
          attemptReconnect.current();
        } else if (status === "TIMED_OUT") {
          console.warn("⚠️ Realtime subscription timed out");
          setConnectionStatus('disconnected');
          attemptReconnect.current();
        } else if (status === "CLOSED") {
          console.log("🔌 Realtime channel closed");
          setConnectionStatus('disconnected');
          attemptReconnect.current();
        }
      });

    return () => {
      console.log("🟠 Unsubscribing:", roomId);
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [roomId, currentPlayerId, reconnectTrigger]);

  // Keep room metadata (i.e., started/completed) in sync
  useEffect(() => {
    if (!roomId || !isSupabaseConfigured) return;

    let isMounted = true;

    const fetchRoom = async () => {
      const { data, error } = await supabase
        .from("rooms")
        .select("status")
        .eq("id", roomId)
        .maybeSingle(); // Use maybeSingle() to avoid 400 errors if RLS blocks

      if (error) {
        console.error("❌ Error fetching room status:", error);
        return;
      }

      if (isMounted && data?.status) {
        setRoomStatus(data.status);
      }
    };

    fetchRoom();

    if (!isSupabaseConfigured) return;

    const channel = supabase
      .channel(`room_meta_${roomId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "rooms",
          filter: `id=eq.${roomId}`,
        },
        (payload) => {
          console.log("🔄 Room metadata changed:", payload.new?.status);
          if (payload.new?.status) {
            setRoomStatus(payload.new.status);
          }
        }
      )
      .subscribe((status) => {
        console.log("📡 Room metadata subscription status:", status);
        if (status === "SUBSCRIBED") {
          console.log("✅ Successfully subscribed to room metadata");
        } else if (status === "CHANNEL_ERROR") {
          console.error("❌ Room metadata channel error");
        }
      });

    return () => {
      isMounted = false;
      supabase.removeChannel(channel);
    };
  }, [roomId]);

  // =====================================================
  // SEND DELTAS (your changes)
  // =====================================================

  // Retry queue for failed syncs
  const failedSyncsRef = useRef([]);
  const retrySyncs = useRef(() => {});

  retrySyncs.current = async () => {
    if (failedSyncsRef.current.length === 0) return;

    const toRetry = [...failedSyncsRef.current];
    failedSyncsRef.current = [];

    for (const syncData of toRetry) {
      const { partial, isHeartbeat, retries = 0 } = syncData;
      
      if (retries >= 3) {
        addToast('Failed to sync some changes. Please refresh the page.', 'error', 5000);
        continue;
      }

      // Retry the sync
      const success = await syncToRoomInternal(partial, isHeartbeat, false);
      if (!success) {
        // Re-queue with incremented retry count
        failedSyncsRef.current.push({ ...syncData, retries: retries + 1 });
      }
    }

    // Retry remaining failed syncs after delay
    if (failedSyncsRef.current.length > 0) {
      setTimeout(() => retrySyncs.current(), 5000);
    }
  };

  async function syncToRoomInternal(partial, isHeartbeat = false, showErrors = true) {
    const roomId = roomInfo?.roomId;
    const currentPlayerId = roomInfo?.playerId;

    // Don't sync until player row & room exist
    if (!roomId || !currentPlayerId) return false;

    // Remove undefined values (Supabase rejects them)
    const sanitized = {};
    for (const [key, value] of Object.entries(partial)) {
      if (value !== undefined) {
        sanitized[key] = value;
      }
    }

    // Allow heartbeat updates even with empty object (just updates timestamp)
    if (Object.keys(sanitized).length === 0 && !isHeartbeat) return true;

    // Prevent sending raw objects → convert arrays to string
    if (sanitized.luxuries && Array.isArray(sanitized.luxuries)) {
      sanitized.luxuries = JSON.stringify(sanitized.luxuries);
    }

    if (sanitized.investments && Array.isArray(sanitized.investments)) {
      sanitized.investments = JSON.stringify(sanitized.investments);
    }

    // Perform the update
    const { error } = await supabase
      .from("player_state")
      .update({
        ...sanitized,
        updated_at: new Date().toISOString()
      })
      .eq("player_id", currentPlayerId)
      .eq("room_id", roomId);

    if (error) {
      console.error("🔥 SYNC ERROR:", error);
      if (showErrors && !isHeartbeat) {
        // Queue for retry
        failedSyncsRef.current.push({ partial, isHeartbeat, retries: 0 });
        setTimeout(() => retrySyncs.current(), 2000);
      }
      return false;
    }

    return true;
  }

  async function syncToRoom(partial, isHeartbeat = false) {
    return await syncToRoomInternal(partial, isHeartbeat, true);
  }


  useEffect(() => { if (roomId && currentPlayerId) syncToRoom({ cash }); }, [cash, roomId, currentPlayerId]);
  useEffect(() => { if (roomId && currentPlayerId) syncToRoom({ debt }); }, [debt, roomId, currentPlayerId]);
  useEffect(() => { if (roomId && currentPlayerId) syncToRoom({ credit }); }, [credit, roomId, currentPlayerId]);
  useEffect(() => { if (roomId && currentPlayerId) syncToRoom({ rep }); }, [rep, roomId, currentPlayerId]);
  useEffect(() => { if (roomId && currentPlayerId) syncToRoom({ laps }); }, [laps, roomId, currentPlayerId]);

  useEffect(() => {
    if (roomId && currentPlayerId) {
      syncToRoom({ luxuries });
    }
  }, [luxuries, roomId, currentPlayerId]);

  useEffect(() => {
    if (roomId && currentPlayerId) {
      syncToRoom({ investments });
    }
  }, [investments, roomId, currentPlayerId]);

  // =====================================================
  // HEARTBEAT: Keep player active status updated
  // =====================================================
  useEffect(() => {
    if (!roomId || !currentPlayerId) return;

    // Send heartbeat every 10 seconds to indicate player is still active
    const heartbeatInterval = setInterval(() => {
      syncToRoom({}, true); // Empty object with heartbeat flag just updates updated_at timestamp
    }, 10000); // 10 seconds

    return () => clearInterval(heartbeatInterval);
  }, [roomId, currentPlayerId]);

  // =====================================================
  // CLEANUP: Remove player when component unmounts (page close/refresh)
  // =====================================================
  useEffect(() => {
    if (!roomId || !currentPlayerId) return;

    const handleBeforeUnload = async () => {
      // Try to leave room when page is closing (may not always work due to browser restrictions)
      try {
        await leaveRoomRequest(roomId, currentPlayerId);
      } catch (e) {
        // Ignore errors - page is closing anyway
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      // Note: Component cleanup (leaving room) should be handled by explicit Leave Room button
      // This is just a fallback for unexpected unmounts
    };
  }, [roomId, currentPlayerId]);

  // =====================================================
  // GAME LOGIC
  // =====================================================

  // Rate limiting: Track last purchase time
  const lastPurchaseTimeRef = useRef(0);
  const RATE_LIMIT_MS = 2000; // 2 seconds between purchases

  const handleCardSelection = (cardResult) => {
    // Rate limiting check
    const now = Date.now();
    const timeSinceLastPurchase = now - lastPurchaseTimeRef.current;
    
    if (timeSinceLastPurchase < RATE_LIMIT_MS) {
      const waitTime = ((RATE_LIMIT_MS - timeSinceLastPurchase) / 1000).toFixed(1);
      addToast(`Please wait ${waitTime} seconds before making another purchase.`, 'warning', 3000);
      return;
    }

    // Validation: Check if player has sufficient funds
    if (cardResult.type === 'investment') {
      const { cost, borrowed } = cardResult;
      
      if (!borrowed && cash < cost) {
        addToast('Insufficient funds for this purchase.', 'error', 3000);
        return;
      }
      
      // Check credit if financing
      if (borrowed && credit < 20) {
        addToast('Insufficient credit for financing. Credit score too low.', 'error', 3000);
        return;
      }

      const { cost: finalCost, interest } = cardResult;
      if (borrowed) {
        setDebt(prev => prev + finalCost + interest);
        setCredit(prev => prev - 20);
      } else {
        setCash(prev => prev - finalCost);
      }
      setInvestments(prev => [...prev, { ...cardResult }]);
      lastPurchaseTimeRef.current = now;
      
      addToast(
        `Investment purchased for $${finalCost.toLocaleString()}${borrowed ? " (Financed with 25% interest)" : ""}`,
        'success',
        3000
      );
    }

    if (cardResult.type === 'luxury') {
      const { cardTitle, cost, resale, rep: repGain, borrowed, interest } = cardResult;
      
      if (!borrowed && cash < cost) {
        addToast('Insufficient funds for this purchase.', 'error', 3000);
        return;
      }
      
      // Check credit if financing
      if (borrowed && credit < 20) {
        addToast('Insufficient credit for financing. Credit score too low.', 'error', 3000);
        return;
      }

      if (borrowed) {
        setDebt(prev => prev + cost + interest);
        setCredit(prev => prev - 20);
      } else {
        setCash(prev => prev - cost);
      }
      setRep(prev => prev + repGain);
      setLuxuries(prev => [...prev, {
        name: cardTitle,
        cost,
        resale,
        rep: repGain,
        borrowed,
        interest,
      }]);
      lastPurchaseTimeRef.current = now;
      
      addToast(
        `Purchased ${cardTitle}! +${repGain} REP${borrowed ? " (Financed with 25% interest)" : ""}`,
        'success',
        3000
      );
    }
  };

  // Track if AI summary is being generated to prevent duplicate calls
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);

  const handleEndGame = async () => {
    // Prevent multiple simultaneous calls
    if (isGeneratingSummary) {
      addToast('Generating your summary, please wait...', 'info', 2000);
      return;
    }

    setIsGeneratingSummary(true);
    addToast('Generating your AI summary...', 'info', 3000);

    try {
      console.log('🎯 Generating AI summary for:', playerName);
      
      const { summary, archetype } = await fetchAiSummary({
        name: playerName,
        playerName,
        cash,
        luxuries,
        rep,
        career,
        credit,
        debt,
        curveballs,
        shadyDebt,
        investments,
      });

      console.log('✅ AI summary received:', { summary: summary?.substring(0, 50) + '...', archetype });

      // Clear local save
      clearSave();

      // Show final scoreboard with AI summary
      showFinal({
        playerName,
        avatar,
        cash,
        luxuries,
        rep,
        career,
        credit,
        debt,
        curveballs,
        shadyDebt,
        investments,
        summary: summary || 'Summary generation failed. Your game data is still shown below.',
        archetype: archetype || 'The Hot Shot',
        totalLaps,
      });

      addToast('Summary generated successfully!', 'success', 2000);
    } catch (error) {
      console.error('❌ Error generating AI summary:', error);
      addToast('Failed to generate summary. Showing results without AI analysis.', 'warning', 4000);
      
      // Still show final scoreboard even if AI summary fails
      clearSave();
      showFinal({
        playerName,
        avatar,
        cash,
        luxuries,
        rep,
        career,
        credit,
        debt,
        curveballs,
        shadyDebt,
        investments,
        summary: 'AI summary generation failed. Your game data is shown below.',
        archetype: 'The Hot Shot',
        totalLaps,
      });
    } finally {
      setIsGeneratingSummary(false);
    }
  };

  // =====================================================
  // RENDER
  // =====================================================

  return (
    <div
      className="min-h-screen bg-no-repeat bg-center bg-[length:100%_auto] sm:bg-cover"
      style={{ backgroundImage: "url('/moneyBG.png')" }}
    >
      {/* Toast Notifications */}
      {roomInfo && <ToastContainer toasts={toasts} onRemove={removeToast} />}
      
      <div className="max-w-md mx-auto px-4 py-6 space-y-6 bg-white/80 rounded-xl shadow-xl">
        
        {/* Connection Status Indicator */}
        {roomInfo && (
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
        )}

        {/* 💥 ROOM HUD DISPLAYED ONLY IN MULTIPLAYER */}
        {roomInfo && (
          <>
            <RoomHUD
              roomPlayers={roomPlayers}
              currentPlayerId={currentPlayerId}
              roomStatus={roomStatus}
            />
            {/* LEAVE ROOM BUTTON */}
            <div className="bg-white rounded-xl shadow-md p-4">
              <button
                onClick={async () => {
                  if (window.confirm("Are you sure you want to leave the room? Your progress will be saved.")) {
                    const res = await leaveRoomRequest(roomId, currentPlayerId);
                    if (res?.error) {
                      console.error("❌ Leave room error:", res.error);
                      alert("Failed to leave room: " + res.error);
                    } else {
                      // Clear local save for this room
                      clearSave();
                      onLeaveRoom?.();
                    }
                  }
                }}
                className="w-full bg-red-500 text-white py-2 rounded-lg hover:bg-red-600 transition"
              >
                Leave Room
              </button>
            </div>
          </>
        )}

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
          showFinal={handleEndGame}
          playerSnapshot={{ playerName, cash, luxuries, rep, career, debt, credit, curveballs, shadyDebt }}
        />

        <CashTracker cash={cash} setCash={setCash} />

        <CardSelector onSelect={handleCardSelection} />

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
          shadyDebt={shadyDebt}
          investments={investments}
          showFinal={handleEndGame}
          isGeneratingSummary={isGeneratingSummary}
        />
      </div>
    </div>
  );
}

export default PlayerDashboard;
