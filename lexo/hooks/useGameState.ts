import { useState, useCallback } from 'react';
import Toast from 'react-native-toast-message';
import { generateBalancedPool, calculateScore, hasLettersInPool } from '../utils/gameLogic';
import { validateWord } from '../utils/api';

export interface Word {
  text: string;
  score: number;
}

export const useGameState = (poolSize: number = 16) => {
  const [letterPool, setLetterPool] = useState<string[]>([]);
  const [currentWord, setCurrentWord] = useState('');
  const [words, setWords] = useState<Word[]>([]);
  const [totalScore, setTotalScore] = useState(0);
  const [usedWords, setUsedWords] = useState<Set<string>>(new Set());

  const initializeGame = useCallback(() => {
    const pool = generateBalancedPool(poolSize);
    setLetterPool(pool);
    setCurrentWord('');
    setWords([]);
    setTotalScore(0);
    setUsedWords(new Set());
  }, [poolSize]);

  const submitWord = useCallback(async (word?: string): Promise<boolean> => {
    const wordToSubmit = (word || currentWord).toLowerCase().trim();

    if (!wordToSubmit) return false;

    if (wordToSubmit.length < 2) {
      Toast.show({
        type: 'error',
        text1: 'Hata',
        text2: 'Kelime en az 2 harf olmalıdır',
        position: 'top',
        visibilityTime: 2000,
      });
      return false;
    }

    if (usedWords.has(wordToSubmit)) {
      Toast.show({
        type: 'error',
        text1: 'Hata',
        text2: 'Bu kelimeyi zaten kullandınız',
        position: 'top',
        visibilityTime: 2000,
      });
      return false;
    }

    if (!hasLettersInPool(wordToSubmit, letterPool)) {
      Toast.show({
        type: 'error',
        text1: 'Hata',
        text2: 'Havuzda yeterli harf yok',
        position: 'top',
        visibilityTime: 2000,
      });
      return false;
    }

    const validation = await validateWord(wordToSubmit);
    
    if (!validation.valid) {
      Toast.show({
        type: 'error',
        text1: 'Hata',
        text2: validation.message,
        position: 'top',
        visibilityTime: 2000,
      });
      return false;
    }

    const score = calculateScore(wordToSubmit);

    const newWord: Word = { text: wordToSubmit, score };
    setWords(prev => [...prev, newWord]);
    setTotalScore(prev => prev + score);
    setUsedWords(prev => new Set([...prev, wordToSubmit]));

    setCurrentWord('');

    Toast.show({
      type: 'success',
      text1: 'Harika!',
      text2: `+${score} puan!`,
      position: 'top',
      visibilityTime: 1500,
    });
    return true;
  }, [currentWord, letterPool, usedWords]);

  return {
    letterPool,
    setLetterPool,
    currentWord,
    setCurrentWord,
    words,
    totalScore,
    usedWords,
    initializeGame,
    submitWord,
  };
};
