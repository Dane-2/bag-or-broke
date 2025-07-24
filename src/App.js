import React, { useState } from 'react';
import StartScreen from './components/StartScreen';
import PlayerDashboard from './components/PlayerDashboard';
import FinalScoreboard from './components/FinalScoreboard';

function App() {
  const [gameStarted, setGameStarted] = useState(false);
  const [playerName, setPlayerName] = useState('');
  const [startingCash, setStartingCash] = useState(null);
  const [avatar, setAvatar] = useState('');
  const [totalLaps, setTotalLaps] = useState(5); // ✅ default to 5
  const [finalScoresVisible, setFinalScoresVisible] = useState(false);
  const [finalData, setFinalData] = useState(null);

  return (
    <div>
      {!gameStarted ? (
        <StartScreen
          onStart={(name, cash, label, laps) => {
            setPlayerName(name);
            setAvatar(label);
            setStartingCash(cash);
            setTotalLaps(laps); // ✅ store laps from StartScreen
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
          totalLaps={totalLaps} // ✅ pass into PlayerDashboard
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
