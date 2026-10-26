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
import VenturePanel from './VenturePanel';
import CareerPanel, { CareerRecord } from './CareerPanel';

import TurnTracker from './TurnTracker';
import CashTracker from './CashTracker';
import CashEntry from './CashEntry';
import FinancePanel from './FinancePanel';
import ScenarioPanel, { ScenarioHistory } from './ScenarioPanel';
import RepCareerPoints from './RepCareerPoints';
import FinalNetWorth from './FinalNetWorth';

import { fetchAiSummary } from '../utils/fetchAiSummary';
import { supabase, isSupabaseConfigured } from '../utils/supabaseClient';
import { selectCoachJBoWinner } from '../utils/coachJBo';
import RoomHUD from "./RoomHUD";
import ToastContainer from "./ToastContainer";
import { leaveRoom as leaveRoomRequest, rejoinRoom } from '../utils/roomApi';
import { getServerSave, newerSave, putServerSave } from '../utils/saveApi';
import { rollDice, randomPick } from '../utils/dice';
import useLedger from '../hooks/useLedger';
import {
  createLedger, completedLaps, currentYear, totalBorrowing, taxesOwed, inFinalWindow, newOpId, eventLiabilities, displayRep,
  founderVenture, ventureBuyStatus,
} from '../rules/ledger';
import {
  publishVenture, listUnits, buyUnits, markApplied, freezeStake, loadRoomVentures, subscribeRoomVentures,
} from '../utils/ventureApi';
import { assetValue as holdingValue } from '../rules/holdings';
import { scoreBreakdown } from '../rules/portfolio';
import { holdingsValue } from '../rules/holdings';
import { investmentsView, luxuriesView } from '../rules/views';
import { YELLOW_COPY, unusedTokens } from '../rules/nil';
import { revealTitle, nextTimeSuggestion, PROFILE_COPY } from '../rules/reveal';
import { NIL_VALUATION_HELP } from '../data/tiers';
import { formatCents, fromCents, toCents } from '../rules/money';
import { RULESET_ID, SAVE_PREFIX } from '../rules';

function PlayerDashboard({
  playerName,
  avatar,
  startingCash,
  showFinal,
  totalLaps: initialTotalLaps,
  nilTierId = null,
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
    createLedger({ openingCash: toCents(startingCash || 0), totalLaps, nilTierId })
  );
  const cash = fromCents(ledger.cash);
  const credit = ledger.creditScore;
  const laps = completedLaps(ledger);
  const debt = fromCents(totalBorrowing(ledger));
  // REP / Career live in the ledger (display REP is floored at zero).
  const rep = displayRep(ledger);
  const career = ledger.points.career;
  // Curveball history in the shape the summary, reveal and room rows already use.
  const curveballs = useMemo(
    () => ledger.scenarioHistory.map(h => ({
      desc: h.title,
      type: h.color,
      amount: Math.max(0, -h.cashDelta) / 100,
      assisted: h.assistance / 100,
      blocked: false,
    })),
    [ledger]
  );
  const redCurveballLoss = curveballs.filter(c => c.type === 'red').reduce((t, c) => t + c.amount, 0);
  const blueCurveballLoss = curveballs.filter(c => c.type === 'blue').reduce((t, c) => t + c.amount, 0);
  const lossAvoided = curveballs.reduce((t, c) => t + c.assisted, 0);
  // Read-only views of ledger holdings for room sync, Coach J-Bo and the AI summary.
  const investments = useMemo(() => investmentsView(ledger), [ledger]);
  const luxuries = useMemo(() => luxuriesView(ledger), [ledger]);
  
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

  // Reconnection tracking (no UI shown to user)
  const [reconnectTrigger, setReconnectTrigger] = useState(0);
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimeoutRef = useRef(null);
  const channelRef = useRef(null);
  const loadPlayersRef = useRef(() => {});
  const pushFullStateRef = useRef(() => {});
  // Connection state shown to the player: true while changes wait to reach the group.
  const [syncPending, setSyncPending] = useState(false);
  const [seatError, setSeatError] = useState('');

  // =====================================================
  // AUTOSAVE / AUTOLOAD
  // =====================================================
  const restoringRef = useRef(false);
  // A group seat has its own save so it never mixes with an offline game under the same name.
  const saveKey = roomId && currentPlayerId
    ? `${SAVE_PREFIX}room_${roomId}_${currentPlayerId}`
    : `${SAVE_PREFIX}${playerName || 'Player'}`;

  // Restore the furthest-along copy of this game: this device's save, or the server copy a
  // rejoin from another device brought back (Fix Log v1.2 #5).
  useEffect(() => {
    let local = null;
    try {
      const saved = localStorage.getItem(saveKey);
      if (saved) local = JSON.parse(saved).finance || null;
    } catch (e) {
      console.error('Failed to parse saved game:', e);
    }
    const valid = (f) => (f && f.rulesetId === RULESET_ID ? f : null);
    const best = newerSave(valid(local), valid(roomInfo?.serverSave));
    if (!best) return;
    restoringRef.current = true;
    replaceLedger(best);
    setTimeout(() => {
      restoringRef.current = false;
    }, 0);
    // roomInfo.serverSave is read once when the seat opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saveKey, replaceLedger]);

  useEffect(() => {
    if (restoringRef.current) return;

    const snapshot = {
      rulesetId: RULESET_ID,
      playerName,
      avatar,
      cash,
      finance: ledger,
      totalLaps,
      savedAt: Date.now(),
      // Group seat to return to after a refresh or going offline (Fix Log v1.2 #3).
      room: roomId && currentPlayerId ? {
        roomId,
        code: roomInfo?.code || null,
        playerId: currentPlayerId,
        name: playerName,
        avatar,
        hostPlayerId: roomInfo?.hostPlayerId || null,
        isHost: !!roomInfo?.isHost,
        startingCash,
        nilTierId: nilTierId || null,
        totalLaps,
      } : null,
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
    totalLaps,
    roomId,
    currentPlayerId,
    roomInfo,
    startingCash,
    nilTierId,
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

    loadPlayersRef.current = loadPlayers;
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
    // Keep trying for as long as the player is in the game; the delay caps at 30 seconds.
    if (reconnectTimeoutRef.current) return;

    reconnectAttemptsRef.current += 1;
    const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current - 1), 30000);

    reconnectTimeoutRef.current = setTimeout(() => {
      reconnectTimeoutRef.current = null;
      // Re-subscribing (the effect cleanup closes the old channel) by incrementing trigger
      setReconnectTrigger(prev => prev + 1);
    }, delay);
  };

  // Listen for realtime updates with reconnection
  useEffect(() => {
    if (!roomId || !isSupabaseConfigured) return;
    let active = true; // closing this channel ourselves is not a dropped connection

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
        if (!active) return;
        channelRef.current = channel;
        
        if (status === "SUBSCRIBED") {
          reconnectAttemptsRef.current = 0;
          // Back in sync with the group: reload everyone and resend this player's full row.
          loadPlayersRef.current();
          pushFullStateRef.current();
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
          attemptReconnect.current();
        }
      });

    return () => {
      console.log("🟠 Unsubscribing:", roomId);
      active = false;
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
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

  // Changes that have not reached the group yet, merged field by field (newest value wins).
  // They are retried until they land, so going offline never loses a change.
  const pendingSyncRef = useRef({});
  const retryTimerRef = useRef(null);
  const retryDelayRef = useRef(2000);
  const flushPending = useRef(() => {});

  const queueRetry = () => {
    setSyncPending(true);
    if (retryTimerRef.current) return;
    retryTimerRef.current = setTimeout(() => {
      retryTimerRef.current = null;
      flushPending.current();
    }, retryDelayRef.current);
    retryDelayRef.current = Math.min(retryDelayRef.current * 2, 30000);
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
      if (showErrors && !isHeartbeat) pendingSyncRef.current = { ...pendingSyncRef.current, ...partial };
      queueRetry();
      return false;
    }

    if (showErrors && Object.keys(pendingSyncRef.current).length) flushPending.current();
    return true;
    // queueRetry only touches refs and a state setter.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomInfo]);

  flushPending.current = async () => {
    const batch = pendingSyncRef.current;
    pendingSyncRef.current = {};
    const ok = await syncToRoomInternal(batch, true, false);
    if (!ok) {
      pendingSyncRef.current = { ...batch, ...pendingSyncRef.current };
    } else if (!Object.keys(pendingSyncRef.current).length) {
      retryDelayRef.current = 2000;
      setSyncPending(false);
    }
  };

  const syncToRoom = useCallback(async (partial, isHeartbeat = false) => {
    return await syncToRoomInternal(partial, isHeartbeat, true);
  }, [syncToRoomInternal]);
  

  // Room rows carry whole dollars: cash = Available Cash + Tax Bucket, debt = borrowing + unpaid taxes + event bills.
  const syncedCash = Math.round(fromCents(ledger.cash + ledger.taxBucket));
  const syncedDebt = Math.round(fromCents(totalBorrowing(ledger) + taxesOwed(ledger) + eventLiabilities(ledger)));
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

  // Whole row, resent after every reconnect so the group sees this player's latest state.
  pushFullStateRef.current = () => {
    if (!roomId || !currentPlayerId) return;
    syncToRoom({
      cash: syncedCash, debt: syncedDebt, credit, rep, laps, redCurveballLoss, blueCurveballLoss,
      luxuries: JSON.parse(luxuriesJson), investments: JSON.parse(investmentsJson),
    });
  };
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
  // SHARED SPORTS COMPLEX: cap table, listings and transfers (multiplayer)
  // =====================================================
  const [ventures, setVentures] = useState([]);
  const [ventureTransfers, setVentureTransfers] = useState([]);
  const reloadVentures = useCallback(async () => {
    if (!roomId) return;
    const r = await loadRoomVentures(roomId);
    setVentures(r.ventures);
    setVentureTransfers(r.transfers);
  }, [roomId]);
  useEffect(() => {
    if (!roomId || !isSupabaseConfigured) return undefined;
    reloadVentures();
    return subscribeRoomVentures(roomId, reloadVentures);
  }, [roomId, reloadVentures]);

  // The founder's ledger is the company's clock and value; publish whenever they change.
  const founderPub = founderVenture(ledger);
  const founderPubKey = JSON.stringify(founderPub);
  useEffect(() => {
    if (!roomId || !currentPlayerId || !founderPubKey || founderPubKey === 'null') return;
    publishVenture(roomId, currentPlayerId, playerName, JSON.parse(founderPubKey)).then(r => {
      if (r.error) console.warn('venture publish:', r.error);
    });
  }, [founderPubKey, roomId, currentPlayerId, playerName]);

  // Apply my side of committed transfers exactly once (op id = transfer id).
  useEffect(() => {
    if (!currentPlayerId || ledgerRef.current.snapshot) return;
    const me = String(currentPlayerId);
    ventureTransfers.forEach(t => {
      if (t.seller_id === me && !t.seller_applied) {
        try {
          const r = run('venture_settle_sale', { ventureId: t.venture_id, units: t.units, gross: t.gross_cents }, `sale-${t.id}`);
          addToast(`Sold ${t.units / 100}% of the complex to ${t.buyer_name || 'a player'}: +${formatCents(r.net)} after tax and loan payoff`, 'success', 5000);
          markApplied(t.id, me);
        } catch (e) {
          console.warn('venture sale apply:', e.message);
        }
      }
      if (t.buyer_id === me && !t.buyer_applied) {
        const v = ventures.find(x => x.id === t.venture_id);
        try {
          run('venture_buy', { ventureId: t.venture_id, units: t.units, gross: t.gross_cents, companyValue: t.company_value_cents, title: v ? v.title : 'Sports Complex' }, `buy-${t.id}`);
          markApplied(t.id, me);
        } catch (e) {
          console.warn('venture buy apply:', e.message);
        }
      }
    });
  }, [ventureTransfers, ventures, currentPlayerId, run, ledgerRef]);

  // Partners follow the founder's published company value.
  useEffect(() => {
    if (ledgerRef.current.snapshot) return;
    ventures.forEach(v => {
      const stake = ledgerRef.current.assets.find(a => a.holding === 'venture_stake' && a.ventureId === v.id && a.status === 'active');
      if (stake && (stake.companyValue !== Number(v.value_cents) || Boolean(stake.companyStopped) !== v.stopped)) {
        try {
          run('venture_sync', { ventureId: v.id, companyValue: Number(v.value_cents), stopped: v.stopped, failed: v.failed }, `vsync-${v.id}-${v.revision}`);
        } catch (e) {
          console.warn('venture sync:', e.message);
        }
      }
    });
  }, [ventures, run, ledgerRef]);

  const handleVentureBuy = async (v, sellerId, units) => {
    const gross = Math.round((Number(v.value_cents) * units) / 10000);
    const status = ventureBuyStatus(ledgerRef.current, { gross, sellerId, selfId: String(currentPlayerId), founderStopped: v.stopped });
    if (!status.ok) {
      addToast(status.reason, 'error', 4000);
      return;
    }
    const transferId = newOpId('vt');
    const r = await buyUnits({ ventureId: v.id, transferId, buyerId: currentPlayerId, buyerName: playerName, sellerId, units, revision: v.revision });
    if (r.error) {
      addToast(r.error === 'stale quote' ? 'The price changed. Check the new quote and try again.' : r.error, 'error', 4000);
      reloadVentures();
      return;
    }
    try {
      run('venture_buy', { ventureId: v.id, units, gross: Number(r.data.gross_cents), companyValue: Number(r.data.company_value_cents), title: v.title }, `buy-${transferId}`);
      markApplied(transferId, currentPlayerId);
      addToast(`You now own ${units / 100}% of ${v.title} (${formatCents(Number(r.data.gross_cents))})`, 'success', 5000);
    } catch (e) {
      addToast(e.message, 'error', 4000);
    }
    reloadVentures();
  };

  const handleVentureList = async (ventureId, units) => {
    const r = await listUnits(ventureId, currentPlayerId, units);
    if (r.error) addToast(r.error, 'error', 4000);
    else addToast(units ? `Offered ${units / 100}% of the company` : 'Offer withdrawn', 'success', 3000);
    reloadVentures();
  };

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
  // SESSION RECOVERY (Fix Log v1.2 #3 / #5)
  // Closing the tab, refreshing or losing signal never removes a player from the group; only
  // the Leave Room button does. Coming back reclaims the same seat and resyncs.
  // =====================================================
  useEffect(() => {
    if (!roomId || !currentPlayerId || !isSupabaseConfigured) return;
    let cancelled = false;
    (async () => {
      const res = await rejoinRoom({ roomId, playerId: currentPlayerId, name: playerName, avatar });
      if (cancelled) return;
      if (res?.error && res.answered && res.status === 404) {
        setSeatError(`${res.error} Your progress is still saved on this device.`);
        return;
      }
      // A newer server copy (played on another device) replaces this device's copy.
      const server = await getServerSave(roomId, currentPlayerId);
      if (cancelled || !server || server.rulesetId !== RULESET_ID) return;
      if (newerSave(ledgerRef.current, server) === server) replaceLedger(server);
    })();
    return () => { cancelled = true; };
    // Runs once per seat; name and avatar only matter if the seat must be restored.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, currentPlayerId, replaceLedger, ledgerRef]);

  // Back online or back to the tab: reconnect now instead of waiting out the backoff.
  useEffect(() => {
    if (!roomId || !currentPlayerId) return;
    const resume = () => {
      if (document.visibilityState === 'hidden') return;
      reconnectAttemptsRef.current = 0;
      retryDelayRef.current = 2000;
      flushPending.current();
      setReconnectTrigger(prev => prev + 1);
    };
    window.addEventListener('online', resume);
    document.addEventListener('visibilitychange', resume);
    return () => {
      window.removeEventListener('online', resume);
      document.removeEventListener('visibilitychange', resume);
    };
  }, [roomId, currentPlayerId]);

  // Server copy of the save, a few seconds after the last change (and retried after failures).
  const [serverSaveTick, setServerSaveTick] = useState(0);
  useEffect(() => {
    if (!roomId || !currentPlayerId || !isSupabaseConfigured) return;
    const timer = setTimeout(async () => {
      const res = await putServerSave(roomId, currentPlayerId, ledgerRef.current);
      if (res.error) setTimeout(() => setServerSaveTick(t => t + 1), 15000);
    }, 3000);
    return () => clearTimeout(timer);
  }, [ledger, roomId, currentPlayerId, ledgerRef, serverSaveTick]);

  // =====================================================
  // GAME LOGIC
  // =====================================================

  // Switch to Profile tab when lap counter hits 100% so player can end the game
  useEffect(() => {
    if (totalLaps > 0 && laps >= totalLaps) {
      setActiveTab('profile');
    }
  }, [laps, totalLaps]);

  // Rate limiting: Track last purchase time
  const lastPurchaseTimeRef = useRef(0);
  const RATE_LIMIT_MS = 2000; // 2 seconds between purchases

  /**
   * Run a ledger operation from a button; toast the outcome. Returns true on success.
   * `format` builds the success message from the result when it depends on it.
   */
  const act = (type, payload, successMessage, format) => {
    try {
      const result = run(type, payload);
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
    const title = ledgerRef.current.purchases[ledgerRef.current.purchases.length - 1]?.title || 'Purchase';
    const parts = [];
    if (r.receipts !== undefined) parts.push(`receipts ${formatCents(r.receipts)} (${r.profit >= 0 ? 'profit' : 'loss'} ${formatCents(Math.abs(r.profit))})`);
    if (r.value !== undefined) parts.push(r.failed ? 'launch failed: value $0' : `value ${formatCents(r.value)}`);
    if (r.prepared) parts.push('Prepared launch');
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
    if (r.scenario) {
      addToast(r.scenario.status === 'clear' ? `${r.scenario.color === 'red' ? 'Red' : 'Blue'} space: all clear this turn.` : '⚡ Curveball — choose your response on Home', r.scenario.status === 'clear' ? 'info' : 'warning', 4000);
    }
    r.events.filter(ev => ['scenario_default', 'scenario_followup', 'portal'].includes(ev.type)).forEach(ev => addToast(ev.label, 'info', 4500));
    if (r.purple) {
      addToast(r.purple.status === 'clear' ? 'Purple space: plan review (no points this turn).' : '💼 Career opportunity — see Home', 'info', 3500);
    }
    if (r.final) addToast('Final lap reached. Settle up in Finance, then Finish & Reveal.', 'info', 5000);
  };

  // Manual money entry (home screen)
  const handleIncome = (amount, setAside, label) =>
    act('income', { amount, taxClass: 'nil', setAside, label },
      `+${formatCents(amount)} NIL income${setAside > 0 ? ` (${formatCents(setAside)} to Tax Bucket)` : ''}`);
  const handleInvoice = (amount, label) =>
    act('invoice', { amount, label }, null, r => `${label}: ${formatCents(amount)} due on turn ${r.dueTurn}`);
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
    otherLiabilities: eventLiabilities(ledger),
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
      external: {},
    });
    // A finished player's stake freezes in the shared cap table (the founder's stops the company).
    if (roomId && currentPlayerId) {
      ledgerRef.current.assets
        .filter(a => a.ventureId && (a.holding === 'growth' || a.holding === 'venture_stake'))
        .forEach(a => freezeStake(a.ventureId, currentPlayerId, holdingValue(ledgerRef.current, a)));
    }
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
        shadyDebt: 0,
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
      shadyDebt: 0,
      investments,
      score: snapshot.score,
      reveal: snapshot.reveal,
      evidence: snapshot.evidence,
      totalLaps,
    };

    try {
      console.log('🎯 Generating AI summary for:', playerName);
      
      // The rules engine chose the pattern; the AI may only explain it from these facts.
      const revealFacts = {
        assignedPattern: revealTitle(snapshot.reveal),
        patternState: snapshot.reveal.state,
        patternDescription: snapshot.reveal.profiles.map(p => PROFILE_COPY[p.code]).join(' '),
        decisions: snapshot.evidence.observations.slice(-12).map(o => o.label),
        setbacks: snapshot.evidence.setbacks.map(x => x.label),
        nextTime: nextTimeSuggestion(snapshot.reveal),
      };
      const { summary, grounded } = await fetchAiSummary({
        reveal: revealFacts,
        name: playerName,
        playerName,
        cash: finalCash,
        luxuries,
        rep,
        career,
        credit: finalCredit,
        debt: finalDebt,
        curveballs,
        shadyDebt: 0,
        investments,
      });

      console.log('✅ AI summary received:', { summary: summary?.substring(0, 50) + '...', grounded });

      clearSave();
      showFinal({
        ...basePayload,
        // Show AI text only when it narrated the assigned pattern; otherwise the reveal speaks alone.
        summary: grounded ? summary : '',
        archetype: revealTitle(snapshot.reveal),
        coachJBoUnlocked: coachJBoCheck(),
      });
      addToast('Summary generated successfully!', 'success', 2000);
    } catch (error) {
      console.error('❌ Error generating AI summary:', error);
      addToast('Failed to generate summary. Showing results without AI analysis.', 'warning', 4000);

      clearSave();
      showFinal({
        ...basePayload,
        summary: '',
        archetype: revealTitle(snapshot.reveal),
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
  // One lap = one year; the header and Turn Tracker read the same ledger value.
  const displayYear = currentYear(ledger);
  const primaryNavIds = ['home', 'invest', 'luxury', 'finance', 'curveballs'];
  const navItemActive = (id) => primaryNavIds.includes(activeTab) && activeTab === id;

  return (
    <div className="min-h-[100dvh] bg-gradient-to-br from-sky-400 via-blue-500 to-cyan-400">
      <ToastContainer toasts={toasts} onRemove={removeToast} />

      <div className="max-w-md mx-auto min-h-[100dvh] px-4 pt-4 pb-28">
        {roomInfo && (seatError || syncPending) && (
          <div role="status" className={`mb-3 rounded-xl border px-3 py-2 text-xs font-semibold ${seatError ? 'bg-red-100/90 border-red-300 text-red-900' : 'bg-amber-100/90 border-amber-300 text-amber-900'}`}>
            {seatError || 'Reconnecting to your group… your moves are saved and will sync automatically.'}
          </div>
        )}
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
                Year {displayYear} of {totalLaps} · Lap {displayYear}
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
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-700/90 mb-1">Available Cash</p>
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
                    <CashEntry onIncome={handleIncome} onOther={handleOtherIncome} onSpend={handleSpend} onInvoice={handleInvoice} />
                  )}
                </div>
              </div>

              {/* NIL tier: annual valuation is shown apart from cash and never posts to the wallet */}
              {ledger.nilTier && (
                <div className={glassSection}>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-700">
                    Roll {ledger.nilTier.roll} - {ledger.nilTier.label}
                  </p>
                  <div className="grid grid-cols-2 gap-3 mt-2 text-sm">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">Annual NIL Valuation</p>
                      <p className="text-lg font-bold text-slate-900 tabular-nums">{formatCents(ledger.nilTier.annualValuation)}</p>
                    </div>
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">NIL paid to date</p>
                      <p className="text-lg font-bold text-slate-900 tabular-nums">{formatCents(ledger.nilPaidToDate || 0)}</p>
                    </div>
                  </div>
                  <p className="text-xs text-slate-700 mt-2">{NIL_VALUATION_HELP}</p>
                </div>
              )}

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

              {((ledger.scenario && ledger.scenario.turn === ledger.turn) || ledger.portal) && (
                <div className={glassSection}>
                  <ScenarioPanel ledger={ledger} act={act} />
                </div>
              )}

              {(ledger.career.offer || ledger.career.internship || (ledger.career.referral && !ledger.career.referral.used)) && (
                <div className={glassSection}>
                  <CareerPanel ledger={ledger} act={act} />
                </div>
              )}

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
                <CatalogMenu kind="investment" ledger={ledger} onAcquire={handleAcquire} act={act} />
              </div>

              <div className={glassSection}>
                <div className="flex items-center gap-2 mb-4">
                  <FaChartLine className="text-xl text-slate-800" />
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-800">Your portfolio</h3>
                </div>
                <HoldingsPanel ledger={ledger} act={act} />
              </div>

              {roomInfo && (
                <div className={glassSection}>
                  <div className="flex items-center gap-2 mb-4">
                    <FaChartLine className="text-xl text-slate-800" />
                    <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-800">Sports complex shares</h3>
                  </div>
                  <VenturePanel
                    ventures={ventures}
                    ledger={ledger}
                    selfId={String(currentPlayerId)}
                    names={Object.fromEntries(Object.values(roomPlayers).map(p => [String(p.player_id), p.name]))}
                    onBuy={handleVentureBuy}
                    onList={handleVentureList}
                  />
                </div>
              )}
            </>
          )}

          {activeTab === 'luxury' && (
            <>
              <div className={glassSection}>
                <div className="flex items-center gap-2 mb-4">
                  <FaGem className="text-xl text-fuchsia-700" />
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-800">Lifestyle &amp; Luxury</h3>
                </div>
                <CatalogMenu kind="luxury" ledger={ledger} onAcquire={handleAcquire} act={act} />
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
                <ScenarioPanel ledger={ledger} act={act} />
                {ledger.turn === 0 && (
                  <label className="mt-3 flex items-start gap-2 text-xs text-slate-900">
                    <input
                      type="checkbox"
                      checked={ledger.settings.familyExpansionContent !== false}
                      onChange={e => act('set_setting', { key: 'familyExpansionContent', value: e.target.checked })}
                      className="mt-0.5"
                    />
                    <span>Include the family-planning blue card (host setting; locks after the first roll)</span>
                  </label>
                )}
              </div>

              <div className={glassSection}>
                <div className="flex items-center gap-2 mb-4">
                  <FaStar className="text-xl text-amber-600" />
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-800">REP &amp; career</h3>
                </div>
                <RepCareerPoints rep={rep} career={career} />
              </div>

              <div className={glassSection}>
                <div className="flex items-center gap-2 mb-4">
                  <FaStar className="text-xl text-violet-700" />
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-800">Career record</h3>
                </div>
                <CareerRecord ledger={ledger} />
              </div>

              <div className={glassSection}>
                <div className="flex items-center gap-2 mb-4">
                  <FaBolt className="text-xl text-red-700" />
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-800">Curveball history</h3>
                </div>
                <ScenarioHistory ledger={ledger} />
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
                        'Leave this group game for good? You will be removed from the group. (Closing the tab or going offline does not remove you.)'
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
