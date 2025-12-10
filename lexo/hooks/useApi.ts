import { useMutation, useQuery, useQueryClient, UseQueryOptions } from '@tanstack/react-query';
import {
  validateWord,
  createUser,
  getUserStats,
  getUserGames,
  getLeaderboard,
  saveGame,
  deleteUserAccount,
  ValidateWordResponse,
  UserStats,
  GameHistory,
  LeaderboardEntry,
  SaveGameData,
  checkUsername,
} from '../utils/api';
import { useAuth } from '../context/AuthContext';

// Query key factory - daha organize ve type-safe
export const queryKeys = {
  all: ['lexo'] as const,
  users: {
    all: () => [...queryKeys.all, 'users'] as const,
    stats: (userId: string) => [...queryKeys.users.all(), 'stats', userId] as const,
    games: (userId: string, limit: number) => [...queryKeys.users.all(), 'games', userId, limit] as const,
  },
  leaderboard: {
    all: () => [...queryKeys.all, 'leaderboard'] as const,
    list: (limit: number) => [...queryKeys.leaderboard.all(), limit] as const,
  },
} as const;

(queryKeys as any).userStats = (userId: string) => ['userStats', userId];
(queryKeys as any).userGames = (userId: string, limit: number) => ['userGames', userId, limit];

const __leaderboard = (limit: number) => ['leaderboard', limit] as const;
(__leaderboard as any).all = () => [...queryKeys.all, 'leaderboard'] as const;
(__leaderboard as any).list = (limit: number) => [...(__leaderboard as any).all(), limit] as const;
(queryKeys as any).leaderboard = __leaderboard as any;

export const useValidateWord = () => {
  return useMutation<ValidateWordResponse, Error, string>({
    mutationFn: (word: string) => validateWord(word),
  });
};

export const useCreateUser = () => {
  const queryClient = useQueryClient();
  const { getToken } = useAuth();
  
  return useMutation<any, Error, { userId: string; username: string; email?: string }>({
    mutationFn: async ({ userId, username, email }) => {
      const token = await getToken();
      return createUser(userId, username, email, token ?? undefined);
    },
    onSuccess: (data, variables) => {
      // Yeni kullanıcı oluşturulduğunda stats'ı invalidate et
      queryClient.invalidateQueries({ queryKey: queryKeys.users.stats(variables.userId) });
    },
    retry: false,
    // Global hata handler'ı devre dışı bırak - hatalar sessizce handle edilecek
    meta: {
      skipGlobalErrorHandler: true,
    },
  });
};

export const useCheckUsername = () => {
  return useMutation<{ available: boolean; username: string }, Error, string>({
    mutationFn: (username: string) => checkUsername(username),
    retry: false,
  });
};

export const useUserStats = (userId: string | null, enabled: boolean = true) => {
  const { getToken } = useAuth();
  
  return useQuery<UserStats | null, Error>({
    queryKey: queryKeys.users.stats(userId || ''),
    queryFn: async () => {
      const token = await getToken();
      return getUserStats(userId!, token ?? undefined);
    },
    enabled: enabled && !!userId,
    staleTime: 1000 * 60 * 5, // 5 dakika
    retry: false,
  });
};

export const useUserGames = (userId: string | null, limit: number = 10, enabled: boolean = true) => {
  const { getToken } = useAuth();
  
  return useQuery<GameHistory[], Error>({
    queryKey: queryKeys.users.games(userId || '', limit),
    queryFn: async () => {
      const token = await getToken();
      return getUserGames(userId!, limit, token ?? undefined);
    },
    enabled: enabled && !!userId,
    staleTime: 1000 * 60 * 2, // 2 dakika
  });
};

export const useLeaderboard = (limit: number = 100, enabled: boolean = true) => {
  const { getToken } = useAuth();
  
  return useQuery<LeaderboardEntry[], Error>({
    queryKey: queryKeys.leaderboard.list(limit),
    queryFn: async () => {
      const token = await getToken();
      return getLeaderboard(limit, token ?? undefined);
    },
    enabled,
    staleTime: 1000 * 60 * 5, // 5 dakika
  });
};

export const useSaveGame = () => {
  const queryClient = useQueryClient();
  const { getToken } = useAuth();
  
  return useMutation<any, Error, SaveGameData>({
    mutationFn: async (gameData: SaveGameData) => {
      const token = await getToken();
      return saveGame(gameData, token ?? undefined);
    },
    onSuccess: (data, variables) => {
      // Her iki oyuncunun da verilerini invalidate et
      queryClient.invalidateQueries({ queryKey: queryKeys.users.stats(variables.player1_user_id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.users.stats(variables.player2_user_id) });
      
      // Oyun geçmişlerini invalidate et
      queryClient.invalidateQueries({ 
        queryKey: queryKeys.users.all(),
        predicate: (query) => {
          const key = query.queryKey;
          return key.includes('games') && 
                 (key.includes(variables.player1_user_id) || key.includes(variables.player2_user_id));
        }
      });
      
      // Leaderboard'u invalidate et
      queryClient.invalidateQueries({ queryKey: queryKeys.leaderboard.all() });
    },
  });
};

export const useRefreshUserData = (userId: string | null) => {
  const queryClient = useQueryClient();
  
  const refreshAll = () => {
    if (userId) {
      // İlgili kullanıcının tüm verilerini yenile
      queryClient.invalidateQueries({ queryKey: queryKeys.users.stats(userId) });
      queryClient.invalidateQueries({ 
        queryKey: queryKeys.users.all(),
        predicate: (query) => query.queryKey.includes(userId)
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.leaderboard.all() });
    }
  };
  
  return { refreshAll };
};

// Prefetch helper - sayfa geçişlerinde performans için
export const usePrefetchUserData = () => {
  const queryClient = useQueryClient();
  
  const prefetchUserStats = (userId: string) => {
    queryClient.prefetchQuery({
      queryKey: queryKeys.users.stats(userId),
      queryFn: () => getUserStats(userId),
      staleTime: 1000 * 60 * 5,
    });
  };
  
  const prefetchLeaderboard = (limit: number = 100) => {
    queryClient.prefetchQuery({
      queryKey: queryKeys.leaderboard.list(limit),
      queryFn: () => getLeaderboard(limit),
      staleTime: 1000 * 60 * 5,
    });
  };
  
  return { prefetchUserStats, prefetchLeaderboard };
};

// Optimistic update helper - daha hızlı UI güncellemeleri için
type OptimisticContext = {
  previousPlayer1Stats?: UserStats | null;
  previousPlayer2Stats?: UserStats | null;
};

export const useOptimisticGameSave = () => {
  const queryClient = useQueryClient();
  
  return useMutation<any, Error, SaveGameData, OptimisticContext>({
    mutationFn: (gameData: SaveGameData) => saveGame(gameData),
    onMutate: async (gameData) => {
      // Optimistic update için mevcut query'leri iptal et
      await queryClient.cancelQueries({ 
        queryKey: queryKeys.users.stats(gameData.player1_user_id) 
      });
      await queryClient.cancelQueries({ 
        queryKey: queryKeys.users.stats(gameData.player2_user_id) 
      });
      
      // Önceki verileri snapshot'la (rollback için)
      const previousPlayer1Stats = queryClient.getQueryData<UserStats | null>(
        queryKeys.users.stats(gameData.player1_user_id)
      );
      const previousPlayer2Stats = queryClient.getQueryData<UserStats | null>(
        queryKeys.users.stats(gameData.player2_user_id)
      );
      
      return { previousPlayer1Stats, previousPlayer2Stats };
    },
    onError: (err, gameData, context) => {
      // Hata durumunda eski verilere geri dön
      if (context?.previousPlayer1Stats) {
        queryClient.setQueryData(
          queryKeys.users.stats(gameData.player1_user_id),
          context.previousPlayer1Stats
        );
      }
      if (context?.previousPlayer2Stats) {
        queryClient.setQueryData(
          queryKeys.users.stats(gameData.player2_user_id),
          context.previousPlayer2Stats
        );
      }
    },
    onSettled: (data, error, variables) => {
      // Her durumda verileri yenile
      queryClient.invalidateQueries({ queryKey: queryKeys.users.stats(variables.player1_user_id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.users.stats(variables.player2_user_id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.users.all() });
      queryClient.invalidateQueries({ queryKey: queryKeys.leaderboard.all() });
    },
  });
};

export const useDeleteUserAccount = () => {
  const { getToken } = useAuth();
  
  return useMutation<any, Error, void>({
    mutationFn: async () => {
      const token = await getToken();
      return deleteUserAccount(token || undefined);
    },
  });
};
