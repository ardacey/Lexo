import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '../store/useGameStore';
import { validateWord } from '../utils/validation';
import { toast } from 'sonner';
import Scoreboard from './Scoreboard';
import LetterPool from './LetterPool';
import WordInput from './WordInput';
import WordList from './WordList';
import OpponentWordList from './OpponentWordList';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Trophy, Users } from 'lucide-react';
interface GameBoardProps {
  username: string | null;
}

const GameBoard: React.FC<GameBoardProps> = ({ username }) => {
  const countdown = useGameStore(state => state.countdown);
  const gameStarted = useGameStore(state => state.gameStarted);
  const timeLeft = useGameStore(state => state.timeLeft);
  const letterPool = useGameStore(state => state.letterPool);
  const isViewer = useGameStore(state => state.isViewer);
  const isOwner = useGameStore(state => state.isOwner);
  const roomStatus = useGameStore(state => state.roomStatus);
  const activePlayers = useGameStore(state => state.activePlayers);
  const sendWord = useGameStore(state => state.sendWord);
  const startGame = useGameStore(state => state.startGame);
  const leaderboard = useGameStore(state => state.leaderboard);
  const gameMode = useGameStore(state => state.gameMode);
  const [currentWord, setCurrentWord] = useState('');

  const handleSendWord = () => {
    if (!currentWord.trim() || isViewer) return;

    const validation = validateWord(currentWord.trim());
    if (!validation.valid) {
      toast.error(validation.message || 'Invalid word');
      return;
    }
    
    sendWord(currentWord);
    setCurrentWord('');
  };

  const handleStartGame = () => {
    startGame();
  };

  const showStartButton = (
    gameMode === 'battle_royale' && 
    isOwner && 
    !isViewer &&
    !gameStarted && 
    countdown === null &&
    roomStatus === 'waiting' &&
    activePlayers.length >= 3
  );

  return (
    <div className="relative w-full max-w-6xl mx-auto flex flex-col items-center space-y-4">
      <AnimatePresence>
        {countdown !== null && (
          <motion.div
            key="countdown-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="absolute inset-0 bg-slate-900/80 backdrop-blur-sm flex flex-col items-center justify-center z-20 rounded-lg"
          >
            <p className="text-xl text-slate-300 mb-4">Game Starting In</p>
            <AnimatePresence mode="popLayout">
              <motion.div
                key={countdown}
                initial={{ opacity: 0, scale: 0.5, y: 50 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 2 }}
                transition={{ type: 'spring', stiffness: 200, damping: 20 }}
                className="text-8xl font-bold text-white"
              >
                {countdown}
              </motion.div>
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>
      <div className="w-full z-10 flex flex-col items-center">
        {gameMode === 'battle_royale' && leaderboard && leaderboard.length > 0 && (
          <div className="w-full max-w-sm mb-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Trophy className="h-5 w-5 text-yellow-500" />
                  <span className="font-semibold">Leaderboard</span>
                  <Badge variant="outline" className="ml-auto">
                    <Users className="h-3 w-3 mr-1" />
                    {leaderboard.filter(p => !p.is_eliminated).length} alive
                  </Badge>
                </div>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {leaderboard.slice(0, 10).map((player, index) => (
                    <div
                      key={player.username}
                      className={`flex items-center justify-between p-2 rounded text-sm ${
                        player.is_eliminated
                          ? 'bg-red-50 text-red-700'
                          : index < 3
                          ? 'bg-yellow-50 text-yellow-800'
                          : 'bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-medium">#{index + 1}</span>
                        <span className={player.username === username ? 'font-bold' : ''}>
                          {player.username}
                        </span>
                        {player.is_eliminated && (
                          <Badge variant="destructive" className="text-xs">OUT</Badge>
                        )}
                      </div>
                      <span className="font-medium">{player.score}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        )}
        
        <Scoreboard username={username} />
        
        <div className="w-full flex flex-col justify-center items-center min-h-[80px] my-4">
          {!gameStarted && countdown === null ? (
            <div className="flex flex-col items-center space-y-4">
              <div className="text-2xl text-slate-500 animate-pulse">
                {gameMode === 'battle_royale' ? 'Waiting for players...' : 'Waiting for opponent...'}
              </div>
              {showStartButton && (
                <motion.button
                  onClick={handleStartGame}
                  className="px-6 py-3 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg shadow-lg transition-colors"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  Start Game
                </motion.button>
              )}
              {gameMode === 'battle_royale' && !isViewer && (
                <div className="text-sm text-slate-400 text-center">
                  {activePlayers.length < 3 ? (
                    `Need ${3 - activePlayers.length} more player${3 - activePlayers.length === 1 ? '' : 's'} to start`
                  ) : isOwner ? (
                    'You can start the game when ready'
                  ) : (
                    'Waiting for room owner to start the game'
                  )}
                </div>
              )}
            </div>
          ) : (
            <LetterPool 
              letters={letterPool} 
              currentWord={currentWord}
            />
          )}
        </div>
        
        <WordInput
          value={currentWord}
          onChange={setCurrentWord}
          onSendWord={handleSendWord}
          disabled={!gameStarted || timeLeft === 0}
          isViewer={isViewer}
        />
        
        <div className={`w-full grid gap-4 mt-4 ${
          gameMode === 'battle_royale' 
            ? 'grid-cols-1' 
            : 'grid-cols-1 md:grid-cols-2'
        }`}>
          <WordList />
          {gameMode !== 'battle_royale' && <OpponentWordList />}
        </div>
      </div>
    </div>
  );
};

export default GameBoard;