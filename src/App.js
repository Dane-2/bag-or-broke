import React, { useState, useEffect } from 'react';
import StartScreen from './components/StartScreen';
import PlayerDashboard from './components/PlayerDashboard';
import FinalScoreboard from './components/FinalScoreboard';

function App() {
  const [gameStarted, setGameStarted] = useState(false);
  const [playerName, setPlayerName] = useState('');
  const [startingCash, setStartingCash] = useState(null);
  const [avatar, setAvatar] = useState('');
  const [totalLaps, setTotalLaps] = useState(5);
  const [finalScoresVisible, setFinalScoresVisible] = useState(false);
  const [finalData, setFinalData] = useState(null);

  // 🔹 Check for existing save on first load
  useEffect(() => {
    const saves = Object.keys(localStorage).filter(key => key.startsWith('bagorbroke_save_'));
    if (saves.length > 0) {
      const lastSaveKey = saves[saves.length - 1];
      const saved = JSON.parse(localStorage.getItem(lastSaveKey));
      if (saved && saved.playerName) {
        const resume = window.confirm(
          `Resume your last game as ${saved.playerName}?`
        );
        if (resume) {
          setPlayerName(saved.playerName);
          setAvatar(saved.avatar || ''); // safe if not stored
          setStartingCash(saved.cash || 0);
          setTotalLaps(saved.totalLaps || 5);
          setGameStarted(true);
        } else {
          // If they decline, clear saved games
          saves.forEach(k => localStorage.removeItem(k));
        }
      }
    }
  }, []);

  return (
    <div>
      {!gameStarted ? (
        <StartScreen
          onStart={(name, cash, label, laps) => {
            setPlayerName(name);
            setAvatar(label);
            setStartingCash(cash);
            setTotalLaps(laps);
            setGameStarted(true);
          }}
        />
      ) : finalScoresVisible ? (
        <FinalScoreboard data={finalData} />
      ) : (
        <PlayerDashboard
          playerName={playerName}
          avatar={avatar}
          startingCash={startingCash}
          totalLaps={totalLaps}
          showFinal={(data) => {
            setFinalData(data);
            setFinalScoresVisible(true);
          }}
        />
      )}
    </div>
  );
}

export default App;
