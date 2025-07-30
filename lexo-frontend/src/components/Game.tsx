import React, { useEffect, useState, useCallback } from 'react';
import { useGameSocket } from '../hooks/useGameSocket';
import type { UserState } from '../types';
import UsernameEntry from './UsernameEntry';
import Lobby from './Lobby';
import GameBoard from './GameBoard';
import GameOver from './GameOver';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Terminal } from "lucide-react";
import { Loader2 } from 'lucide-react'; 

const Game: React.FC = () => {
  const [user, setUser] = useState<UserState>({ username: null, currentRoomId: null });
  const [isConnecting, setIsConnecting] = useState(false);
  const { state, connectToRoom, sendWord, disconnect } = useGameSocket();

  const handleUsernameSubmit = useCallback((username: string) => {
    setUser(prevUser => ({ ...prevUser, username }));
  }, []);

  const handleJoinRoom = useCallback((roomId: string) => {
    setUser(prevUser => {
      if (!prevUser.username) return prevUser;
      setIsConnecting(true);
      connectToRoom(roomId, prevUser.username);
      return { ...prevUser, currentRoomId: roomId };
    });
  }, [connectToRoom]);
  
  const handleLeaveRoom = useCallback(() => {
    disconnect();
    setUser(prevUser => ({ ...prevUser, currentRoomId: null }));
    setIsConnecting(false);
  }, [disconnect]);

  useEffect(() => {
    if (isConnecting) {
      if (state.isConnected) {
        setIsConnecting(false);
      }
      if (state.error) {
        handleLeaveRoom();
      }
    }
  }, [isConnecting, state.isConnected, state.error, handleLeaveRoom]);

  if (state.error && !isConnecting) {
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

  if (isConnecting) {
    return (
      <div className="flex flex-col items-center justify-center h-64">
        <Loader2 className="animate-spin h-8 w-8 text-slate-400" />
        <p className="mt-4 text-slate-500">Connecting to the room...</p>
      </div>
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