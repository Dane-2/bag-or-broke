import React, { useState, useEffect, useCallback } from 'react';

import StartScreen from './components/StartScreen';
import MultiplayerModeScreen from './components/MultiplayerModeScreen';
import RoomScreen from './components/RoomScreen';
import LobbyScreen from './components/LobbyScreen';
import PlayerDashboard from './components/PlayerDashboard';
import FinalScoreboard from './components/FinalScoreboard';

function App() {
  // GAME STATE
  const [gameStarted, setGameStarted] = useState(false);
  const [playerName, setPlayerName] = useState('');
  const [startingCash, setStartingCash] = useState(null);
  const [avatar, setAvatar] = useState('');
  const [totalLaps, setTotalLaps] = useState(5);

  const [finalScoresVisible, setFinalScoresVisible] = useState(false);
  const [finalData, setFinalData] = useState(null);

  // MULTIPLAYER
  const [mode, setMode] = useState(null);     
  const [mpStep, setMpStep] = useState(null); 
  const [roomInfo, setRoomInfo] = useState(null);


  // AUTO RESUME OFFLINE GAME
  useEffect(() => {
    const saves = Object.keys(localStorage).filter(k =>
      k.startsWith("bagorbroke_save_")
    );

    if (saves.length > 0) {
      const key = saves[saves.length - 1];
      const saved = JSON.parse(localStorage.getItem(key));

      if (saved && saved.playerName) {
        const resume = window.confirm(
          `Resume your last offline game as ${saved.playerName}?`
        );

        if (resume) {
          setMode("offline");
          setPlayerName(saved.playerName);
          setAvatar(saved.avatar || '');
          setStartingCash(saved.cash || 0);
          setTotalLaps(saved.totalLaps || 5);
          setGameStarted(true);
        } else {
          saves.forEach(k => localStorage.removeItem(k));
        }
      }
    }
  }, []);


  // =====================================================================
  // HANDLERS
  // =====================================================================

  const handleJoinRoom = useCallback((info) => {
    if (info.name) setPlayerName(info.name);
    if (info.avatar) setAvatar(info.avatar);
    if (typeof info.startingCash === 'number') setStartingCash(info.startingCash);
    if (typeof info.totalLaps === 'number') setTotalLaps(info.totalLaps);

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
          onStart={(name, cash, label, laps) => {
            setMode("offline");
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
