import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '../store/useGameStore';
import type { Word } from '../types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle2, XCircle } from 'lucide-react';

const WordList: React.FC = () => {
  const words = useGameStore(state => state.words);

  return (
    <Card className="w-full bg-white/50 border-slate-200">
      <CardHeader>
        <CardTitle className="text-slate-700">Your Words</CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="space-y-2 h-48 overflow-y-auto pr-2">
          <AnimatePresence>
            {words.map((word: Word, index: number) => (
              <motion.li
                key={`${word.text}-${index}`}
                layout
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
                className={`flex justify-between items-center p-2 rounded-md ${
                  word.valid ? 'bg-green-100' : 'bg-red-100'
                }`}
              >
                <span className={`font-semibold ${
                  word.valid ? 'text-green-800' : 'text-red-800'
                }`}>
                  {word.text}
                </span>
                {word.valid ? 
                  <CheckCircle2 className="h-5 w-5 text-green-600" /> : 
                  <XCircle className="h-5 w-5 text-red-600" />
                }
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      </CardContent>
    </Card>
  );
};

export default WordList;