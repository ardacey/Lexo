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
    let foundIndex = -1;
    for (let i = 0; i < availableLetters.length; i++) {
        if (availableLetters[i] === char) {
            foundIndex = i;
            break;
        }
    }

    if (foundIndex !== -1) {
      usedIndices.add(foundIndex);
      availableLetters[foundIndex] = ''; 
    }
  }

  return (
    <div className="flex justify-center items-center w-full my-6 min-h-[140px]">
      <motion.div
        className="flex flex-wrap justify-center items-center gap-2 max-w-5xl px-4"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        {letters.map((l, i) => {
          const isUsed = usedIndices.has(i);
          const displayLetter = l === 'i' ? 'İ' : l.toLocaleUpperCase('tr-TR');
          
          return (
            <motion.div
              key={i}
              className={`
                w-12 h-14 flex items-center justify-center font-bold text-xl rounded-lg border-b-4 transition-all duration-200
                ${isUsed 
                  ? 'bg-slate-200 border-slate-400 text-slate-500 scale-90 shadow-inner' 
                  : 'bg-gradient-to-b from-white to-slate-50 border-cyan-400 text-cyan-800 cursor-pointer shadow-lg hover:shadow-xl'
                }
              `}
              variants={letterVariants}
              whileHover={!isUsed ? { 
                scale: 1.1, 
                y: -6, 
                backgroundColor: '#ecfeff',
                borderColor: '#22d3ee'
              } : {}}
              transition={{ type: 'spring', stiffness: 400, damping: 25 }}
            >
              {displayLetter}
            </motion.div>
          );
        })}
      </motion.div>
    </div>
  );
};

export default LetterPool;