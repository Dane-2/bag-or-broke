import React, { useState, useEffect, useCallback } from 'react';

import StartScreen from './components/StartScreen';
import MultiplayerModeScreen from './components/MultiplayerModeScreen';
import RoomScreen from './components/RoomScreen';
import LobbyScreen from './components/LobbyScreen';
import PlayerDashboard from './components/PlayerDashboard';
import FinalScoreboard from './components/FinalScoreboard';
import { LEGACY_SAVE_PREFIXES, RULESET_ID, SAVE_PREFIX } from './rules';
import { leaveRoom } from './utils/roomApi';

function App() {
  // GAME STATE
  const [gameStarted, setGameStarted] = useState(false);
  const [playerName, setPlayerName] = useState('');
  const [startingCash, setStartingCash] = useState(null);
  const [avatar, setAvatar] = useState('');
  const [totalLaps, setTotalLaps] = useState(5);
  const [nilTierId, setNilTierId] = useState(null);

  const [finalScoresVisible, setFinalScoresVisible] = useState(false);
  const [finalData, setFinalData] = useState(null);

  // MULTIPLAYER
  const [mode, setMode] = useState(null);     
  const [mpStep, setMpStep] = useState(null); 
  const [roomInfo, setRoomInfo] = useState(null);


  // AUTO RESUME (offline game or group seat)
  useEffect(() => {
    // Use setTimeout to prevent blocking initial render
    const timer = setTimeout(() => {
      try {
        // Saves from before the central finance rules use different logic; discard them.
        Object.keys(localStorage)
          .filter(k => LEGACY_SAVE_PREFIXES.some(prefix => k.startsWith(prefix)))
          .forEach(k => localStorage.removeItem(k));

        const saves = Object.keys(localStorage).filter(k => {
          if (!k.startsWith(SAVE_PREFIX)) return false;
          try {
            return JSON.parse(localStorage.getItem(k))?.rulesetId === RULESET_ID;
          } catch (e) {
            return false;
          }
        });

        // Newest save first (group seats and offline games are saved under separate keys).
        const parsed = saves
          .map(k => ({ key: k, saved: JSON.parse(localStorage.getItem(k)) }))
          .filter(x => x.saved && x.saved.playerName)
          .sort((a, b) => (b.saved.savedAt || 0) - (a.saved.savedAt || 0));

        if (parsed.length > 0) {
          const { key, saved } = parsed[0];
          const restore = () => {
            setPlayerName(saved.playerName);
            setAvatar(saved.avatar || '');
            setStartingCash(saved.finance?.cash !== undefined ? saved.finance.cash / 100 : saved.cash || 0);
            setTotalLaps(saved.totalLaps || 5);
            if (saved.room?.nilTierId) setNilTierId(saved.room.nilTierId);
          };

          if (saved.room?.roomId && saved.room?.playerId) {
            // A group game returns to the same room and seat, never to a private copy (Fix Log v1.2 #3).
            const label = saved.room.code ? ` (room ${saved.room.code})` : '';
            if (window.confirm(`Rejoin your group game${label} as ${saved.playerName}?`)) {
              restore();
              setMode("multiplayer");
              setRoomInfo(saved.room);
              setGameStarted(true);
            } else if (window.confirm('Leave that group game for good? Choose Cancel to keep your seat for later.')) {
              leaveRoom(saved.room.roomId, saved.room.playerId);
              localStorage.removeItem(key);
            }
          } else if (window.confirm(`Resume your last offline game as ${saved.playerName}?`)) {
            restore();
            setMode("offline");
            setGameStarted(true);
          } else {
            parsed.filter(x => !x.saved.room).forEach(x => localStorage.removeItem(x.key));
          }
        }
      } catch (error) {
        console.error("Error loading saved game:", error);
      }
    }, 100);

    return () => clearTimeout(timer);
  }, []);


  // =====================================================================
  // HANDLERS
  // =====================================================================

  const handleJoinRoom = useCallback((info) => {
    if (info.name) setPlayerName(info.name);
    if (info.avatar) setAvatar(info.avatar);
    if (typeof info.startingCash === 'number') setStartingCash(info.startingCash);
    if (typeof info.totalLaps === 'number') setTotalLaps(info.totalLaps);
    if (info.nilTierId) setNilTierId(info.nilTierId);

    // store room information
    setRoomInfo(info);

    // ❌ DO NOT reset mpStep
    // ❌ DO NOT touch gameStarted here
  }, []);

  const handleLeaveRoom = useCallback(() => {
    // Reset multiplayer state and go back to mode selection
    setRoomInfo(null);
    setGameStarted(false);
    setMpStep(null);
    // Keep mode as "multiplayer" so they can create/join again
  }, []);


  // =====================================================================
  // UI FLOW CONTROL
  // =====================================================================

  // BEFORE GAME START
  if (!gameStarted) {

    // 1. Choose Offline / Multiplayer
    if (!mode) {
      return (
        <StartScreen
          onStart={(name, cash, label, laps, tierId) => {
            setMode("offline");
            setNilTierId(tierId);
            setPlayerName(name);
            setAvatar(label);
            setStartingCash(cash);
            setTotalLaps(laps);
            setGameStarted(true);
          }}
          onMultiplayer={() => setMode("multiplayer")}
        />
      );
    }

    // 2. Host or Join
    if (mode === "multiplayer" && !mpStep && !roomInfo) {
      return (
        <MultiplayerModeScreen
          onSelect={(choice) => {
            if (choice === "back") {
              setMode(null);
            } else {
              setMpStep(choice);
            }
          }}
        />
      );
    }

    // 3. Create or Join Room
    if (mode === "multiplayer" && mpStep && !roomInfo) {
      return (
        <RoomScreen
          hostMode={mpStep === "host"}
          onJoin={handleJoinRoom}
        />
      );
    }

    // 4. Lobby (wait for host)
    if (mode === "multiplayer" && roomInfo && !gameStarted) {
      return (
        <LobbyScreen
          key={roomInfo.roomId}                 // 👉 prevents remount loops
          roomInfo={roomInfo}
          onStartGame={() => setGameStarted(true)}
          onLeaveRoom={handleLeaveRoom}
        />
      );
    }
  }

  // =====================================================================
  // FINAL SCOREBOARD
  // =====================================================================
  if (finalScoresVisible) {
    return <FinalScoreboard data={finalData} />;
  }

  // =====================================================================
  // MAIN GAMEPLAY
  // =====================================================================
  return (
    <PlayerDashboard
      playerName={playerName}
      avatar={avatar}
      startingCash={startingCash}
      totalLaps={totalLaps}
      nilTierId={nilTierId}
      roomInfo={roomInfo}
      onLeaveRoom={handleLeaveRoom}
      showFinal={(data) => {
        setFinalData(data);
        setFinalScoresVisible(true);
      }}
    />
  );
}

export default App;
