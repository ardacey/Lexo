import React from 'react';
import { motion } from 'framer-motion';

interface LetterPoolProps {
  letters: string[];
  currentWord: string;
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05,
    },
  },
};

const letterVariants = {
  hidden: { y: 20, opacity: 0 },
  visible: { y: 0, opacity: 1 },
};

const LetterPool: React.FC<LetterPoolProps> = ({ letters, currentWord }) => {
  const availableLetters = [...letters];
  const usedIndices = new Set<number>();

  for (const char of currentWord.toLowerCase()) {
    const index = availableLetters.findIndex(l => l === char);
    if (index !== -1) {
      usedIndices.add(index);
      availableLetters[index] = ''; 
    }
  }

  return (
    <motion.div
      className="flex justify-center items-center gap-2 my-6 flex-wrap"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {letters.map((l, i) => {
        const isUsed = usedIndices.has(i);
        
        return (
          <motion.div
            key={i}
            className={`
              w-12 h-14 flex items-center justify-center font-bold text-2xl rounded-md border-b-4 transition-all duration-200
              ${isUsed 
                ? 'bg-slate-300 border-slate-400 text-slate-400 scale-90' 
                : 'bg-white border-slate-300 text-cyan-700 cursor-pointer shadow-md'
              }
            `}
            variants={letterVariants}
            whileHover={!isUsed ? { scale: 1.1, y: -5, backgroundColor: '#cffafe' } : {}}
          >
            {l === 'i' ? 'İ' : l.toLocaleUpperCase('tr-TR')}
          </motion.div>
        );
      })}
    </motion.div>
  );
};

export default LetterPool;