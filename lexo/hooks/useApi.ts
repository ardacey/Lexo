import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  validateWord,
  createUser,
  getUserStats,
  getUserGames,
  getLeaderboard,
  saveGame,
  ValidateWordResponse,
  UserStats,
  GameHistory,
  LeaderboardEntry,
  SaveGameData,
} from '../utils/api';

export const queryKeys = {
  userStats: (clerkId: string) => ['userStats', clerkId] as const,
  userGames: (clerkId: string, limit: number) => ['userGames', clerkId, limit] as const,
  leaderboard: (limit: number) => ['leaderboard', limit] as const,
};

export const useValidateWord = () => {
  return useMutation<ValidateWordResponse, Error, string>({
    mutationFn: (word: string) => validateWord(word),
  });
};

export const useCreateUser = () => {
  const queryClient = useQueryClient();
  
  return useMutation<any, Error, { clerkId: string; username: string; email?: string }>({
    mutationFn: ({ clerkId, username, email }) => createUser(clerkId, username, email),
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.userStats(variables.clerkId) });
    },
  });
};

export const useUserStats = (clerkId: string | null, enabled: boolean = true) => {
  return useQuery<UserStats | null, Error>({
    queryKey: queryKeys.userStats(clerkId || ''),
    queryFn: () => getUserStats(clerkId!),
    enabled: enabled && !!clerkId,
    staleTime: 1000 * 60 * 5,
  });
};

export const useUserGames = (clerkId: string | null, limit: number = 10, enabled: boolean = true) => {
  return useQuery<GameHistory[], Error>({
    queryKey: queryKeys.userGames(clerkId || '', limit),
    queryFn: () => getUserGames(clerkId!, limit),
    enabled: enabled && !!clerkId,
    staleTime: 1000 * 60 * 2,
  });
};

export const useLeaderboard = (limit: number = 100, enabled: boolean = true) => {
  return useQuery<LeaderboardEntry[], Error>({
    queryKey: queryKeys.leaderboard(limit),
    queryFn: () => getLeaderboard(limit),
    enabled,
    staleTime: 1000 * 60 * 5,
  });
};

export const useSaveGame = () => {
  const queryClient = useQueryClient();
  
  return useMutation<any, Error, SaveGameData>({
    mutationFn: (gameData: SaveGameData) => saveGame(gameData),
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.userStats(variables.player1_clerk_id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.userStats(variables.player2_clerk_id) });
      queryClient.invalidateQueries({ queryKey: ['userGames', variables.player1_clerk_id] });
      queryClient.invalidateQueries({ queryKey: ['userGames', variables.player2_clerk_id] });
      queryClient.invalidateQueries({ queryKey: ['leaderboard'] });
    },
  });
};

export const useRefreshUserData = (clerkId: string | null) => {
  const queryClient = useQueryClient();
  
  const refreshAll = () => {
    if (clerkId) {
      queryClient.invalidateQueries({ queryKey: queryKeys.userStats(clerkId) });
      queryClient.invalidateQueries({ queryKey: ['userGames', clerkId] });
      queryClient.invalidateQueries({ queryKey: ['leaderboard'] });
    }
  };
  
  return { refreshAll };
};
