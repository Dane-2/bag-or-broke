import React, { useState } from 'react';
import StartScreen from './components/StartScreen';
import PlayerDashboard from './components/PlayerDashboard';
import FinalScoreboard from './components/FinalScoreboard';

function App() {
  const [gameStarted, setGameStarted] = useState(false);
  const [playerName, setPlayerName] = useState('');
  const [startingCash, setStartingCash] = useState(null);
  const [avatar, setAvatar] = useState(''); // NIL Tier label
  const [finalScoresVisible, setFinalScoresVisible] = useState(false);
  const [finalData, setFinalData] = useState(null);

  return (
    <div>
      {!gameStarted ? (
        <StartScreen
          onStart={(name, cash, label) => {
            setPlayerName(name);
            setAvatar(label); // <- use NIL Tier label
            setStartingCash(cash);
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
