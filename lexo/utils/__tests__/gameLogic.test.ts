/**
 * Unit tests for gameLogic utility functions
 */
import {
  generateLetterPool,
  generateBalancedPool,
  calculateScore,
  hasLettersInPool,
} from '../gameLogic';
import { VOWELS, CONSONANTS } from '../constants';

describe('gameLogic', () => {
  describe('generateLetterPool', () => {
    it('should generate pool with correct size', () => {
      const pool = generateLetterPool(16);
      expect(pool).toHaveLength(16);
    });

    it('should generate different pool sizes', () => {
      const pool10 = generateLetterPool(10);
      const pool20 = generateLetterPool(20);
      
      expect(pool10).toHaveLength(10);
      expect(pool20).toHaveLength(20);
    });

    it('should only contain lowercase letters', () => {
      const pool = generateLetterPool(50);
      pool.forEach(letter => {
        expect(letter).toMatch(/^[a-zçğıöşü]$/);
      });
    });

    it('should generate random pools', () => {
      const pool1 = generateLetterPool(16);
      const pool2 = generateLetterPool(16);
      
      // Pools should be different most of the time
      expect(pool1).not.toEqual(pool2);
    });
  });

  describe('generateBalancedPool', () => {
    it('should generate pool with correct size', () => {
      const pool = generateBalancedPool(16);
      expect(pool).toHaveLength(16);
    });

    it('should contain minimum vowels', () => {
      const pool = generateBalancedPool(16);
      const vowelCount = pool.filter(letter => VOWELS.includes(letter)).length;
      
      // Minimum 30% vowels = at least 4 for 16 letters
      expect(vowelCount).toBeGreaterThanOrEqual(4);
    });

    it('should contain minimum consonants', () => {
      const pool = generateBalancedPool(16);
      const consonantCount = pool.filter(letter => CONSONANTS.includes(letter)).length;
      
      // Minimum 50% consonants = at least 8 for 16 letters
      expect(consonantCount).toBeGreaterThanOrEqual(8);
    });

    it('should only contain lowercase letters', () => {
      const pool = generateBalancedPool(20);
      pool.forEach(letter => {
        expect(letter).toMatch(/^[a-zçğıöşü]$/);
      });
    });

    it('should generate different pools', () => {
      const pool1 = generateBalancedPool(16);
      const pool2 = generateBalancedPool(16);
      
      expect(pool1).not.toEqual(pool2);
    });
  });

  describe('calculateScore', () => {
    it('should return minimum score equal to word length', () => {
      expect(calculateScore('at')).toBeGreaterThanOrEqual(2);
      expect(calculateScore('ev')).toBeGreaterThanOrEqual(2);
      expect(calculateScore('masa')).toBeGreaterThanOrEqual(4);
    });

    it('should give bonus for longer words', () => {
      const shortScore = calculateScore('at');
      const mediumScore = calculateScore('kelime');
      const longScore = calculateScore('merhaba');
      
      expect(mediumScore).toBeGreaterThan(shortScore);
      expect(longScore).toBeGreaterThan(mediumScore);
    });

    it('should be case insensitive', () => {
      const lowerScore = calculateScore('kelime');
      const upperScore = calculateScore('KELIME');
      const mixedScore = calculateScore('KeLiMe');
      
      expect(lowerScore).toBe(upperScore);
      expect(lowerScore).toBe(mixedScore);
    });

    it('should always return positive score', () => {
      const words = ['a', 'at', 'ev', 'masa', 'kelime', 'deneme'];
      words.forEach(word => {
        expect(calculateScore(word)).toBeGreaterThan(0);
      });
    });

    it('should handle empty string', () => {
      expect(calculateScore('')).toBe(0);
    });

    it('should score 7+ letter words higher', () => {
      const sixLetter = calculateScore('kelime'); // 6 letters
      const sevenLetter = calculateScore('merhaba'); // 7 letters
      
      expect(sevenLetter).toBeGreaterThan(sixLetter);
    });
  });

  describe('hasLettersInPool', () => {
    it('should return true when word can be formed', () => {
      const pool = ['a', 't', 'e', 'v', 'm', 's', 'k'];
      
      expect(hasLettersInPool('at', pool)).toBe(true);
      expect(hasLettersInPool('ev', pool)).toBe(true);
      expect(hasLettersInPool('mas', pool)).toBe(true);
    });

    it('should return false when letters are missing', () => {
      const pool = ['a', 't', 'e', 'v'];
      
      expect(hasLettersInPool('kelime', pool)).toBe(false);
      expect(hasLettersInPool('masa', pool)).toBe(false);
    });

    it('should handle duplicate letters correctly', () => {
      const pool = ['a', 't', 'e', 'v', 'm'];
      
      // Word needs two 'a's but pool only has one
      expect(hasLettersInPool('atam', pool)).toBe(false);
      
      const poolWithDuplicates = ['a', 'a', 't', 'm'];
      expect(hasLettersInPool('atam', poolWithDuplicates)).toBe(true);
    });

    it('should be case insensitive', () => {
      const pool = ['a', 't', 'e', 'v'];
      
      expect(hasLettersInPool('AT', pool)).toBe(true);
      expect(hasLettersInPool('At', pool)).toBe(true);
      expect(hasLettersInPool('at', pool)).toBe(true);
    });

    it('should return true for empty word', () => {
      const pool = ['a', 't', 'e', 'v'];
      expect(hasLettersInPool('', pool)).toBe(true);
    });

    it('should not modify original pool', () => {
      const pool = ['a', 't', 'e', 'v', 'm'];
      const poolCopy = [...pool];
      
      hasLettersInPool('at', pool);
      
      expect(pool).toEqual(poolCopy);
    });

    it('should handle Turkish characters', () => {
      const pool = ['ş', 'ç', 'ı', 'ğ', 'ü', 'ö'];
      
      expect(hasLettersInPool('şç', pool)).toBe(true);
      expect(hasLettersInPool('ığ', pool)).toBe(true);
    });
  });
});
