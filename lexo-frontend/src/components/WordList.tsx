import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Word } from '../types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle2, XCircle } from 'lucide-react';

interface WordListProps {
  words: Word[];
}

const WordList: React.FC<WordListProps> = ({ words }) => (
  <Card className="w-full bg-white/50 border-slate-200">
    <CardHeader>
      <CardTitle>Your Words</CardTitle>
    </CardHeader>
    <CardContent>
      <ul className="space-y-2 h-48 overflow-y-auto pr-2">
        <AnimatePresence>
          {words.map((w, i) => (
            <motion.li
              key={`${w.text}-${i}`}
              layout
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
              className={`flex justify-between items-center p-2 rounded-md ${w.valid ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}
            >
              <span className="font-semibold">{w.text}</span>
              {w.valid ? 
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

export default WordList;