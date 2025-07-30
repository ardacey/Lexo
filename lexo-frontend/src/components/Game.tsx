import React, { useState } from 'react';
import { useGameSocket } from '../hooks/useGameSocket';
import type { UserState } from '../types';
import UsernameEntry from './UsernameEntry';
import Lobby from './Lobby';
import GameBoard from './GameBoard';
import GameOver from './GameOver';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Terminal } from "lucide-react";

const Game: React.FC = () => {
  const [user, setUser] = useState<UserState>({ username: null, currentRoomId: null });
  const { state, connectToRoom, sendWord, disconnect } = useGameSocket();

  const handleUsernameSubmit = (username: string) => {
    setUser({ ...user, username });
  };

  const handleJoinRoom = (roomId: string) => {
    if (!user.username) return;
    setUser({ ...user, currentRoomId: roomId });
    connectToRoom(roomId, user.username);
  };
  
  const handleLeaveRoom = () => {
    disconnect();
    setUser({ ...user, currentRoomId: null });
  };

  if (state.error) {
    return (
      <Alert variant="destructive" className="max-w-md">
        <Terminal className="h-4 w-4" />
        <AlertTitle>Connection Error</AlertTitle>
        <AlertDescription>
          {state.error} Please refresh the page and try again.
        </AlertDescription>
      </Alert>
    );
  }

  if (!user.username) {
    return <UsernameEntry onUsernameSubmit={handleUsernameSubmit} />;
  }

  if (!user.currentRoomId || !state.isConnected) {
    return (
      <div className="w-full max-w-2xl">
        <Lobby username={user.username} onJoinRoom={handleJoinRoom} />
      </div>
    );
  }

  if (user.currentRoomId && state.isConnected) {
    
    if (state.gameFinished) {
      return (
        <div className="w-full max-w-md">
           <GameOver 
              scores={state.finalScores} 
              winnerData={state.winnerData}
              isTie={state.isTie}
              reason={state.gameOverReason || undefined}
              onReturnToLobby={handleLeaveRoom} 
            />
        </div>
      );
    }
    
    return (
      <div className="w-full max-w-4xl">
        <GameBoard 
          state={state} 
          onSendWord={sendWord}
          username={user.username}
        />
        <div className="flex justify-center mt-6">
          <button 
            onClick={handleLeaveRoom} 
            className="text-slate-400 hover:text-red-400 transition-colors text-sm"
          >
            Leave Room & Return to Lobby
          </button>
        </div>
      </div>
    );
  }

  return <div>Loading...</div>;
};

export default Game;