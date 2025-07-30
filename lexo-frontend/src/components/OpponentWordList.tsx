import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Word } from '../types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle2 } from 'lucide-react';

interface OpponentWordListProps {
  words: Word[];
}

const OpponentWordList: React.FC<OpponentWordListProps> = ({ words = [] }) => (
  <Card className="w-full bg-white/50 border-slate-200">
    <CardHeader>
      <CardTitle className="text-slate-700">Opponent's Words</CardTitle>
    </CardHeader>
    <CardContent>
      <ul className="space-y-2 h-48 overflow-y-auto pr-2">
        {words.length > 0 ? (
          <AnimatePresence>
            {words.map((w, i) => (
              <motion.li
                key={`${w.text}-${i}`}
                layout
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
                className="flex justify-between items-center p-2 rounded-md bg-slate-100"
              >
                <span className="font-semibold text-slate-600">
                  {w.text}
                </span>
                <CheckCircle2 className="h-5 w-5 text-slate-400" />
              </motion.li>
            ))}
          </AnimatePresence>
        ) : (
          <div className="flex items-center justify-center h-full text-slate-500">
            Waiting for opponent to play...
          </div>
        )}
      </ul>
    </CardContent>
  </Card>
);

export default OpponentWordList;