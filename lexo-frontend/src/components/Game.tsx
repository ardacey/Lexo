import React, { useState, useCallback } from 'react';
import { useGameStore } from '../store/useGameStore';
import UsernameEntry from './UsernameEntry';
import Lobby from './Lobby';
import GameBoard from './GameBoard';
import GameOver from './GameOver';

const Game: React.FC = () => {
  const [username, setUsername] = useState<string | null>(null);
  const isConnected = useGameStore(state => state.isConnected);
  const gameFinished = useGameStore(state => state.gameFinished);
  const disconnect = useGameStore(state => state.disconnect);
  
  const handleLeaveRoom = useCallback(() => {
    disconnect();
  }, [disconnect]);

  if (!username) {
    return <UsernameEntry onUsernameSubmit={setUsername} />;
  }

  if (isConnected) {
    return (
      <div className="w-full max-w-4xl">
        {gameFinished ? (
          <div className="w-full flex justify-center">
            <GameOver onReturnToLobby={handleLeaveRoom} />
          </div>
        ) : (
          <>
            <GameBoard username={username} />
            <div className="flex justify-center mt-6">
              <button onClick={handleLeaveRoom} className="text-slate-400 hover:text-red-400 transition-colors text-sm">
                Leave Room
              </button>
            </div>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="w-full max-w-2xl">
      <Lobby username={username} />
    </div>
  );
};

export default Game;