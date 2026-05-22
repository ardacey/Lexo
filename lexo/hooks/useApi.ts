import { useMutation, useQuery, useQueryClient, useInfiniteQuery, UseQueryOptions } from '@tanstack/react-query';
import {
  validateWord,
  createUser,
  getUserStats,
  getUserGames,
  getUserProfile,
  getLeaderboard,
  saveGame,
  deleteUserAccount,
  getDailyChallenge,
  submitDailyChallenge,
  ValidateWordResponse,
  UserStats,
  UserProfile,
  GameHistory,
  GamesPage,
  LeaderboardEntry,
  SaveGameData,
  DailyChallengeState,
  DailySubmitResult,
  checkUsername,
  updateUsername,
  searchUsers,
  getFriends,
  getFriendRequests,
  sendFriendRequest,
  respondFriendRequest,
  removeFriend,
  FriendUser,
  FriendRequest,
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
  friends: {
    all: () => [...queryKeys.all, 'friends'] as const,
    list: () => [...queryKeys.friends.all(), 'list'] as const,
    requests: () => [...queryKeys.friends.all(), 'requests'] as const,
  },
  leaderboard: {
    all: () => [...queryKeys.all, 'leaderboard'] as const,
    list: (limit: number) => [...queryKeys.leaderboard.all(), limit] as const,
  },
  daily: {
    all: () => [...queryKeys.all, 'daily'] as const,
    challenge: () => [...queryKeys.daily.all(), 'challenge'] as const,
  },
} as const;

(queryKeys as any).userStats = (userId: string) => ['userStats', userId];
(queryKeys as any).userGames = (userId: string, limit: number) => ['userGames', userId, limit];

const __leaderboard = (limit: number) => ['leaderboard', limit] as const;
(__leaderboard as any).all = () => [...queryKeys.all, 'leaderboard'] as const;
(__leaderboard as any).list = (limit: number) => [...(__leaderboard as any).all(), limit] as const;
(queryKeys as any).leaderboard = __leaderboard as any;

export const useValidateWord = () => {
  const { getToken } = useAuth();

  return useMutation<ValidateWordResponse, Error, string>({
    mutationFn: async (word: string) => {
      const token = await getToken();
      return validateWord(word, token ?? undefined);
    },
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

export const useUpdateUsername = () => {
  const queryClient = useQueryClient();
  const { getToken } = useAuth();

  return useMutation<any, Error, string>({
    mutationFn: async (username: string) => {
      const token = await getToken();
      return updateUsername(username, token ?? undefined);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.leaderboard.all() });
    },
  });
};

export const useSearchUsers = () => {
  const { getToken } = useAuth();

  return useMutation<{ success: boolean; users: FriendUser[] }, Error, string>({
    mutationFn: async (query: string) => {
      const token = await getToken();
      return searchUsers(query, token ?? undefined);
    },
  });
};

export const useFriends = () => {
  const { getToken } = useAuth();

  return useQuery<{ success: boolean; friends: FriendUser[] }, Error>({
    queryKey: queryKeys.friends.list(),
    queryFn: async () => {
      const token = await getToken();
      return getFriends(token ?? undefined);
    },
    staleTime: 1000 * 30,
  });
};

export const useFriendRequests = () => {
  const { getToken } = useAuth();

  return useQuery<{ success: boolean; requests: FriendRequest[] }, Error>({
    queryKey: queryKeys.friends.requests(),
    queryFn: async () => {
      const token = await getToken();
      return getFriendRequests(token ?? undefined);
    },
    staleTime: 1000 * 15,
  });
};

export const useSendFriendRequest = () => {
  const { getToken } = useAuth();
  const queryClient = useQueryClient();

  return useMutation<any, Error, string>({
    mutationFn: async (targetUserId: string) => {
      const token = await getToken();
      return sendFriendRequest(targetUserId, token ?? undefined);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.friends.requests() });
      queryClient.invalidateQueries({ queryKey: queryKeys.friends.list() });
    },
  });
};

export const useRespondFriendRequest = () => {
  const { getToken } = useAuth();
  const queryClient = useQueryClient();

  return useMutation<
    any,
    Error,
    { requestId: number; action: string },
    { previousRequests: { success: boolean; requests: FriendRequest[] } | undefined }
  >({
    mutationFn: async ({ requestId, action }) => {
      const token = await getToken();
      return respondFriendRequest(requestId, action, token ?? undefined);
    },
    // Optimistic update: remove the request from the list BEFORE the API call
    onMutate: async (variables) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.friends.requests() });
      const previousRequests = queryClient.getQueryData<{ success: boolean; requests: FriendRequest[] }>(
        queryKeys.friends.requests()
      );
      queryClient.setQueryData<{ success: boolean; requests: FriendRequest[] }>(
        queryKeys.friends.requests(),
        (old) => {
          if (!old) return old;
          return {
            ...old,
            requests: old.requests.filter((r) => r.id !== variables.requestId),
          };
        }
      );
      return { previousRequests };
    },
    // Retry once silently so a single slow Render cold-start doesn't surface an error.
    // onMutate is NOT re-called on retry (optimistic state stays in place).
    retry: 1,
    retryDelay: 1_000,
    // Roll back only after all retries are exhausted
    onError: (_error, _variables, context) => {
      if (context?.previousRequests !== undefined) {
        queryClient.setQueryData(queryKeys.friends.requests(), context.previousRequests);
      }
    },
    onSuccess: () => {
      // Refresh the friends list in the background (needed when accepting).
      queryClient.invalidateQueries({ queryKey: queryKeys.friends.list() });
    },
  });
};

export const useRemoveFriend = () => {
  const { getToken } = useAuth();
  const queryClient = useQueryClient();

  return useMutation<
    any,
    Error,
    string,
    { previousFriends: { success: boolean; friends: FriendUser[] } | undefined }
  >({
    mutationFn: async (friendUserId: string) => {
      const token = await getToken();
      return removeFriend(friendUserId, token ?? undefined);
    },
    // Optimistic update: remove the friend BEFORE the API call
    onMutate: async (friendUserId) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.friends.list() });
      const previousFriends = queryClient.getQueryData<{ success: boolean; friends: FriendUser[] }>(
        queryKeys.friends.list()
      );
      queryClient.setQueryData<{ success: boolean; friends: FriendUser[] }>(
        queryKeys.friends.list(),
        (old) => {
          if (!old) return old;
          return {
            ...old,
            friends: old.friends.filter((f) => f.user_id !== friendUserId),
          };
        }
      );
      return { previousFriends };
    },
    retry: 1,
    retryDelay: 1_000,
    // Roll back only after all retries are exhausted
    onError: (_error, _variables, context) => {
      if (context?.previousFriends !== undefined) {
        queryClient.setQueryData(queryKeys.friends.list(), context.previousFriends);
      }
    },
  });
};

export const useUserProfile = (userId: string | null, enabled: boolean = true) => {
  const { getToken } = useAuth();

  return useQuery<UserProfile | null, Error>({
    queryKey: [...queryKeys.users.all(), 'profile', userId],
    queryFn: async () => {
      const token = await getToken();
      return getUserProfile(userId!, token ?? undefined);
    },
    enabled: enabled && !!userId,
    staleTime: 1000 * 60 * 5,
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
    // Retry/retryDelay are intentionally NOT set here so that the app-level
    // QueryClient default (retry: 3, retryDelay: 4000) applies in production
    // AND the test-level QueryClient (retry: false) applies during tests.
  });
};

export const useUserGames = (userId: string | null, limit: number = 10, enabled: boolean = true) => {
  const { getToken } = useAuth();

  return useQuery<GamesPage, Error>({
    queryKey: queryKeys.users.games(userId || '', limit),
    queryFn: async () => {
      const token = await getToken();
      return getUserGames(userId!, limit, 0, token ?? undefined);
    },
    enabled: enabled && !!userId,
    staleTime: 1000 * 60 * 2, // 2 dakika
  });
};

export const useInfiniteUserGames = (userId: string | null, pageSize: number = 10) => {
  const { getToken } = useAuth();

  return useInfiniteQuery<GamesPage, Error>({
    queryKey: [...queryKeys.users.all(), 'games-infinite', userId],
    queryFn: async ({ pageParam = 0 }) => {
      const token = await getToken();
      return getUserGames(userId!, pageSize, pageParam as number, token ?? undefined);
    },
    getNextPageParam: (lastPage, allPages) =>
      lastPage.has_more ? allPages.length * pageSize : undefined,
    initialPageParam: 0,
    enabled: !!userId,
    staleTime: 1000 * 60 * 2,
    // Retry/retryDelay deferred to app-level QueryClient defaults.
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

// Prefetch helper — fire-and-forget background fetches so screens open
// instantly from cache when the user navigates to them.
export const usePrefetchUserData = () => {
  const queryClient = useQueryClient();
  const { getToken } = useAuth();

  const prefetchUserStats = (userId: string) => {
    // Skip if already fresh in cache.
    const existing = queryClient.getQueryState(queryKeys.users.stats(userId));
    if (existing?.dataUpdatedAt && Date.now() - existing.dataUpdatedAt < 1000 * 60 * 5) return;

    queryClient.prefetchQuery({
      queryKey: queryKeys.users.stats(userId),
      queryFn: async () => {
        const token = await getToken();
        return getUserStats(userId, token ?? undefined);
      },
      staleTime: 1000 * 60 * 5,
    });
  };

  const prefetchLeaderboard = (limit: number = 100) => {
    const existing = queryClient.getQueryState(queryKeys.leaderboard.list(limit));
    if (existing?.dataUpdatedAt && Date.now() - existing.dataUpdatedAt < 1000 * 60 * 5) return;

    queryClient.prefetchQuery({
      queryKey: queryKeys.leaderboard.list(limit),
      queryFn: async () => {
        const token = await getToken();
        return getLeaderboard(limit, token ?? undefined);
      },
      staleTime: 1000 * 60 * 5,
    });
  };

  const prefetchUserGames = (userId: string, pageSize = 10) => {
    const qKey = [...queryKeys.users.all(), 'games-infinite', userId];
    const existing = queryClient.getQueryState(qKey);
    if (existing?.dataUpdatedAt && Date.now() - existing.dataUpdatedAt < 1000 * 60 * 2) return;

    queryClient.prefetchInfiniteQuery({
      queryKey: qKey,
      queryFn: async ({ pageParam = 0 }) => {
        const token = await getToken();
        return getUserGames(userId, pageSize, pageParam as number, token ?? undefined);
      },
      initialPageParam: 0,
      staleTime: 1000 * 60 * 2,
    });
  };

  return { prefetchUserStats, prefetchLeaderboard, prefetchUserGames };
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

// ---------------------------------------------------------------------------
// Daily Challenge hooks
// ---------------------------------------------------------------------------

export const useDailyChallenge = () => {
  const { getToken } = useAuth();

  return useQuery<DailyChallengeState, Error>({
    queryKey: queryKeys.daily.challenge(),
    queryFn: async () => {
      const token = await getToken();
      return getDailyChallenge(token ?? undefined);
    },
    staleTime: 1000 * 60 * 5, // 5 minutes — pool changes only once per day
  });
};

export const useSubmitDailyChallenge = () => {
  const { getToken } = useAuth();
  const queryClient = useQueryClient();

  return useMutation<DailySubmitResult, Error, { words: string[]; score: number }>({
    mutationFn: async ({ words, score }) => {
      const token = await getToken();
      return submitDailyChallenge(words, score, token ?? undefined);
    },
    onSuccess: () => {
      // Invalidate so the GET returns already_played: true on next focus
      queryClient.invalidateQueries({ queryKey: queryKeys.daily.challenge() });
    },
  });
};
