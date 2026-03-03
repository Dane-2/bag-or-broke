import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  FaTrophy, FaUser, FaBolt, FaFlagCheckered, FaDollarSign, FaChartBar, 
  FaCreditCard, FaGem, FaChartLine, FaShieldAlt, FaMoneyBillWave, 
  FaStar, FaIdCard, FaTh, FaBullseye, FaGem as FaDiamondIcon
} from 'react-icons/fa';
import CardSelector from './CardSelector';

import LapTracker from './LapTracker';
import CashTracker from './CashTracker';
import InvestmentLog from './InvestmentLog';
import LuxuryLog from './LuxuryLog';
import DebtCreditTracker from './DebtCreditTracker';
import DrawFromAsset from './DrawFromAsset';
import CurveballSection from './CurveballSection';
import RepCareerPoints from './RepCareerPoints';
import FinalNetWorth from './FinalNetWorth';
import LifeInsuranceManager from './LifeInsuranceManager';
import AnnuityManager from './AnnuityManager';
import PurpleTab from './PurpleTab';

import { fetchAiSummary } from '../utils/fetchAiSummary';
import { supabase, isSupabaseConfigured } from '../utils/supabaseClient';
import { selectCoachJBoWinner } from '../utils/coachJBo';
import RoomHUD from "./RoomHUD";
import ToastContainer from "./ToastContainer";
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
  const [redCurveballLoss, setRedCurveballLoss] = useState(0); // Financial curveball losses
  const [blueCurveballLoss, setBlueCurveballLoss] = useState(0); // Life curveball losses
  const [lossAvoided, setLossAvoided] = useState(0); // Total losses avoided through protection
  const totalLaps = initialTotalLaps || 5;
  
  // REP & Career System State
  const [balanceBonusAwarded, setBalanceBonusAwarded] = useState(false);
  const [careerThresholdsUnlocked, setCareerThresholdsUnlocked] = useState([]);
  const [repThresholdsUnlocked, setRepThresholdsUnlocked] = useState([]);
  const [investmentSetsAwarded, setInvestmentSetsAwarded] = useState([]);

  // =====================================================
  // REP & CAREER SYSTEM FUNCTIONS
  // =====================================================
  
  // Get REP award from luxury cost (based on cost tier)
  const getRepFromCost = (cost) => {
    if (cost >= 250000) return 8;
    if (cost >= 150000) return 7;
    if (cost >= 80000) return 6;
    if (cost >= 50000) return 5;
    if (cost >= 25000) return 4;
    if (cost >= 12000) return 3;
    if (cost >= 6000) return 2;
    if (cost >= 3500) return 1;
    return 0;
  };

  // Check investment set completions for Career points
  const checkInvestmentSets = () => {
    const sets = {
      offensive: {
        required: ['OFF_STOCKS', 'OFF_ETFS', 'OFF_BONDS'],
        bonus: 10,
        id: 'offensive'
      },
      realEstate: {
        required: ['I1'], // Vacant Property
        bonus: 10,
        id: 'realEstate',
        // Also need Renovated Property and any Rental Strategy
        check: (inv) => {
          const hasVacant = inv.some(i => i.cardId === 'I1');
          const hasRenovated = inv.some(i => i.cardId === 'I2');
          const hasRental = inv.some(i => 
            i.cardId === 'RE_SHORT_TERM_RENTAL' || 
            i.cardId === 'RE_DUPLEX' || 
            i.cardId === 'RE_TRIPLEX' || 
            i.cardId === 'RE_FOURPLEX' ||
            (i.cardTitle && i.cardTitle.includes('Rent'))
          );
          return hasVacant && hasRenovated && hasRental;
        }
      },
      defensive: {
        bonus: 15,
        id: 'defensive',
        check: (inv) => {
          const hasLifeInsurance = inv.some(i => i.cardId && i.cardId.startsWith('INV_LIFE_INSURANCE'));
          const hasAnnuity = inv.some(i => i.cardId && i.cardId.startsWith('INV_ANNUITY'));
          const hasHealth = inv.some(i => i.cardId && i.cardId.startsWith('DEF_HEALTH'));
          const hasLegal = inv.some(i => i.cardId && i.cardId.startsWith('DEF_LEGAL'));
          const hasUmbrella = inv.some(i => i.cardId === 'DEF_UMBRELLA_LIABILITY');
          return hasLifeInsurance && hasAnnuity && (hasHealth || hasLegal || hasUmbrella);
        }
      }
    };

    Object.values(sets).forEach(set => {
      if (set.id && !investmentSetsAwarded.includes(set.id)) {
        let completed = false;
        
        if (set.id === 'offensive') {
          completed = set.required.every(cardId => 
            investments.some(inv => inv.cardId === cardId)
          );
        } else if (set.check) {
          completed = set.check(investments);
        }
        
        if (completed) {
          setCareer(prev => prev + set.bonus);
          setInvestmentSetsAwarded(prev => [...prev, set.id]);
          addToast(`🎯 Investment Set Complete! +${set.bonus} Career Points`, 'success', 4000);
        }
      }
    });
  };

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
      setCash(prev => prev + 250000);
      addToast('⚖️ Balance Bonus! +$250,000 + 5% ROI boost to one investment!', 'success', 5000);
    }
  };

  // Check all thresholds and bonuses (call after REP/Career changes)
  // Note: This function reads from state directly, so we don't need it in dependencies
  const checkAllThresholds = () => {
    checkCareerThresholds();
    checkRepThresholds();
    checkBalanceBonus();
    checkInvestmentSets();
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

  // Calculate protection tier
  const calculateProtectionTier = () => {
    const hasHoldingCompany = investments.some(inv => inv.cardId === 'RE_HOLDCO');
    const hasInsurance = investments.some(inv => inv.cardId === 'RE_INSURANCE');
    
    if (hasHoldingCompany && hasInsurance) {
      return { tier: 2, label: 'Tier 2 – Institutionally Protected' };
    } else if (hasHoldingCompany || hasInsurance) {
      return { tier: 1, label: 'Tier 1 – Risk Aware' };
    }
    return { tier: 0, label: 'No Protection' };
  };

  // Calculate empire status
  const calculateEmpireStatus = () => {
    const hasRealEstateAssets = investments.filter(inv => 
      inv.cardTitle && (
        inv.cardTitle.includes('Duplex') ||
        inv.cardTitle.includes('Triplex') ||
        inv.cardTitle.includes('Fourplex') ||
        inv.cardTitle.includes('Commercial') ||
        inv.cardTitle.includes('Property') ||
        inv.cardTitle.includes('Rent')
      )
    ).length >= 2;

    const hasMultiUnit = investments.some(inv => 
      inv.cardTitle && (
        inv.cardTitle.includes('Duplex') ||
        inv.cardTitle.includes('Triplex') ||
        inv.cardTitle.includes('Fourplex')
      )
    );

    const hasCommercial = investments.some(inv => 
      inv.cardTitle && inv.cardTitle.includes('Commercial')
    );

    const hasProtection = investments.some(inv => 
      inv.cardId === 'RE_HOLDCO' || inv.cardId === 'RE_INSURANCE'
    );

    const qualifiesEmpire = (hasRealEstateAssets || hasMultiUnit || hasCommercial) && hasProtection;
    
    return qualifiesEmpire;
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
      if (typeof s.redCurveballLoss === 'number') setRedCurveballLoss(s.redCurveballLoss);
      if (typeof s.blueCurveballLoss === 'number') setBlueCurveballLoss(s.blueCurveballLoss);
      if (typeof s.lossAvoided === 'number') setLossAvoided(s.lossAvoided);
      if (typeof s.balanceBonusAwarded === 'boolean') setBalanceBonusAwarded(s.balanceBonusAwarded);
      if (Array.isArray(s.careerThresholdsUnlocked)) setCareerThresholdsUnlocked(s.careerThresholdsUnlocked);
      if (Array.isArray(s.repThresholdsUnlocked)) setRepThresholdsUnlocked(s.repThresholdsUnlocked);
      if (Array.isArray(s.investmentSetsAwarded)) setInvestmentSetsAwarded(s.investmentSetsAwarded);

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
      redCurveballLoss,
      blueCurveballLoss,
      lossAvoided,
      balanceBonusAwarded,
      careerThresholdsUnlocked,
      repThresholdsUnlocked,
      investmentSetsAwarded,
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
    redCurveballLoss,
    blueCurveballLoss,
    lossAvoided,
    balanceBonusAwarded,
    careerThresholdsUnlocked,
    repThresholdsUnlocked,
    investmentSetsAwarded,
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
  

  useEffect(() => { if (roomId && currentPlayerId) syncToRoom({ cash }); }, [cash, roomId, currentPlayerId, syncToRoom]);
  useEffect(() => { if (roomId && currentPlayerId) syncToRoom({ debt }); }, [debt, roomId, currentPlayerId, syncToRoom]);
  useEffect(() => { if (roomId && currentPlayerId) syncToRoom({ credit }); }, [credit, roomId, currentPlayerId, syncToRoom]);
  useEffect(() => { if (roomId && currentPlayerId) syncToRoom({ rep }); }, [rep, roomId, currentPlayerId, syncToRoom]);
  useEffect(() => { if (roomId && currentPlayerId) syncToRoom({ laps }); }, [laps, roomId, currentPlayerId, syncToRoom]);
  useEffect(() => { if (roomId && currentPlayerId) syncToRoom({ redCurveballLoss }); }, [redCurveballLoss, roomId, currentPlayerId, syncToRoom]);
  useEffect(() => { if (roomId && currentPlayerId) syncToRoom({ blueCurveballLoss }); }, [blueCurveballLoss, roomId, currentPlayerId, syncToRoom]);

  useEffect(() => {
    if (roomId && currentPlayerId) {
      syncToRoom({ luxuries });
    }
  }, [luxuries, roomId, currentPlayerId, syncToRoom]);

  useEffect(() => {
    if (roomId && currentPlayerId) {
      syncToRoom({ investments });
    }
  }, [investments, roomId, currentPlayerId, syncToRoom]);

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

  // Check thresholds when REP, Career, or investments change
  useEffect(() => {
    checkAllThresholds();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rep, career, investments]);

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

      // Check if player already owns Umbrella (non-repeatable)
      if (cardResult.cardId === 'DEF_UMBRELLA' && investments.some(inv => inv.cardId === 'DEF_UMBRELLA')) {
        addToast('You can only own one Umbrella Liability Coverage policy.', 'error', 3000);
        return;
      }

      const { cost: finalCost, interest } = cardResult;
      if (borrowed) {
        setDebt(prev => prev + finalCost + interest);
        setCredit(prev => prev - 20);
      } else {
        setCash(prev => prev - finalCost);
      }
      
      // Set purchase lap for annuities
      const investmentData = { ...cardResult };
      if (cardResult.investmentType === 'annuity') {
        investmentData.purchaseLap = laps;
      }
      
      // Check for offensive portfolio completion after adding investment
      setInvestments(prev => {
        // Check if portfolio was already complete before this purchase
        const prevHasStocks = prev.some(inv => inv.cardId === 'OFF_STOCKS');
        const prevHasETFs = prev.some(inv => inv.cardId === 'OFF_ETFS');
        const prevHasBonds = prev.some(inv => inv.cardId === 'OFF_BONDS');
        const wasAlreadyComplete = prevHasStocks && prevHasETFs && prevHasBonds;
        
        const updated = [...prev, investmentData];
        
        // Check if player now owns all three offensive planning cards
        const hasStocks = updated.some(inv => inv.cardId === 'OFF_STOCKS');
        const hasETFs = updated.some(inv => inv.cardId === 'OFF_ETFS');
        const hasBonds = updated.some(inv => inv.cardId === 'OFF_BONDS');
        const portfolioComplete = hasStocks && hasETFs && hasBonds;
        
        // Apply portfolio completion bonuses
        if (portfolioComplete) {
          // Check if this is the first time completing (one-time bonus)
          if (!wasAlreadyComplete) {
            // One-time $100,000 cash bonus
            setCash(prevCash => prevCash + 100000);
            addToast('🎉 Offensive Portfolio Complete! +$100,000 bonus and +5% ROI to all offensive assets!', 'success', 5000);
          }
          
          // Mark all offensive planning investments with portfolio bonus
          return updated.map(inv => {
            if (inv.investmentType === 'offensivePlanning') {
              return {
                ...inv,
                offensivePortfolioComplete: true
              };
            }
            return inv;
          });
        }
        
        return updated;
      });
      lastPurchaseTimeRef.current = now;
      
      addToast(
        `Investment purchased for $${finalCost.toLocaleString()}${borrowed ? " (Financed with 25% interest)" : ""}`,
        'success',
        3000
      );
    }

    if (cardResult.type === 'luxury') {
      const { cardTitle, cost, resale, borrowed, interest } = cardResult;
      
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
      
      // Calculate REP from cost tier (automatic award)
      const repGain = getRepFromCost(cost);
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
      
      // Check thresholds after REP gain
      setTimeout(() => checkAllThresholds(), 100);
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

      // Coach JBo: only in multiplayer with 4+ players
      let coachJBoUnlocked = false;
      if (roomInfo && currentPlayerId && Object.keys(roomPlayers).length >= 4) {
        const merged = { ...roomPlayers };
        merged[currentPlayerId] = {
          ...merged[currentPlayerId],
          player_id: currentPlayerId,
          name: playerName,
          cash,
          luxuries,
          rep,
          career,
          debt,
          shadyDebt,
          investments,
        };
        const result = selectCoachJBoWinner(merged);
        if (result && result.winnerPlayerId === currentPlayerId) {
          coachJBoUnlocked = true;
        }
      }

      const finalPayload = {
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
        balanceBonusAwarded,
        coachJBoUnlocked,
      };

      clearSave();
      showFinal(finalPayload);
      addToast('Summary generated successfully!', 'success', 2000);
    } catch (error) {
      console.error('❌ Error generating AI summary:', error);
      addToast('Failed to generate summary. Showing results without AI analysis.', 'warning', 4000);

      let coachJBoUnlocked = false;
      if (roomInfo && currentPlayerId && Object.keys(roomPlayers).length >= 4) {
        const merged = { ...roomPlayers };
        merged[currentPlayerId] = {
          ...merged[currentPlayerId],
          player_id: currentPlayerId,
          name: playerName,
          cash,
          luxuries,
          rep,
          career,
          debt,
          shadyDebt,
          investments,
        };
        const result = selectCoachJBoWinner(merged);
        if (result && result.winnerPlayerId === currentPlayerId) coachJBoUnlocked = true;
      }

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
        balanceBonusAwarded,
        coachJBoUnlocked,
      });
    } finally {
      setIsGeneratingSummary(false);
    }
  };

  // =====================================================
  // RENDER
  // =====================================================

  // Calculate quick stats for Home tab
  const totalAssetValue = investments.reduce((sum, inv) => sum + (inv.newValue || 0), 0);
  const progressPercentage = totalLaps > 0 ? Math.round((laps / totalLaps) * 100) : 0;

  return (
    <div
      className="min-h-screen bg-no-repeat bg-center bg-[length:100%_auto] sm:bg-cover"
      style={{ backgroundImage: "url('/moneyBG.png')" }}
    >
      {/* Toast Notifications */}
      {roomInfo && <ToastContainer toasts={toasts} onRemove={removeToast} />}
      
      <div className="max-w-md mx-auto bg-white/80 rounded-xl shadow-xl">
        
        {/* Tab Navigation */}
        <div className="sticky top-0 z-10 bg-white/95 backdrop-blur-sm border-b border-gray-200">
          <div className="flex">
            <button
              onClick={() => setActiveTab('home')}
              className={`flex-1 py-3 px-2 text-sm font-medium transition-colors ${
                activeTab === 'home'
                  ? 'text-green-600 border-b-2 border-green-600 bg-green-50'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              Home
            </button>
            <button
              onClick={() => setActiveTab('cards')}
              className={`flex-1 py-3 px-2 text-sm font-medium transition-colors ${
                activeTab === 'cards'
                  ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              Investments
            </button>
            <button
              onClick={() => setActiveTab('finance')}
              className={`flex-1 py-3 px-2 text-sm font-medium transition-colors ${
                activeTab === 'finance'
                  ? 'text-purple-600 border-b-2 border-purple-600 bg-purple-50'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              Debt
            </button>
            <button
              onClick={() => setActiveTab('curveballs')}
              className={`flex-1 py-3 px-2 text-sm font-medium transition-colors ${
                activeTab === 'curveballs'
                  ? 'text-red-600 border-b-2 border-red-600 bg-red-50'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              Events
            </button>
            {roomInfo && (
              <button
                onClick={() => setActiveTab('leaderboard')}
                className={`flex-1 py-3 px-2 text-sm font-medium transition-colors ${
                  activeTab === 'leaderboard'
                    ? 'text-amber-600 border-b-2 border-amber-600 bg-amber-50'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                Leaderboard
              </button>
            )}
            <button
              onClick={() => setActiveTab('profile')}
              className={`flex-1 py-3 px-2 text-sm font-medium transition-colors ${
                activeTab === 'profile'
                  ? 'text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              Profile
            </button>
          </div>
        </div>

        {/* Tab Content */}
        <div className="px-4 py-6 space-y-6">
          {/* HOME TAB */}
          {activeTab === 'home' && (
            <>
              {/* Player Dashboard */}
              <div className="bg-white rounded-xl shadow-md p-4 text-center space-y-2">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <FaTrophy className="text-2xl text-yellow-500" />
                  <h2 className="text-2xl font-bold text-gray-800">Player Dashboard</h2>
                </div>
                <div className="flex items-center justify-center gap-2">
                  <FaUser className="text-lg text-gray-600" />
                  <p className="text-gray-600"><strong>Name:</strong> {playerName}</p>
                </div>
                <div className="flex items-center justify-center gap-2">
                  <FaBolt className="text-lg text-yellow-500" />
                  <p className="text-gray-600"><strong>NIL Tier:</strong> {avatar}</p>
                </div>
              </div>

              {/* Progress Section */}
              <div className="bg-white rounded-xl shadow-md p-4">
                <div className="flex items-center gap-2 mb-4">
                  <FaFlagCheckered className="text-xl text-green-600" />
                  <h3 className="text-lg font-semibold text-gray-800">Progress</h3>
                </div>
                <LapTracker
                  laps={laps}
                  totalLaps={totalLaps}
                  setLaps={setLaps}
                  investments={investments}
                  setInvestments={setInvestments}
                  setCash={setCash}
                  addToast={addToast}
                  showFinal={handleEndGame}
                  playerSnapshot={{ playerName, cash, luxuries, rep, career, debt, credit, curveballs, shadyDebt }}
                />
              </div>

              {/* Cash Tracker */}
              <div className="bg-white rounded-xl shadow-md p-4">
                <div className="flex items-center gap-2 mb-4">
                  <FaDollarSign className="text-xl text-green-600" />
                  <h3 className="text-lg font-semibold text-gray-800">Cash Tracker</h3>
                </div>
                <CashTracker cash={cash} setCash={setCash} />
              </div>

              {/* Quick Stats */}
              <div className="bg-white rounded-xl shadow-md p-4">
                <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                  <FaChartBar className="text-xl text-blue-600" />
                  Quick Stats
                </h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600 flex items-center gap-2">
                      <FaDollarSign className="text-green-600" /> Total Cash:
                    </span>
                    <span className="font-semibold text-gray-800">${cash.toLocaleString()}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600 flex items-center gap-2">
                      <FaChartLine className="text-blue-600" /> Progress:
                    </span>
                    <span className="font-semibold text-gray-800">{progressPercentage}%</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600 flex items-center gap-2">
                      <FaBullseye className="text-green-600" /> Status:
                    </span>
                    <span className="font-semibold text-green-600">Active</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600 flex items-center gap-2">
                      <FaDiamondIcon className="text-blue-600" /> Total Asset Value:
                    </span>
                    <span className="font-semibold text-green-600">${totalAssetValue.toLocaleString()}</span>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* CARDS TAB */}
          {activeTab === 'cards' && (
            <>
              <div className="bg-white rounded-xl shadow-md p-4">
                <div className="flex items-center gap-2 mb-4">
                  <FaTh className="text-xl text-blue-600" />
                  <h3 className="text-lg font-semibold text-gray-800">Card Selector</h3>
                </div>
                <CardSelector onSelect={handleCardSelection} investments={investments} />
              </div>

              <div className="bg-white rounded-xl shadow-md p-4">
                <div className="flex items-center gap-2 mb-4">
                  <FaChartLine className="text-xl text-blue-600" />
                  <h3 className="text-lg font-semibold text-gray-800">Investments</h3>
                </div>
                <InvestmentLog
                  investments={investments}
                  setInvestments={setInvestments}
                  setCash={setCash}
                />
              </div>

              <div className="bg-white rounded-xl shadow-md p-4">
                <div className="flex items-center gap-2 mb-4">
                  <FaGem className="text-xl text-purple-600" />
                  <h3 className="text-lg font-semibold text-gray-800">Luxuries</h3>
                </div>
                <LuxuryLog
                  luxuries={luxuries}
                  setLuxuries={setLuxuries}
                  setCash={setCash}
                  setRep={setRep}
                />
              </div>

              <div className="bg-white rounded-xl shadow-md p-4">
                <div className="flex items-center gap-2 mb-4">
                  <FaMoneyBillWave className="text-xl text-green-600" />
                  <h3 className="text-lg font-semibold text-gray-800">Draw from Assets</h3>
                </div>
                <DrawFromAsset
                  investments={investments}
                  setInvestments={setInvestments}
                  cash={cash}
                  setCash={setCash}
                />
              </div>

              <div className="bg-white rounded-xl shadow-md p-4">
                <div className="flex items-center gap-2 mb-4">
                  <FaShieldAlt className="text-xl text-blue-600" />
                  <h3 className="text-lg font-semibold text-gray-800">Life Insurance</h3>
                </div>
                <LifeInsuranceManager
                  investments={investments}
                  setInvestments={setInvestments}
                  setCash={setCash}
                  addToast={addToast}
                />
              </div>

              <div className="bg-white rounded-xl shadow-md p-4">
                <div className="flex items-center gap-2 mb-4">
                  <FaChartBar className="text-xl text-indigo-600" />
                  <h3 className="text-lg font-semibold text-gray-800">Annuities</h3>
                </div>
                <AnnuityManager
                  investments={investments}
                  setInvestments={setInvestments}
                  setCash={setCash}
                  laps={laps}
                  addToast={addToast}
                />
              </div>
            </>
          )}

          {/* FINANCE TAB */}
          {activeTab === 'finance' && (
            <>
              <div className="bg-white rounded-xl shadow-md p-4">
                <div className="flex items-center gap-2 mb-4">
                  <FaCreditCard className="text-xl text-purple-600" />
                  <h3 className="text-lg font-semibold text-gray-800">Debt & Credit</h3>
                </div>
                <DebtCreditTracker
                  cash={cash}
                  setCash={setCash}
                  debt={debt}
                  setDebt={setDebt}
                  credit={credit}
                  setCredit={setCredit}
                />
              </div>
            </>
          )}

          {/* CURVEBALLS TAB */}
          {activeTab === 'curveballs' && (
            <>
              <div className="bg-white rounded-xl shadow-md p-4">
                <div className="flex items-center gap-2 mb-4">
                  <FaBolt className="text-xl text-red-600" />
                  <h3 className="text-lg font-semibold text-gray-800">Curveballs</h3>
                </div>
                <CurveballSection
                  curveballs={curveballs}
                  setCurveballs={setCurveballs}
                  setCash={setCash}
                  setRep={setRep}
                  setShadyDebt={setShadyDebt}
                  onCurveballLoss={handleCurveballLoss}
                  onLossAvoided={handleLossAvoided}
                  investments={investments}
                  setInvestments={setInvestments}
                  redCurveballLoss={redCurveballLoss}
                  blueCurveballLoss={blueCurveballLoss}
                />
              </div>

              <div className="bg-white rounded-xl shadow-md p-4">
                <div className="flex items-center gap-2 mb-4">
                  <FaStar className="text-xl text-yellow-500" />
                  <h3 className="text-lg font-semibold text-gray-800">REP & Career Points</h3>
                </div>
                <RepCareerPoints
                  rep={rep}
                  career={career}
                />
              </div>

              <div className="bg-white rounded-xl shadow-md p-4">
                <PurpleTab
                  onSelect={handlePurpleEvent}
                  addToast={addToast}
                />
              </div>
            </>
          )}

          {/* LEADERBOARD TAB (multiplayer only) */}
          {roomInfo && activeTab === 'leaderboard' && (
            <>
              <div className="bg-white rounded-xl shadow-md p-4">
                <RoomHUD
                  roomPlayers={roomPlayers}
                  currentPlayerId={currentPlayerId}
                  roomStatus={roomStatus}
                />
              </div>
              <div className="bg-white rounded-xl shadow-md p-4">
                <button
                  onClick={async () => {
                    if (window.confirm("Are you sure you want to leave the room? Your progress will be saved.")) {
                      const res = await leaveRoomRequest(roomId, currentPlayerId);
                      if (res?.error) {
                        console.error("❌ Leave room error:", res.error);
                        alert("Failed to leave room: " + res.error);
                      } else {
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

          {/* PROFILE TAB */}
          {activeTab === 'profile' && (
            <>
              <div className="bg-white rounded-xl shadow-md p-4">
                <div className="flex items-center gap-2 mb-4">
                  <FaIdCard className="text-xl text-indigo-600" />
                  <h3 className="text-lg font-semibold text-gray-800">Final Net Worth</h3>
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
                  investments={investments}
                  balanceBonusAwarded={balanceBonusAwarded}
                  lossAvoided={lossAvoided}
                  protectionTier={calculateProtectionTier()}
                  empireStatus={calculateEmpireStatus()}
                  showFinal={handleEndGame}
                  isGeneratingSummary={isGeneratingSummary}
                />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default PlayerDashboard;
