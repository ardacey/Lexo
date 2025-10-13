/**
 * Unit tests for useGameState hook
 */
import { renderHook, act } from '@testing-library/react-native';
import { useGameState } from '../useGameState';
import * as api from '../../utils/api';
import Toast from 'react-native-toast-message';

// Mock dependencies
jest.mock('../../utils/api');
jest.mock('react-native-toast-message');

describe('useGameState', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('initializeGame', () => {
    it('should initialize game with correct pool size', () => {
      const { result } = renderHook(() => useGameState(16));
      
      act(() => {
        result.current.initializeGame();
      });
      
      expect(result.current.letterPool).toHaveLength(16);
      expect(result.current.words).toHaveLength(0);
      expect(result.current.totalScore).toBe(0);
      expect(result.current.currentWord).toBe('');
    });

    it('should reset game state', () => {
      const { result } = renderHook(() => useGameState(16));
      
      // Set some state
      act(() => {
        result.current.initializeGame();
        result.current.setCurrentWord('test');
      });
      
      expect(result.current.currentWord).toBe('test');
      
      // Reset
      act(() => {
        result.current.initializeGame();
      });
      
      expect(result.current.currentWord).toBe('');
      expect(result.current.words).toHaveLength(0);
      expect(result.current.totalScore).toBe(0);
    });

    it('should generate different pools on each initialization', () => {
      const { result } = renderHook(() => useGameState(16));
      
      let pool1: string[];
      let pool2: string[];
      
      act(() => {
        result.current.initializeGame();
        pool1 = [...result.current.letterPool];
      });
      
      act(() => {
        result.current.initializeGame();
        pool2 = [...result.current.letterPool];
      });
      
      expect(pool1).not.toEqual(pool2);
    });
  });

  describe('submitWord', () => {
    beforeEach(() => {
      (api.validateWord as jest.Mock).mockResolvedValue({
        valid: true,
        message: 'Kelime geçerli'
      });
    });

    it('should reject empty word', async () => {
      const { result } = renderHook(() => useGameState(16));
      
      act(() => {
        result.current.initializeGame();
      });
      
      let success: boolean = false;
      await act(async () => {
        success = await result.current.submitWord('');
      });
      
      expect(success).toBe(false);
    });

    it('should reject word less than 2 letters', async () => {
      const { result } = renderHook(() => useGameState(16));
      
      act(() => {
        result.current.initializeGame();
      });
      
      let success: boolean = false;
      await act(async () => {
        success = await result.current.submitWord('a');
      });
      
      expect(success).toBe(false);
      expect(Toast.show).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'error',
          text2: 'Kelime en az 2 harf olmalıdır'
        })
      );
    });

    it('should reject already used word', async () => {
      const { result } = renderHook(() => useGameState(16));
      
      act(() => {
        result.current.initializeGame();
        // Use pool that contains 'test' letters
        result.current.setLetterPool(['t', 'e', 's', 't', 'a', 'b', 'c', 'd']);
      });
      
      // Submit word first time
      await act(async () => {
        await result.current.submitWord('test');
      });
      
      // Try to submit same word again
      let success: boolean = false;
      await act(async () => {
        success = await result.current.submitWord('test');
      });
      
      expect(success).toBe(false);
      expect(Toast.show).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'error',
          text2: 'Bu kelimeyi zaten kullandınız'
        })
      );
    });

    it('should reject word with letters not in pool', async () => {
      const { result } = renderHook(() => useGameState(16));
      
      act(() => {
        result.current.initializeGame();
        result.current.setLetterPool(['a', 'b', 'c', 'd']);
      });
      
      let success: boolean = false;
      await act(async () => {
        success = await result.current.submitWord('xyz');
      });
      
      expect(success).toBe(false);
      expect(Toast.show).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'error',
          text2: 'Havuzda yeterli harf yok'
        })
      );
    });

    it('should reject invalid Turkish word', async () => {
      (api.validateWord as jest.Mock).mockResolvedValue({
        valid: false,
        message: 'Geçerli bir Türkçe kelime değil'
      });
      
      const { result } = renderHook(() => useGameState(16));
      
      act(() => {
        result.current.initializeGame();
        result.current.setLetterPool(['x', 'y', 'z', 'a', 'b', 'c']);
      });
      
      let success: boolean = false;
      await act(async () => {
        success = await result.current.submitWord('xyz');
      });
      
      expect(success).toBe(false);
    });

    it('should accept and score valid word', async () => {
      const { result } = renderHook(() => useGameState(16));
      
      act(() => {
        result.current.initializeGame();
        result.current.setLetterPool(['t', 'e', 's', 't', 'a', 'b']);
      });
      
      const initialScore = result.current.totalScore;
      
      await act(async () => {
        await result.current.submitWord('test');
      });
      
      expect(result.current.words).toHaveLength(1);
      expect(result.current.words[0].text).toBe('test');
      expect(result.current.totalScore).toBeGreaterThan(initialScore);
      expect(result.current.currentWord).toBe('');
    });

    it('should show success toast on valid submission', async () => {
      const { result } = renderHook(() => useGameState(16));
      
      act(() => {
        result.current.initializeGame();
        result.current.setLetterPool(['t', 'e', 's', 't', 'a', 'b']);
      });
      
      await act(async () => {
        await result.current.submitWord('test');
      });
      
      expect(Toast.show).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'success',
          text1: 'Harika!'
        })
      );
    });

    it('should handle case insensitive word submission', async () => {
      const { result } = renderHook(() => useGameState(16));
      
      act(() => {
        result.current.initializeGame();
        result.current.setLetterPool(['t', 'e', 's', 't', 'a', 'b']);
      });
      
      await act(async () => {
        await result.current.submitWord('TEST');
      });
      
      expect(result.current.words[0].text).toBe('test');
    });
  });

  describe('state management', () => {
    it('should update currentWord', () => {
      const { result } = renderHook(() => useGameState(16));
      
      act(() => {
        result.current.setCurrentWord('test');
      });
      
      expect(result.current.currentWord).toBe('test');
    });

    it('should track total score correctly', async () => {
      const { result } = renderHook(() => useGameState(16));
      
      act(() => {
        result.current.initializeGame();
        result.current.setLetterPool(['a', 't', 'e', 'v', 'm', 's', 'k', 'l']);
      });
      
      await act(async () => {
        await result.current.submitWord('at');
      });
      
      const scoreAfterFirst = result.current.totalScore;
      
      await act(async () => {
        await result.current.submitWord('ev');
      });
      
      expect(result.current.totalScore).toBeGreaterThan(scoreAfterFirst);
    });
  });
});
