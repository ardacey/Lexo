import { useState, useCallback } from 'react';
import Toast from 'react-native-toast-message';
import { generateBalancedPool, calculateScore, hasLettersInPool, replaceLetters } from '../utils/gameLogic';
import { isValidWord } from '../utils/words';

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

  const submitWord = useCallback((word?: string): boolean => {
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

    if (!isValidWord(wordToSubmit)) {
      Toast.show({
        type: 'error',
        text1: 'Hata',
        text2: 'Geçerli bir Türkçe kelime değil',
        position: 'top',
        visibilityTime: 2000,
      });
      return false;
    }

    // Skoru hesapla
    const score = calculateScore(wordToSubmit);

    // State'leri güncelle
    const newWord: Word = { text: wordToSubmit, score };
    setWords(prev => [...prev, newWord]);
    setTotalScore(prev => prev + score);
    setUsedWords(prev => new Set([...prev, wordToSubmit]));

    // Harf havuzunu güncelle
    const newPool = replaceLetters(wordToSubmit, letterPool);
    setLetterPool(newPool);

    // Input'u temizle
    setCurrentWord('');

    // Başarı mesajı
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
