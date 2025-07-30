import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { GameState } from '../types';
import Scoreboard from './Scoreboard';
import LetterPool from './LetterPool';
import WordInput from './WordInput';
import WordList from './WordList';
import OpponentWordList from './OpponentWordList';

interface GameBoardProps {
  state: GameState;
  onSendWord: (word: string) => void;
  username: string | null;
}

const GameBoard: React.FC<GameBoardProps> = ({ state, onSendWord, username }) => {
  const [currentWord, setCurrentWord] = useState('');

  const handleSendWord = () => {
    onSendWord(currentWord);
    setCurrentWord('');
  };

  return (
    <div className="relative w-full flex flex-col items-center space-y-4">

      <AnimatePresence>
        {state.countdown !== null && (
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
                key={state.countdown}
                initial={{ opacity: 0, scale: 0.5, y: 50 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 2 }}
                transition={{ type: 'spring', stiffness: 200, damping: 20 }}
                className="text-8xl font-bold text-white"
              >
                {state.countdown}
              </motion.div>
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="w-full z-10 flex flex-col items-center">
        <Scoreboard state={state} username={username} />
        
        <div className="w-full flex justify-center min-h-[80px] items-center my-4">
          {!state.gameStarted && state.countdown === null && (
            <div className="text-2xl text-slate-500 animate-pulse">
              Waiting for opponent...
            </div>
          )}

          {state.gameStarted && (
            <LetterPool 
              letters={state.letterPool} 
              currentWord={currentWord}
            />
          )}
        </div>
        
        <WordInput
          value={currentWord}
          onChange={setCurrentWord}
          onSendWord={handleSendWord}
          disabled={!state.gameStarted || state.timeLeft === 0}
        />
        
        <div className="w-full grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
          <WordList words={state.words} />
          <OpponentWordList words={state.opponentWords} />
        </div>
      </div>
    </div>
  );
};

export default GameBoard;