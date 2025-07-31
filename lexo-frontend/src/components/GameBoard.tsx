import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '../store/useGameStore';
import Scoreboard from './Scoreboard';
import LetterPool from './LetterPool';
import WordInput from './WordInput';
import WordList from './WordList';
import OpponentWordList from './OpponentWordList';
interface GameBoardProps {
  username: string | null;
}

const GameBoard: React.FC<GameBoardProps> = ({ username }) => {
  const countdown = useGameStore(state => state.countdown);
  const gameStarted = useGameStore(state => state.gameStarted);
  const timeLeft = useGameStore(state => state.timeLeft);
  const letterPool = useGameStore(state => state.letterPool);
  const isViewer = useGameStore(state => state.isViewer);
  const sendWord = useGameStore(state => state.sendWord);
  const [currentWord, setCurrentWord] = useState('');

  const handleSendWord = () => {
    if (!currentWord.trim() || isViewer) return;
    sendWord(currentWord);
  
    setCurrentWord('');
  };

  return (
    <div className="relative w-full flex flex-col items-center space-y-4">
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
        <Scoreboard username={username} />
        
        <div className="w-full flex justify-center min-h-[80px] items-center my-4">
          {!gameStarted && countdown === null ? (
            <div className="text-2xl text-slate-500 animate-pulse">
              Waiting for opponent...
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
        
        <div className="w-full grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
          <WordList />
          <OpponentWordList />
        </div>
      </div>
    </div>
  );
};

export default GameBoard;