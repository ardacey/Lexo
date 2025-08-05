import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '../store/useGameStore';
import type { OpponentWord } from '../types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle2 } from 'lucide-react';

const OpponentWordList: React.FC = () => {
  const opponentWords = useGameStore(state => state.opponentWords);
  const isViewer = useGameStore(state => state.isViewer);
  const scores = useGameStore(state => state.scores);

  const getTitle = () => {
    if (isViewer) {
      const sortedScores = (scores || []).sort((a, b) => b.score - a.score);
      const secondaryPlayer = sortedScores.length > 1 ? sortedScores[1].username : null;
      
      if (opponentWords.length > 0 && opponentWords[0].player) {
        return `${opponentWords[0].player}'s Words`;
      } else if (secondaryPlayer) {
        return `${secondaryPlayer}'s Words`;
      }
      return "Player 2's Words";
    }
    return "Opponent's Words";
  };

  return (
    <Card className="w-full bg-white/50 border-slate-200">
      <CardHeader>
        <CardTitle className="text-slate-700">{getTitle()}</CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="space-y-2 h-48 overflow-y-auto pr-2">
          {opponentWords.length > 0 ? (
            <AnimatePresence>
              {opponentWords.map((word: OpponentWord, index: number) => (
                <motion.li
                  key={`${word.word}-${index}`}
                  layout
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.3 }}
                  className="flex justify-between items-center p-2 rounded-md bg-slate-100"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-600">
                      {word.word}
                    </span>
                    <span className="text-xs bg-slate-200 text-slate-600 px-1 rounded">
                      +{word.score}
                    </span>
                  </div>
                  <CheckCircle2 className="h-5 w-5 text-slate-400" />
                </motion.li>
              ))}
            </AnimatePresence>
          ) : null}
        </ul>
      </CardContent>
    </Card>
  );
};

export default OpponentWordList;