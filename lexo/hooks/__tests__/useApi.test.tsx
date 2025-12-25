import React from 'react';
import { renderHook, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  useValidateWord,
  useCreateUser,
  useUserStats,
  useUserGames,
  useLeaderboard,
  useSaveGame,
  queryKeys,
} from '../useApi';
import * as api from '../../utils/api';

// Mock the API utilities
jest.mock('../../utils/api');

// Mock the AuthContext
jest.mock('../../context/AuthContext', () => ({
  useAuth: () => ({
    getToken: jest.fn().mockResolvedValue(undefined),
  }),
}));

const mockValidateWord = api.validateWord as jest.MockedFunction<typeof api.validateWord>;
const mockCreateUser = api.createUser as jest.MockedFunction<typeof api.createUser>;
const mockGetUserStats = api.getUserStats as jest.MockedFunction<typeof api.getUserStats>;
const mockGetUserGames = api.getUserGames as jest.MockedFunction<typeof api.getUserGames>;
const mockGetLeaderboard = api.getLeaderboard as jest.MockedFunction<typeof api.getLeaderboard>;
const mockSaveGame = api.saveGame as jest.MockedFunction<typeof api.saveGame>;

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
      mutations: {
        retry: false,
      },
    },
  });
  const TestWrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  TestWrapper.displayName = 'TestWrapper';
  return TestWrapper;
};

describe('useApi hooks', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('useValidateWord', () => {
    it('validates a word successfully', async () => {
      const mockResponse = { valid: true, message: 'Valid word' };
      mockValidateWord.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => useValidateWord(), {
        wrapper: createWrapper(),
      });

      result.current.mutate('test');

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(mockValidateWord).toHaveBeenCalledWith('test', undefined);
      expect(result.current.data).toEqual(mockResponse);
    });

    it('handles validation error', async () => {
      const mockError = new Error('Invalid word');
      mockValidateWord.mockRejectedValue(mockError);

      const { result } = renderHook(() => useValidateWord(), {
        wrapper: createWrapper(),
      });

      result.current.mutate('invalid');

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.error).toEqual(mockError);
    });
  });

  describe('useCreateUser', () => {
    it('creates a user successfully', async () => {
      const mockUser = { id: 1, user_id: 'user_123', username: 'testuser' };
      mockCreateUser.mockResolvedValue(mockUser);

      const { result } = renderHook(() => useCreateUser(), {
        wrapper: createWrapper(),
      });

      result.current.mutate({
        userId: 'user_123',
        username: 'testuser',
        email: 'test@example.com',
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(mockCreateUser).toHaveBeenCalledWith('user_123', 'testuser', 'test@example.com', undefined);
      expect(result.current.data).toEqual(mockUser);
    });

    it('handles creation error', async () => {
      const mockError = new Error('User already exists');
      mockCreateUser.mockRejectedValue(mockError);

      const { result } = renderHook(() => useCreateUser(), {
        wrapper: createWrapper(),
      });

      result.current.mutate({
        userId: 'user_123',
        username: 'testuser',
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.error).toEqual(mockError);
    });
  });

  describe('useUserStats', () => {
    it('fetches user stats successfully', async () => {
      const mockStats: api.UserStats = {
        total_games: 10,
        wins: 7,
        losses: 2,
        ties: 1,
        win_rate: 0.7,
        highest_score: 50,
        average_score: 35,
        total_score: 350,
        total_words: 100,
        longest_word: 'kelime',
        longest_word_length: 6,
        total_play_time: 3600,
        current_win_streak: 3,
        best_win_streak: 5,
      };
      mockGetUserStats.mockResolvedValue(mockStats);

      const { result } = renderHook(() => useUserStats('user_123'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(mockGetUserStats).toHaveBeenCalledWith('user_123', undefined);
      expect(result.current.data).toEqual(mockStats);
    });

    it('does not fetch when userId is null', () => {
      const { result } = renderHook(() => useUserStats(null), {
        wrapper: createWrapper(),
      });

      expect(result.current.isFetching).toBe(false);
      expect(mockGetUserStats).not.toHaveBeenCalled();
    });

    it('does not fetch when enabled is false', () => {
      const { result } = renderHook(() => useUserStats('user_123', false), {
        wrapper: createWrapper(),
      });

      expect(result.current.isFetching).toBe(false);
      expect(mockGetUserStats).not.toHaveBeenCalled();
    });

    it('handles fetch error', async () => {
      const mockError = new Error('User not found');
      mockGetUserStats.mockRejectedValue(mockError);

      const { result } = renderHook(() => useUserStats('user_123'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.error).toEqual(mockError);
    });
  });

  describe('useUserGames', () => {
    it('fetches user games successfully', async () => {
      const mockGames: api.GameHistory[] = [
        { 
          room_id: 'room1', 
          opponent: 'player2', 
          user_score: 50, 
          opponent_score: 40,
          user_words: 'word1,word2',
          won: true, 
          tied: false,
          duration: 300,
          played_at: '2024-01-01T00:00:00Z'
        },
        { 
          room_id: 'room2', 
          opponent: 'player3', 
          user_score: 35, 
          opponent_score: 45,
          user_words: 'word3',
          won: false, 
          tied: false,
          duration: 250,
          played_at: '2024-01-02T00:00:00Z'
        },
      ];
      mockGetUserGames.mockResolvedValue(mockGames);

      const { result } = renderHook(() => useUserGames('user_123', 10), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(mockGetUserGames).toHaveBeenCalledWith('user_123', 10, undefined);
      expect(result.current.data).toEqual(mockGames);
    });

    it('does not fetch when userId is null', () => {
      const { result } = renderHook(() => useUserGames(null, 10), {
        wrapper: createWrapper(),
      });

      expect(result.current.isFetching).toBe(false);
      expect(mockGetUserGames).not.toHaveBeenCalled();
    });
  });

  describe('useLeaderboard', () => {
    it('fetches leaderboard successfully', async () => {
      const mockLeaderboard: api.LeaderboardEntry[] = [
        { 
          username: 'player1', 
          total_games: 25,
          wins: 20,
          losses: 4,
          ties: 1,
          win_rate: 0.8,
          highest_score: 80,
          average_score: 50,
          total_words: 250,
          longest_word: 'uzunkelime',
          best_win_streak: 10
        },
        { 
          username: 'player2', 
          total_games: 22,
          wins: 18,
          losses: 3,
          ties: 1,
          win_rate: 0.82,
          highest_score: 75,
          average_score: 48,
          total_words: 220,
          longest_word: 'kelimeler',
          best_win_streak: 8
        },
      ];
      mockGetLeaderboard.mockResolvedValue(mockLeaderboard);

      const { result } = renderHook(() => useLeaderboard(10), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(mockGetLeaderboard).toHaveBeenCalledWith(10, undefined);
      expect(result.current.data).toEqual(mockLeaderboard);
    });

    it('handles leaderboard fetch error', async () => {
      const mockError = new Error('Failed to fetch leaderboard');
      mockGetLeaderboard.mockRejectedValue(mockError);

      const { result } = renderHook(() => useLeaderboard(10), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.error).toEqual(mockError);
    });
  });

  describe('useSaveGame', () => {
    it('saves game successfully', async () => {
      const mockSavedGame = { id: 1, score: 50 };
      mockSaveGame.mockResolvedValue(mockSavedGame);

      const { result } = renderHook(() => useSaveGame(), {
        wrapper: createWrapper(),
      });

      const gameData: api.SaveGameData = {
        room_id: 'room_123',
        player1_user_id: 'user_123',
        player2_user_id: 'user_456',
        player1_score: 50,
        player2_score: 35,
        player1_words: ['word1', 'word2'],
        player2_words: ['word3'],
        winner_user_id: 'user_123',
        duration: 300,
        letter_pool: ['A', 'B', 'C', 'D', 'E'],
        started_at: '2024-01-01T00:00:00Z',
        ended_at: '2024-01-01T00:05:00Z',
      };

      result.current.mutate(gameData);

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(mockSaveGame).toHaveBeenCalledWith(gameData, undefined);
      expect(result.current.data).toEqual(mockSavedGame);
    });

    it('handles save error', async () => {
      const mockError = new Error('Failed to save game');
      mockSaveGame.mockRejectedValue(mockError);

      const { result } = renderHook(() => useSaveGame(), {
        wrapper: createWrapper(),
      });

      const gameData: api.SaveGameData = {
        room_id: 'room_123',
        player1_user_id: 'user_123',
        player2_user_id: 'user_456',
        player1_score: 50,
        player2_score: 35,
        player1_words: ['word1'],
        player2_words: ['word2'],
        winner_user_id: 'user_123',
        duration: 300,
        letter_pool: ['A', 'B', 'C'],
        started_at: '2024-01-01T00:00:00Z',
        ended_at: '2024-01-01T00:05:00Z',
      };

      result.current.mutate(gameData);

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.error).toEqual(mockError);
    });
  });

  describe('queryKeys', () => {
    it('generates correct userStats key', () => {
      const key = queryKeys.users.stats('user_123');
      expect(key).toEqual(['lexo', 'users', 'stats', 'user_123']);
    });

    it('generates correct userGames key', () => {
      const key = queryKeys.users.games('user_123', 10);
      expect(key).toEqual(['lexo', 'users', 'games', 'user_123', 10]);
    });

    it('generates correct leaderboard key', () => {
      const key = queryKeys.leaderboard.list(10);
      expect(key).toEqual(['lexo', 'leaderboard', 10]);
    });
  });
});
