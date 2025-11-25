import { useMutation, useQuery, useQueryClient, UseQueryOptions } from '@tanstack/react-query';
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

// Query key factory - daha organize ve type-safe
export const queryKeys = {
  all: ['lexo'] as const,
  users: {
    all: () => [...queryKeys.all, 'users'] as const,
    stats: (clerkId: string) => [...queryKeys.users.all(), 'stats', clerkId] as const,
    games: (clerkId: string, limit: number) => [...queryKeys.users.all(), 'games', clerkId, limit] as const,
  },
  leaderboard: {
    all: () => [...queryKeys.all, 'leaderboard'] as const,
    list: (limit: number) => [...queryKeys.leaderboard.all(), limit] as const,
  },
} as const;

(queryKeys as any).userStats = (clerkId: string) => ['userStats', clerkId];
(queryKeys as any).userGames = (clerkId: string, limit: number) => ['userGames', clerkId, limit];

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
  
  return useMutation<any, Error, { clerkId: string; username: string; email?: string }>({
    mutationFn: ({ clerkId, username, email }) => createUser(clerkId, username, email),
    onSuccess: (data, variables) => {
      // Yeni kullanıcı oluşturulduğunda stats'ı invalidate et
      queryClient.invalidateQueries({ queryKey: queryKeys.users.stats(variables.clerkId) });
    },
    onError: (error: any) => {
      // Kullanıcı zaten varsa hata fırlatma (sessizce geç)
      if (error?.message?.includes('already exists') || error?.response?.status === 409) {
        return;
      }
    },
    retry: false,
  });
};

export const useUserStats = (clerkId: string | null, enabled: boolean = true) => {
  return useQuery<UserStats | null, Error>({
    queryKey: queryKeys.users.stats(clerkId || ''),
    queryFn: () => getUserStats(clerkId!),
    enabled: enabled && !!clerkId,
    staleTime: 1000 * 60 * 5, // 5 dakika
    retry: false,
  });
};

export const useUserGames = (clerkId: string | null, limit: number = 10, enabled: boolean = true) => {
  return useQuery<GameHistory[], Error>({
    queryKey: queryKeys.users.games(clerkId || '', limit),
    queryFn: () => getUserGames(clerkId!, limit),
    enabled: enabled && !!clerkId,
    staleTime: 1000 * 60 * 2, // 2 dakika
  });
};

export const useLeaderboard = (limit: number = 100, enabled: boolean = true) => {
  return useQuery<LeaderboardEntry[], Error>({
    queryKey: queryKeys.leaderboard.list(limit),
    queryFn: () => getLeaderboard(limit),
    enabled,
    staleTime: 1000 * 60 * 5, // 5 dakika
  });
};

export const useSaveGame = () => {
  const queryClient = useQueryClient();
  
  return useMutation<any, Error, SaveGameData>({
    mutationFn: (gameData: SaveGameData) => saveGame(gameData),
    onSuccess: (data, variables) => {
      // Her iki oyuncunun da verilerini invalidate et
      queryClient.invalidateQueries({ queryKey: queryKeys.users.stats(variables.player1_clerk_id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.users.stats(variables.player2_clerk_id) });
      
      // Oyun geçmişlerini invalidate et
      queryClient.invalidateQueries({ 
        queryKey: queryKeys.users.all(),
        predicate: (query) => {
          const key = query.queryKey;
          return key.includes('games') && 
                 (key.includes(variables.player1_clerk_id) || key.includes(variables.player2_clerk_id));
        }
      });
      
      // Leaderboard'u invalidate et
      queryClient.invalidateQueries({ queryKey: queryKeys.leaderboard.all() });
    },
  });
};

export const useRefreshUserData = (clerkId: string | null) => {
  const queryClient = useQueryClient();
  
  const refreshAll = () => {
    if (clerkId) {
      // İlgili kullanıcının tüm verilerini yenile
      queryClient.invalidateQueries({ queryKey: queryKeys.users.stats(clerkId) });
      queryClient.invalidateQueries({ 
        queryKey: queryKeys.users.all(),
        predicate: (query) => query.queryKey.includes(clerkId)
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.leaderboard.all() });
    }
  };
  
  return { refreshAll };
};

// Prefetch helper - sayfa geçişlerinde performans için
export const usePrefetchUserData = () => {
  const queryClient = useQueryClient();
  
  const prefetchUserStats = (clerkId: string) => {
    queryClient.prefetchQuery({
      queryKey: queryKeys.users.stats(clerkId),
      queryFn: () => getUserStats(clerkId),
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
        queryKey: queryKeys.users.stats(gameData.player1_clerk_id) 
      });
      await queryClient.cancelQueries({ 
        queryKey: queryKeys.users.stats(gameData.player2_clerk_id) 
      });
      
      // Önceki verileri snapshot'la (rollback için)
      const previousPlayer1Stats = queryClient.getQueryData<UserStats | null>(
        queryKeys.users.stats(gameData.player1_clerk_id)
      );
      const previousPlayer2Stats = queryClient.getQueryData<UserStats | null>(
        queryKeys.users.stats(gameData.player2_clerk_id)
      );
      
      return { previousPlayer1Stats, previousPlayer2Stats };
    },
    onError: (err, gameData, context) => {
      // Hata durumunda eski verilere geri dön
      if (context?.previousPlayer1Stats) {
        queryClient.setQueryData(
          queryKeys.users.stats(gameData.player1_clerk_id),
          context.previousPlayer1Stats
        );
      }
      if (context?.previousPlayer2Stats) {
        queryClient.setQueryData(
          queryKeys.users.stats(gameData.player2_clerk_id),
          context.previousPlayer2Stats
        );
      }
    },
    onSettled: (data, error, variables) => {
      // Her durumda verileri yenile
      queryClient.invalidateQueries({ queryKey: queryKeys.users.stats(variables.player1_clerk_id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.users.stats(variables.player2_clerk_id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.users.all() });
      queryClient.invalidateQueries({ queryKey: queryKeys.leaderboard.all() });
    },
  });
};
