import { LETTER_FREQUENCY, LETTER_SCORES, VOWELS, CONSONANTS } from './constants';

export const generateLetterPool = (count: number): string[] => {
  const letters = Object.keys(LETTER_FREQUENCY);
  const weights = Object.values(LETTER_FREQUENCY);
  const totalWeight = weights.reduce((a, b) => a + b, 0);
  const pool: string[] = [];
  
  for (let i = 0; i < count; i++) {
    const random = Math.random() * totalWeight;
    let sum = 0;
    for (let j = 0; j < weights.length; j++) {
      sum += weights[j];
      if (random <= sum) {
        pool.push(letters[j]);
        break;
      }
    }
  }
  
  return pool;
};

export const generateBalancedPool = (size: number): string[] => {
  const pool: string[] = [];
  const minVowels = Math.floor(size * 0.3);
  const minConsonants = Math.floor(size * 0.5);
  
  for (let i = 0; i < minVowels; i++) {
    const randomVowel = VOWELS[Math.floor(Math.random() * VOWELS.length)];
    pool.push(randomVowel);
  }
  
  for (let i = 0; i < minConsonants; i++) {
    const randomConsonant = CONSONANTS[Math.floor(Math.random() * CONSONANTS.length)];
    pool.push(randomConsonant);
  }
  
  const remaining = size - pool.length;
  pool.push(...generateLetterPool(remaining));
  
  return pool.sort(() => Math.random() - 0.5);
};

export const calculateScore = (word: string): number => {
  const wordLower = word.toLowerCase();
  const wordLength = wordLower.length;
  
  let baseScore = 0;
  for (const char of wordLower) {
    baseScore += LETTER_SCORES[char] || 0;
  }
  
  let lengthBonus = 0;
  if (wordLength >= 5) {
    lengthBonus = (wordLength - 4) * 2;
  }
  if (wordLength >= 7) {
    lengthBonus += (wordLength - 6) * 3;
  }
  
  const totalScore = Math.floor(baseScore + lengthBonus);
  return Math.max(totalScore, wordLength);
};

export const hasLettersInPool = (word: string, pool: string[]): boolean => {
  const poolCounts: Record<string, number> = {};
  for (const char of pool) {
    poolCounts[char] = (poolCounts[char] || 0) + 1;
  }

  for (const letter of word.toLowerCase()) {
    if (!poolCounts[letter]) {
      return false;
    }
    poolCounts[letter]--;
  }
  return true;
};