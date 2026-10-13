import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { 
  FaTrophy, FaUser, FaBolt,
  FaCreditCard, FaGem, FaChartLine,
  FaStar, FaIdCard, FaTh, FaHome
} from 'react-icons/fa';
import CatalogMenu from './CatalogMenu';
import HoldingsPanel from './HoldingsPanel';
import LuxuryHoldings from './LuxuryHoldings';
import NilPanel from './NilPanel';

import TurnTracker from './TurnTracker';
import CashTracker from './CashTracker';
import CashEntry from './CashEntry';
import FinancePanel from './FinancePanel';
import CurveballSection from './CurveballSection';
import RepCareerPoints from './RepCareerPoints';
import FinalNetWorth from './FinalNetWorth';
import PurpleTab from './PurpleTab';

import { fetchAiSummary } from '../utils/fetchAiSummary';
import { supabase, isSupabaseConfigured } from '../utils/supabaseClient';
import { selectCoachJBoWinner } from '../utils/coachJBo';
import RoomHUD from "./RoomHUD";
import ToastContainer from "./ToastContainer";
import { leaveRoom as leaveRoomRequest } from '../utils/roomApi';
import { rollDice, randomPick } from '../utils/dice';
import useLedger from '../hooks/useLedger';
import {
  createLedger, completedLaps, totalBorrowing, taxesOwed, inFinalWindow, newOpId,
} from '../rules/ledger';
import { scoreBreakdown } from '../rules/portfolio';
import { holdingsValue, unusedPlanUses } from '../rules/holdings';
import { investmentsView, luxuriesView } from '../rules/views';
import { YELLOW_COPY, unusedTokens, TOKEN_EXCLUDED } from '../rules/nil';
import { formatCents, fromCents, toCents } from '../rules/money';
import { RULESET_ID, SAVE_PREFIX } from '../rules';

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
  const totalLaps = initialTotalLaps || 5;

  // Cash, Tax Bucket, loans, taxes, credit and the lap clock live in the finance ledger.
  // `cash`, `debt`, `credit` and `laps` below are read-only views of it.
  const { ledger, run, replace: replaceLedger, setCash, current: ledgerRef } = useLedger(() =>
    createLedger({ openingCash: toCents(startingCash || 0), totalLaps })
  );
  const cash = fromCents(ledger.cash);
  const credit = ledger.creditScore;
  const laps = completedLaps(ledger);
  const debt = fromCents(totalBorrowing(ledger));
  const [rep, setRep] = useState(0);
  const [career, setCareer] = useState(0);
  const [curveballs, setCurveballs] = useState([]);
  // Read-only views of ledger holdings for room sync, Coach J-Bo and the AI summary.
  const investments = useMemo(() => investmentsView(ledger), [ledger]);
  const luxuries = useMemo(() => luxuriesView(ledger), [ledger]);
  const [shadyDebt, setShadyDebt] = useState(0);
  const [redCurveballLoss, setRedCurveballLoss] = useState(0); // Financial curveball losses
  const [blueCurveballLoss, setBlueCurveballLoss] = useState(0); // Life curveball losses
  const [lossAvoided, setLossAvoided] = useState(0); // Total losses avoided through protection
  
  // REP & Career System State
  const [balanceBonusAwarded, setBalanceBonusAwarded] = useState(false);
  const [careerThresholdsUnlocked, setCareerThresholdsUnlocked] = useState([]);
  const [repThresholdsUnlocked, setRepThresholdsUnlocked] = useState([]);

  // =====================================================
  // REP & CAREER SYSTEM FUNCTIONS
  // =====================================================
  
  // Check Career thresholds
  const checkCareerThresholds = () => {
    const thresholds = [
      { points: 10, bonus: () => addToast('📈 Career Threshold: +5% NIL payout unlocked!', 'success', 4000) },
      { points: 25, bonus: () => addToast('🛡️ Career Threshold: Reduce one negative investment roll by 5%!', 'success', 4000) },
      { points: 40, bonus: () => addToast('📈 Career Threshold: +10% NIL payout unlocked!', 'success', 4000) },
      { points: 60, bonus: () => addToast('⭐ Career Threshold: Elite Professional status unlocked!', 'success', 4000) }
    ];

    thresholds.forEach(threshold => {
      if (career >= threshold.points && !careerThresholdsUnlocked.includes(threshold.points)) {
        setCareerThresholdsUnlocked(prev => [...prev, threshold.points]);
        threshold.bonus();
      }
    });
  };

  // Check REP thresholds
  const checkRepThresholds = () => {
    const thresholds = [
      { points: 10, bonus: () => addToast('🌟 REP Threshold: +5% brand-related ROI unlocked!', 'success', 4000) },
      { points: 25, bonus: () => addToast('🛡️ REP Threshold: Reduce one curveball penalty by 25%!', 'success', 4000) },
      { points: 40, bonus: () => addToast('🌟 REP Threshold: +10% sponsorship payout unlocked!', 'success', 4000) },
      { points: 60, bonus: () => addToast('⭐ REP Threshold: Market Icon status unlocked!', 'success', 4000) }
    ];

    thresholds.forEach(threshold => {
      if (rep >= threshold.points && !repThresholdsUnlocked.includes(threshold.points)) {
        setRepThresholdsUnlocked(prev => [...prev, threshold.points]);
        threshold.bonus();
      }
    });
  };

  // Check Balance Bonus
  const checkBalanceBonus = () => {
    if (balanceBonusAwarded) return;
    
    const repCareerDiff = Math.abs(rep - career);
    if (repCareerDiff <= 10 && rep >= 20 && career >= 20) {
      setBalanceBonusAwarded(true);
      setCash(prev => prev + 250000, 'Balance Bonus');
      addToast('⚖️ Balance Bonus! +$250,000 + 5% ROI boost to one investment!', 'success', 5000);
    }
  };

  // Check all thresholds and bonuses (call after REP/Career changes)
  // Note: This function reads from state directly, so we don't need it in dependencies
  const checkAllThresholds = () => {
    checkCareerThresholds();
    checkRepThresholds();
    checkBalanceBonus();
  };

  // Handle purple tab event selection
  const handlePurpleEvent = (event) => {
    setRep(prev => prev + event.rep);
    setCareer(prev => prev + event.career);
    setTimeout(() => checkAllThresholds(), 100);
  };

  // Holds all players in multiplayer room
  const [roomPlayers, setRoomPlayers] = useState({});
  const [roomStatus, setRoomStatus] = useState(roomInfo?.status || "lobby");
  const roomId = roomInfo?.roomId;

  // Tab navigation state
  const [activeTab, setActiveTab] = useState('home');
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

  // Handle curveball loss tracking
  const handleCurveballLoss = (type, amount) => {
    if (type === 'red') {
      setRedCurveballLoss((prev) => prev + amount);
    } else if (type === 'blue') {
      setBlueCurveballLoss((prev) => prev + amount);
    }
  };

  // Handle loss avoidance tracking
  const handleLossAvoided = (amount) => {
    setLossAvoided((prev) => prev + amount);
    addToast(`🛡️ Protection activated! Loss avoided: $${amount.toLocaleString()}`, 'success', 4000);
  };

  // Reconnection tracking (no UI shown to user)
  const [reconnectTrigger, setReconnectTrigger] = useState(0);
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimeoutRef = useRef(null);
  const channelRef = useRef(null);

  // =====================================================
  // AUTOSAVE / AUTOLOAD
  // =====================================================
  const restoringRef = useRef(false);
  const saveKey = `${SAVE_PREFIX}${playerName || 'Player'}`;

  useEffect(() => {
    const saved = localStorage.getItem(saveKey);
    if (!saved) return;

    try {
      const s = JSON.parse(saved);
      restoringRef.current = true;

      if (s.finance && s.finance.rulesetId === RULESET_ID) replaceLedger(s.finance);
      if (typeof s.rep === 'number') setRep(s.rep);
      if (typeof s.career === 'number') setCareer(s.career);
      if (Array.isArray(s.curveballs)) setCurveballs(s.curveballs);
      if (typeof s.shadyDebt === 'number') setShadyDebt(s.shadyDebt);
      if (typeof s.redCurveballLoss === 'number') setRedCurveballLoss(s.redCurveballLoss);
      if (typeof s.blueCurveballLoss === 'number') setBlueCurveballLoss(s.blueCurveballLoss);
      if (typeof s.lossAvoided === 'number') setLossAvoided(s.lossAvoided);
      if (typeof s.balanceBonusAwarded === 'boolean') setBalanceBonusAwarded(s.balanceBonusAwarded);
      if (Array.isArray(s.careerThresholdsUnlocked)) setCareerThresholdsUnlocked(s.careerThresholdsUnlocked);
      if (Array.isArray(s.repThresholdsUnlocked)) setRepThresholdsUnlocked(s.repThresholdsUnlocked);

    } catch (e) {
      console.error('Failed to parse saved game:', e);
    } finally {
      setTimeout(() => {
        restoringRef.current = false;
      }, 0);
    }
  }, [saveKey, replaceLedger]);

  useEffect(() => {
    if (restoringRef.current) return;

    const snapshot = {
      rulesetId: RULESET_ID,
      playerName,
      avatar,
      cash,
      finance: ledger,
      rep,
      career,
      curveballs,
      shadyDebt,
      redCurveballLoss,
      blueCurveballLoss,
      lossAvoided,
      balanceBonusAwarded,
      careerThresholdsUnlocked,
      repThresholdsUnlocked,
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
    avatar,
    cash,
    ledger,
    rep,
    career,
    curveballs,
    shadyDebt,
    redCurveballLoss,
    blueCurveballLoss,
    lossAvoided,
    balanceBonusAwarded,
    careerThresholdsUnlocked,
    repThresholdsUnlocked,
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
    if (reconnectAttemptsRef.current >= 5) return;

    reconnectAttemptsRef.current += 1;
    const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current - 1), 30000);

    reconnectTimeoutRef.current = setTimeout(() => {
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
          reconnectAttemptsRef.current = 0;
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
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

  const syncToRoomInternal = useCallback(async (partial, isHeartbeat = false, showErrors = true) => {
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
  }, [roomInfo]);

  const syncToRoom = useCallback(async (partial, isHeartbeat = false) => {
    return await syncToRoomInternal(partial, isHeartbeat, true);
  }, [syncToRoomInternal]);
  

  // Room rows carry whole dollars: cash = Available Cash + Tax Bucket, debt = borrowing + unpaid taxes.
  const syncedCash = Math.round(fromCents(ledger.cash + ledger.taxBucket));
  const syncedDebt = Math.round(fromCents(totalBorrowing(ledger) + taxesOwed(ledger)));
  useEffect(() => { if (roomId && currentPlayerId) syncToRoom({ cash: syncedCash }); }, [syncedCash, roomId, currentPlayerId, syncToRoom]);
  useEffect(() => { if (roomId && currentPlayerId) syncToRoom({ debt: syncedDebt }); }, [syncedDebt, roomId, currentPlayerId, syncToRoom]);
  useEffect(() => { if (roomId && currentPlayerId) syncToRoom({ credit }); }, [credit, roomId, currentPlayerId, syncToRoom]);
  useEffect(() => { if (roomId && currentPlayerId) syncToRoom({ rep }); }, [rep, roomId, currentPlayerId, syncToRoom]);
  useEffect(() => { if (roomId && currentPlayerId) syncToRoom({ laps }); }, [laps, roomId, currentPlayerId, syncToRoom]);
  useEffect(() => { if (roomId && currentPlayerId) syncToRoom({ redCurveballLoss }); }, [redCurveballLoss, roomId, currentPlayerId, syncToRoom]);
  useEffect(() => { if (roomId && currentPlayerId) syncToRoom({ blueCurveballLoss }); }, [blueCurveballLoss, roomId, currentPlayerId, syncToRoom]);

  // Views are rebuilt on every ledger change; sync only when their content changes.
  const luxuriesJson = JSON.stringify(luxuries);
  const investmentsJson = JSON.stringify(investments);
  useEffect(() => {
    if (roomId && currentPlayerId) {
      syncToRoom({ luxuries: JSON.parse(luxuriesJson) });
    }
  }, [luxuriesJson, roomId, currentPlayerId, syncToRoom]);

  useEffect(() => {
    if (roomId && currentPlayerId) {
      syncToRoom({ investments: JSON.parse(investmentsJson) });
    }
  }, [investmentsJson, roomId, currentPlayerId, syncToRoom]);

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
  }, [roomId, currentPlayerId, syncToRoom]);

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

  // Switch to Profile tab when lap counter hits 100% so player can end the game
  useEffect(() => {
    if (totalLaps > 0 && laps >= totalLaps) {
      setActiveTab('profile');
    }
  }, [laps, totalLaps]);

  // Check thresholds when REP or Career change
  useEffect(() => {
    checkAllThresholds();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rep, career]);

  // Rate limiting: Track last purchase time
  const lastPurchaseTimeRef = useRef(0);
  const RATE_LIMIT_MS = 2000; // 2 seconds between purchases

  /** Apply REP / Career that a ledger result awarded (luxury families, Youth Sports, events). */
  const applyPoints = (result) => {
    if (result && result.rep > 0) setRep(prev => prev + result.rep);
    if (result && result.career > 0) setCareer(prev => prev + result.career);
  };

  /**
   * Run a ledger operation from a button; toast the outcome. Returns true on success.
   * `format` builds the success message from the result when it depends on it.
   */
  const act = (type, payload, successMessage, format) => {
    try {
      const result = run(type, payload);
      applyPoints(result);
      const message = format ? format(result) : successMessage;
      if (message) addToast(message, 'success', 3500);
      return true;
    } catch (e) {
      addToast(e.message, 'error', 4000);
      return false;
    }
  };

  /** Buy from the green or diamond menu; the receipt explains exactly what happened. */
  const handleAcquire = (payload) => {
    const now = Date.now();
    if (now - lastPurchaseTimeRef.current < RATE_LIMIT_MS) {
      addToast('Please wait a moment before making another purchase.', 'warning', 2500);
      return false;
    }
    let r;
    try {
      r = run('acquire', { ...payload, assetId: newOpId('asset') });
    } catch (e) {
      addToast(e.message, 'error', 4000);
      return false;
    }
    lastPurchaseTimeRef.current = now;
    applyPoints(r);
    const title = ledgerRef.current.purchases[ledgerRef.current.purchases.length - 1]?.title || 'Purchase';
    const parts = [];
    if (r.receipts !== undefined) parts.push(`receipts ${formatCents(r.receipts)} (${r.profit >= 0 ? 'profit' : 'loss'} ${formatCents(Math.abs(r.profit))})`);
    if (r.value !== undefined) parts.push(r.failed ? 'launch failed: value $0' : `value ${formatCents(r.value)}`);
    if (r.borrowed > 0) parts.push(`${formatCents(r.borrowed)} financed`);
    if (r.rep > 0) parts.push(`+${r.rep} REP`);
    if (r.career > 0) parts.push(`+${r.career} Career`);
    addToast(`${title}${r.face ? ` (rolled ${r.face})` : ''}${parts.length ? `: ${parts.join(' · ')}` : ''}`, r.failed ? 'warning' : 'success', 5000);
    return true;
  };

  /** The player's own roll: settles the last deadline, moves, and closes any crossed lap. */
  const handleRoll = (steps, diceCount) => {
    let r;
    try {
      // Market positions get one fair roll per full owned lap; the app rolls and stores them.
      r = run('roll', { steps, diceCount, draws: rollDice(60), pick: randomPick() });
    } catch (e) {
      addToast(e.message, 'error', 4000);
      return;
    }
    if (r.checkpoint && r.checkpoint.before !== r.checkpoint.after) {
      const change = r.checkpoint.after - r.checkpoint.before;
      addToast(
        `Lap ${r.checkpoint.lap} payments ${r.checkpoint.current ? 'on time' : 'missed'}: credit ${change > 0 ? '+' : ''}${change} → ${r.checkpoint.after}`,
        r.checkpoint.current ? 'success' : 'warning',
        4000
      );
    }
    if (r.checkpoint && r.checkpoint.taxLate > 0) {
      addToast(`Lap ${r.checkpoint.lap} tax unpaid: late charge ${formatCents(r.checkpoint.taxLate)}`, 'warning', 4000);
    }
    r.events.forEach(ev => {
      if (ev.type === 'annuity_payment') {
        addToast(`Annuity payment received: ${formatCents(ev.payment)} (${formatCents(ev.earnings)} earnings)`, 'success', 4000);
      } else if (ev.type === 'market_draw') {
        addToast(`${ev.title}: market roll ${ev.face} (${ev.bps > 0 ? '+' : ''}${ev.bps / 100}%) → ${formatCents(ev.after)}`, ev.bps < 0 ? 'warning' : 'info', 4000);
      } else if (ev.type === 'policy_lapsed') {
        addToast(`${ev.title} lapsed: its loan used up the cash value.`, 'warning', 5000);
      }
    });
    r.closedLaps.forEach(closed => {
      const parts = [`+${formatCents(closed.award)} lap award`];
      const due = closed.interestPosted + closed.principalDue;
      if (due > 0) parts.push(`${formatCents(due)} debt payment posted`);
      if (closed.taxBill > 0) parts.push(`${formatCents(closed.taxBill)} tax bill`);
      if (closed.careDue > 0) parts.push('companion care due');
      addToast(`Lap ${closed.lap} complete: ${parts.join(' · ')}`, 'success', 5000);
    });
    r.missedTasks.forEach(t => addToast(`Task missed: ${t.label}. The extra payment is forgone; nothing else changes.`, 'info', 4000));
    if (r.yellow) {
      const y = r.yellow;
      if (y.status === 'clear') addToast('Yellow space: all clear this turn.', 'info', 3000);
      else addToast(`⭐ ${YELLOW_COPY[y.cardId]?.benefit}: ${ledgerRef.current.yellowHistory.find(h => h.turn === y.turn)?.title || 'NIL opportunity'} — see Home`, 'success', 4000);
    }
    if (r.final) addToast('Final lap reached. Settle up in Finance, then Finish & Reveal.', 'info', 5000);
  };

  /**
   * A legacy curveball cash expense. If the player holds an eligible Legal or Health Support
   * use, offer it on the eligible component only (80%, capped); the rest is still paid.
   */
  const handleCurveballExpense = ({ amount, desc, legalFee = 0, healthFee = 0 }) => {
    const s = ledgerRef.current;
    const offer = (plan, fee, bps, cap) => {
      const uses = unusedPlanUses(s, plan);
      if (!(fee > 0) || uses === 0) return false;
      const help = Math.min(cap, Math.round((Math.min(fee, amount) * bps) / 10000));
      return window.confirm(
        `Use ${plan === 'legal' ? 'Legal' : 'Health'} Support on "${desc}"?\n\n` +
        `It pays ${formatCents(help)} of the ${formatCents(Math.min(fee, amount))} ${plan === 'legal' ? 'legal fees' : 'health expense'}. ` +
        `You pay ${formatCents(amount - help)}. Uses left after: ${uses - 1}.\n\nCancel to pay it all and keep the use.`
      );
    };
    const useLegal = offer('legal', legalFee, 8000, 2500000);
    const useHealth = !useLegal && offer('health', healthFee, 8000, 2000000);
    // The Emergency Fund pays last, on the remaining mandatory expense (never taxes, debt or market losses).
    const helped = useLegal ? Math.min(2500000, Math.round(Math.min(legalFee, amount) * 0.8))
      : useHealth ? Math.min(2000000, Math.round(Math.min(healthFee, amount) * 0.8)) : 0;
    const remaining = amount - helped;
    const useToken = unusedTokens(s) > 0 && remaining > 0 && !TOKEN_EXCLUDED.some(x => desc.startsWith(x)) &&
      window.confirm(`Use your Emergency Fund on "${desc}"? It pays ${formatCents(Math.min(2500000, remaining))} of the remaining ${formatCents(remaining)}. It can be used once.`);
    try {
      return run('legacy_expense', { amount, label: desc, legalFee, healthFee, useLegal, useHealth, useToken });
    } catch (e) {
      addToast(e.message, 'error', 4000);
      return null;
    }
  };

  // Manual money entry (home screen)
  const handleIncome = (amount, setAside, label) =>
    act('income', { amount, taxClass: 'nil', setAside, label },
      `+${formatCents(amount)} NIL income${setAside > 0 ? ` (${formatCents(setAside)} to Tax Bucket)` : ''}`);
  const handleOtherIncome = (amount, label) =>
    act('adjust_cash', { amount, label }, `+${formatCents(amount)} added`);
  const handleSpend = (amount, label) => {
    const ok = act('adjust_cash', { amount: -amount, label }, `-${formatCents(amount)} spent`);
    if (ok && ledgerRef.current.cash < 0) {
      addToast('Your Available Cash is below zero. Sell an asset or add income to recover.', 'warning', 4000);
    }
    return ok;
  };

  // Live portfolio and game value (frozen into the snapshot at Finish & Reveal)
  const liveScore = scoreBreakdown({
    cash: ledger.cash,
    taxBucket: ledger.taxBucket,
    ...holdingsValue(ledger),
    ordinaryDebt: totalBorrowing(ledger),
    taxesOwed: taxesOwed(ledger),
    otherLiabilities: toCents(shadyDebt || 0),
    rep,
    career,
    creditScore: ledger.creditScore,
  });

  // Track if AI summary is being generated to prevent duplicate calls
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);

  const handleEndGame = async () => {
    // Prevent multiple simultaneous calls
    if (isGeneratingSummary) {
      addToast('Generating your summary, please wait...', 'info', 2000);
      return;
    }

    const early = !inFinalWindow(ledgerRef.current) && !ledgerRef.current.snapshot;
    const warning = early
      ? `You have not reached lap ${totalLaps} yet. Finish now? Your result will be locked and no more laps will count.`
      : 'Finish & Reveal locks your result. Unpaid debt and taxes are counted against your final value. Continue?';
    if (!ledgerRef.current.snapshot && !window.confirm(warning)) return;

    // Freeze the financial result once; later calls return the same snapshot.
    const snapshot = run('finish', {
      external: {
        otherLiabilities: toCents(shadyDebt || 0),
        rep,
        career,
      },
    });
    const finalCash = fromCents(snapshot.cash);
    const finalDebt = fromCents(snapshot.ordinaryDebt);
    const finalCredit = snapshot.creditScore;

    setIsGeneratingSummary(true);
    addToast('Generating your AI summary...', 'info', 3000);

    // Coach JBo: only in multiplayer with 4+ players
    const coachJBoCheck = () => {
      if (!(roomInfo && currentPlayerId && Object.keys(roomPlayers).length >= 4)) return false;
      const merged = { ...roomPlayers };
      merged[currentPlayerId] = {
        ...merged[currentPlayerId],
        player_id: currentPlayerId,
        name: playerName,
        cash: fromCents(snapshot.cash + snapshot.taxBucket),
        luxuries,
        rep,
        career,
        credit: finalCredit,
        debt: fromCents(snapshot.ordinaryDebt + snapshot.taxesOwed),
        shadyDebt,
        investments,
      };
      const result = selectCoachJBoWinner(merged);
      return Boolean(result && result.winnerPlayerId === currentPlayerId);
    };

    const basePayload = {
      playerName,
      avatar,
      cash: finalCash,
      taxBucket: fromCents(snapshot.taxBucket),
      taxesOwed: fromCents(snapshot.taxesOwed),
      luxuries,
      rep,
      career,
      credit: finalCredit,
      debt: finalDebt,
      curveballs,
      shadyDebt,
      investments,
      score: snapshot.score,
      totalLaps,
      balanceBonusAwarded,
    };

    try {
      console.log('🎯 Generating AI summary for:', playerName);
      
      const { summary, archetype } = await fetchAiSummary({
        name: playerName,
        playerName,
        cash: finalCash,
        luxuries,
        rep,
        career,
        credit: finalCredit,
        debt: finalDebt,
        curveballs,
        shadyDebt,
        investments,
      });

      console.log('✅ AI summary received:', { summary: summary?.substring(0, 50) + '...', archetype });

      clearSave();
      showFinal({
        ...basePayload,
        summary: summary || 'Summary generation failed. Your game data is still shown below.',
        archetype: archetype || 'The Hot Shot',
        coachJBoUnlocked: coachJBoCheck(),
      });
      addToast('Summary generated successfully!', 'success', 2000);
    } catch (error) {
      console.error('❌ Error generating AI summary:', error);
      addToast('Failed to generate summary. Showing results without AI analysis.', 'warning', 4000);

      clearSave();
      showFinal({
        ...basePayload,
        summary: 'AI summary generation failed. Your game data is shown below.',
        archetype: 'The Hot Shot',
        coachJBoUnlocked: coachJBoCheck(),
      });
    } finally {
      setIsGeneratingSummary(false);
    }
  };

  // =====================================================
  // RENDER
  // =====================================================

  const glassSection = 'rounded-2xl bg-white/20 backdrop-blur-lg border border-white/30 shadow-lg p-4 md:p-6';
  const displayYear =
    laps >= totalLaps ? totalLaps : Math.min(laps + 1, totalLaps);
  const primaryNavIds = ['home', 'invest', 'luxury', 'finance', 'curveballs'];
  const navItemActive = (id) => primaryNavIds.includes(activeTab) && activeTab === id;

  return (
    <div className="min-h-[100dvh] bg-gradient-to-br from-sky-400 via-blue-500 to-cyan-400">
      <ToastContainer toasts={toasts} onRemove={removeToast} />

      <div className="max-w-md mx-auto min-h-[100dvh] px-4 pt-4 pb-28">
        {/* Top bar */}
        <header className="flex items-start justify-between gap-3 mb-6">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-900/70">NIL Money Moves</p>
            <h1 className="text-xl font-bold text-slate-950 truncate mt-0.5">{playerName}</h1>
            <div className="flex flex-wrap items-center gap-2 mt-2">
              <span className="inline-flex items-center gap-1 rounded-full bg-white/35 backdrop-blur-md border border-white/40 px-3 py-1 text-xs font-semibold text-slate-900">
                <FaBolt className="text-amber-500 shrink-0" aria-hidden />
                {avatar}
              </span>
              <span className="text-xs font-medium text-slate-900/80 tabular-nums">
                Year {displayYear} of {totalLaps}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {roomInfo && (
              <button
                type="button"
                onClick={() => setActiveTab('leaderboard')}
                className={`p-2.5 rounded-2xl border transition ${
                  activeTab === 'leaderboard'
                    ? 'bg-white/40 border-white/50 text-slate-900 shadow-md'
                    : 'bg-white/20 border-white/30 text-slate-900 hover:bg-white/30'
                }`}
                aria-label="Leaderboard"
              >
                <FaTrophy className="text-lg text-amber-700" />
              </button>
            )}
            <button
              type="button"
              onClick={() => setActiveTab('profile')}
              className={`p-2.5 rounded-2xl border transition ${
                activeTab === 'profile'
                  ? 'bg-white/40 border-white/50 text-slate-900 shadow-md'
                  : 'bg-white/20 border-white/30 text-slate-900 hover:bg-white/30'
              }`}
              aria-label="Profile"
            >
              <FaUser className="text-lg text-slate-800" />
            </button>
          </div>
        </header>

        <div className="space-y-4 md:space-y-6">
          {activeTab === 'home' && (
            <>
              {/* Hero — cash */}
              <div
                className={`${glassSection} relative overflow-hidden bg-gradient-to-br from-emerald-100/50 via-white/25 to-teal-100/40`}
              >
                <div className="absolute inset-0 bg-gradient-to-tr from-green-400/10 to-transparent pointer-events-none" />
                <div className="relative">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-700/90 mb-1">Cash balance</p>
                  <div className="mb-4">
                    <CashTracker cash={cash} setCash={setCash} variant="amountOnly" />
                  </div>
                  <div className="grid grid-cols-3 gap-3 mb-5 text-sm">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">Credit score</p>
                      <p className="text-lg font-bold text-slate-900 tabular-nums">{credit}</p>
                    </div>
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">Tax Bucket</p>
                      <p className="text-lg font-bold text-slate-900 tabular-nums">{formatCents(ledger.taxBucket)}</p>
                    </div>
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-red-900/70">Borrowing</p>
                      <p className="text-lg font-bold text-red-900 tabular-nums">{formatCents(totalBorrowing(ledger))}</p>
                    </div>
                  </div>
                  {!ledger.snapshot && (
                    <CashEntry onIncome={handleIncome} onOther={handleOtherIncome} onSpend={handleSpend} />
                  )}
                </div>
              </div>

              {/* REP + Career */}
              <div className="grid grid-cols-2 gap-4">
                <div className={`${glassSection} flex flex-col items-center text-center`}>
                  <FaStar className="text-2xl text-amber-500 mb-2" aria-hidden />
                  <p className="text-2xl font-black text-slate-950 tabular-nums">{rep}</p>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-700 mt-1">REP</p>
                </div>
                <div className={`${glassSection} flex flex-col items-center text-center`}>
                  <FaChartLine className="text-2xl text-violet-600 mb-2" aria-hidden />
                  <p className="text-2xl font-black text-slate-950 tabular-nums">{career}</p>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-700 mt-1">Career</p>
                </div>
              </div>

              {/* Game progress */}
              <div className={glassSection}>
                <TurnTracker ledger={ledger} onRoll={handleRoll} onOpenTab={setActiveTab} />
              </div>

              {(ledger.yellow || ledger.tasks.length > 0 || unusedTokens(ledger) > 0) && (
                <div className={glassSection}>
                  <NilPanel ledger={ledger} act={act} />
                </div>
              )}

              {/* Quick actions grid */}
              <div className="grid grid-cols-2 gap-3">
                {[
                  { id: 'invest', label: 'Invest', icon: FaChartLine },
                  { id: 'luxury', label: 'Luxury', icon: FaGem },
                  { id: 'finance', label: 'Finance', icon: FaCreditCard },
                  { id: 'curveballs', label: 'Events', icon: FaBolt },
                ].map(({ id, label, icon: Icon }) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setActiveTab(id)}
                    className="rounded-2xl bg-white/20 backdrop-blur-lg border border-white/35 shadow-lg p-4 flex flex-col items-center gap-2 hover:bg-white/30 transition active:scale-[0.98]"
                  >
                    <Icon className="text-2xl text-slate-900" aria-hidden />
                    <span className="text-sm font-bold text-slate-900">{label}</span>
                  </button>
                ))}
              </div>

            </>
          )}

          {activeTab === 'invest' && (
            <>
              <div className={glassSection}>
                <div className="flex items-center gap-2 mb-4">
                  <FaTh className="text-xl text-slate-800" />
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-800">Investments</h3>
                </div>
                <CatalogMenu kind="investment" ledger={ledger} onAcquire={handleAcquire} />
              </div>

              <div className={glassSection}>
                <div className="flex items-center gap-2 mb-4">
                  <FaChartLine className="text-xl text-slate-800" />
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-800">Your portfolio</h3>
                </div>
                <HoldingsPanel ledger={ledger} act={act} />
              </div>
            </>
          )}

          {activeTab === 'luxury' && (
            <>
              <div className={glassSection}>
                <div className="flex items-center gap-2 mb-4">
                  <FaGem className="text-xl text-fuchsia-700" />
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-800">Lifestyle &amp; Luxury</h3>
                </div>
                <CatalogMenu kind="luxury" ledger={ledger} onAcquire={handleAcquire} />
              </div>

              <div className={glassSection}>
                <div className="flex items-center gap-2 mb-4">
                  <FaGem className="text-xl text-violet-700" />
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-800">Your lifestyle</h3>
                </div>
                <LuxuryHoldings ledger={ledger} act={act} />
              </div>
            </>
          )}

          {activeTab === 'finance' && (
            <div className={glassSection}>
              <div className="flex items-center gap-2 mb-4">
                <FaCreditCard className="text-xl text-violet-700" />
                <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-800">Finance</h3>
              </div>
              <FinancePanel ledger={ledger} act={act} />
            </div>
          )}

          {activeTab === 'curveballs' && (
            <>
              <div className={glassSection}>
                <div className="flex items-center gap-2 mb-4">
                  <FaBolt className="text-xl text-red-700" />
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-800">Events</h3>
                </div>
                <CurveballSection
                  curveballs={curveballs}
                  setCurveballs={setCurveballs}
                  setCash={setCash}
                  setRep={setRep}
                  setShadyDebt={setShadyDebt}
                  onCurveballLoss={handleCurveballLoss}
                  onLossAvoided={handleLossAvoided}
                  onExpense={handleCurveballExpense}
                  redCurveballLoss={redCurveballLoss}
                  blueCurveballLoss={blueCurveballLoss}
                />
              </div>

              <div className={glassSection}>
                <div className="flex items-center gap-2 mb-4">
                  <FaStar className="text-xl text-amber-600" />
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-800">REP &amp; career</h3>
                </div>
                <RepCareerPoints rep={rep} career={career} />
              </div>

              <div className={glassSection}>
                <PurpleTab onSelect={handlePurpleEvent} addToast={addToast} />
              </div>
            </>
          )}

          {roomInfo && activeTab === 'leaderboard' && (
            <>
              <div className={glassSection}>
                <RoomHUD
                  roomPlayers={roomPlayers}
                  currentPlayerId={currentPlayerId}
                  roomStatus={roomStatus}
                />
              </div>
              <div className={glassSection}>
                <button
                  type="button"
                  onClick={async () => {
                    if (
                      window.confirm(
                        'Are you sure you want to leave the room? Your progress will be saved.'
                      )
                    ) {
                      const res = await leaveRoomRequest(roomId, currentPlayerId);
                      if (res?.error) {
                        console.error('❌ Leave room error:', res.error);
                        alert('Failed to leave room: ' + res.error);
                      } else {
                        clearSave();
                        onLeaveRoom?.();
                      }
                    }
                  }}
                  className="w-full rounded-2xl bg-gradient-to-r from-red-500 to-rose-600 text-white py-3 font-semibold shadow-lg shadow-red-500/25 hover:from-red-600 hover:to-rose-700 transition"
                >
                  Leave room
                </button>
              </div>
            </>
          )}

          {activeTab === 'profile' && (
            <div className={glassSection}>
              <div className="flex items-center gap-2 mb-4">
                <FaIdCard className="text-xl text-indigo-800" />
                <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-800">Final game value</h3>
              </div>
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
                ledger={ledger}
                score={liveScore}
                finalWindow={inFinalWindow(ledger)}
                lossAvoided={lossAvoided}
                showFinal={handleEndGame}
                isGeneratingSummary={isGeneratingSummary}
              />
            </div>
          )}
        </div>
      </div>

      {/* Sticky bottom navigation */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-20 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2 px-4 bg-gradient-to-t from-sky-900/25 to-transparent pointer-events-none"
        aria-label="Main navigation"
      >
        <div className="max-w-md mx-auto pointer-events-auto rounded-2xl bg-white/25 backdrop-blur-xl border border-white/40 shadow-xl shadow-slate-900/10 px-1 py-2">
          <div className="flex justify-between items-stretch">
            {[
              { id: 'home', label: 'Home', Icon: FaHome },
              { id: 'invest', label: 'Invest', Icon: FaChartLine },
              { id: 'luxury', label: 'Luxury', Icon: FaGem },
              { id: 'finance', label: 'Finance', Icon: FaCreditCard },
              { id: 'curveballs', label: 'Events', Icon: FaBolt },
            ].map(({ id, label, Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => setActiveTab(id)}
                className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-2 px-1 rounded-xl transition ${
                  navItemActive(id)
                    ? 'text-slate-950 bg-white/45 shadow-md'
                    : 'text-slate-800/85 hover:bg-white/25'
                }`}
              >
                <Icon className={`text-lg ${navItemActive(id) ? 'text-emerald-700' : ''}`} aria-hidden />
                <span className="text-[10px] font-bold leading-tight">{label}</span>
              </button>
            ))}
          </div>
        </div>
      </nav>
    </div>
  );
}

export default PlayerDashboard;
