import React, { useCallback, useState } from 'react';
import { useGameStore } from '../store/useGameStore';
import { useAuth } from '../hooks/useAuth';
import { AuthModal } from './AuthModal';
import Lobby from './Lobby';
import GameBoard from './GameBoard';
import GameOver from './GameOver';
import PracticeMode from './PracticeMode';

const Game: React.FC = () => {
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [gameMode, setGameMode] = useState<'lobby' | 'practice'>('lobby');
  const { user, isAuthenticated } = useAuth();
  const isConnected = useGameStore(state => state.isConnected);
  const gameFinished = useGameStore(state => state.gameFinished);
  const isViewer = useGameStore(state => state.isViewer);
  const disconnect = useGameStore(state => state.disconnect);
  
  const handleLeaveRoom = useCallback(() => {
    disconnect();
    setGameMode('lobby');
  }, [disconnect]);

  if (!isAuthenticated || !user) {
    return (
      <div className="w-full max-w-md mx-auto">
        <div className="text-center mb-6">
          <h1 className="text-3xl font-bold text-slate-800 mb-2">Lexo</h1>
          <p className="text-slate-600">Please login or register to play</p>
        </div>
        
        <div className="flex space-x-4 justify-center">
          <button
            onClick={() => {
              setAuthMode('login');
              setShowAuthModal(true);
            }}
            className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
          >
            Login
          </button>
          <button
            onClick={() => {
              setAuthMode('register');
              setShowAuthModal(true);
            }}
            className="px-6 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
          >
            Register
          </button>
        </div>

        <AuthModal
          isOpen={showAuthModal}
          onClose={() => setShowAuthModal(false)}
          mode={authMode}
          onModeChange={setAuthMode}
        />
      </div>
    );
  }

  if (isConnected) {
    return (
      <div className="w-full max-w-4xl">
        {isViewer && (
          <div className="mb-4 p-3 bg-blue-100 border border-blue-300 rounded-md text-center">
            <span className="text-blue-800 font-medium">You are viewing this game</span>
          </div>
        )}
        {gameFinished ? (
          <div className="w-full flex justify-center">
            <GameOver onReturnToLobby={handleLeaveRoom} />
          </div>
        ) : (
          <>
            <GameBoard username={user.username} />
            <div className="flex justify-center mt-6">
              <button onClick={handleLeaveRoom} className="text-slate-400 hover:text-red-400 transition-colors text-sm">
                {isViewer ? 'Stop Viewing' : 'Leave Room'}
              </button>
            </div>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="w-full max-w-2xl">
      {gameMode === 'practice' ? (
        <PracticeMode onBack={() => setGameMode('lobby')} />
      ) : (
        <Lobby onPracticeMode={() => setGameMode('practice')} />
      )}
    </div>
  );
};

export default Game;