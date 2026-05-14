import { API_BASE_URL } from './constants';

const normalizeBaseUrl = (value: string) => value.replace(/\/$/, '');
const apiRoot = normalizeBaseUrl(API_BASE_URL).replace(/\/api\/v1$/, '').replace(/\/api$/, '');
const apiPrefix = `${apiRoot}/api`;
const apiV1Prefix = `${apiRoot}/api/v1`;

export const API_ENDPOINTS = {
  validateWord: `${apiV1Prefix}/words/validate-word`,
  health: `${apiRoot}/health`,
  createUser: `${apiPrefix}/users`,
  checkUsername: (username: string) => `${apiPrefix}/users/check-username/${encodeURIComponent(username)}`,
  updateUsername: `${apiPrefix}/users/me/username`,
  getUserStats: (userId: string) => `${apiPrefix}/users/${userId}/stats`,
  getUserGames: (userId: string, limit = 10) => `${apiPrefix}/users/${userId}/games?limit=${limit}`,
  getLeaderboard: (limit = 100) => `${apiPrefix}/leaderboard?limit=${limit}`,
  saveGame: `${apiPrefix}/games/save`,
  deleteUserAccount: `${apiPrefix}/users/me`,
  getOnlineStats: `${apiRoot}/stats`,
  getAppVersion: `${apiRoot}/app/version`,
  pingPresence: `${apiPrefix}/presence/ping`,
  getPresenceStatus: `${apiPrefix}/presence/status`,
  searchUsers: (query: string) => `${apiPrefix}/friends/search?q=${encodeURIComponent(query)}`,
  getFriends: `${apiPrefix}/friends`,
  getFriendRequests: `${apiPrefix}/friends/requests`,
  sendFriendRequest: `${apiPrefix}/friends/requests`,
  respondFriendRequest: (requestId: number) => `${apiPrefix}/friends/requests/${requestId}/respond`,
  removeFriend: (friendUserId: string) => `${apiPrefix}/friends/${friendUserId}`,
  sendFriendInvite: `${apiPrefix}/friends/invites/send`,
  respondFriendInvite: `${apiPrefix}/friends/invites/respond`,
  cancelFriendInvite: `${apiPrefix}/friends/invites/cancel`,
  getActiveInvite: `${apiPrefix}/friends/invites/active`,
  getInviteStatus: (inviteId: string) => `${apiPrefix}/friends/invites/status/${inviteId}`,
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ValidateWordResponse {
  valid: boolean;
  message: string;
}

export interface UserStats {
  total_games: number;
  wins: number;
  losses: number;
  ties: number;
  win_rate: number;
  highest_score: number;
  average_score: number;
  total_score: number;
  total_words: number;
  longest_word: string;
  longest_word_length: number;
  total_play_time: number;
  current_win_streak: number;
  best_win_streak: number;
  rank?: number;
}

export interface GameHistory {
  room_id: string;
  opponent: string;
  user_score: number;
  opponent_score: number;
  user_words: string;
  won: boolean;
  tied: boolean;
  duration: number;
  played_at: string;
}

export interface LeaderboardEntry {
  username: string;
  total_games: number;
  wins: number;
  losses: number;
  ties: number;
  win_rate: number;
  highest_score: number;
  average_score: number;
  total_words: number;
  longest_word: string;
  best_win_streak: number;
}

export interface SaveGameData {
  room_id: string;
  player1_user_id: string;
  player2_user_id: string;
  player1_score: number;
  player2_score: number;
  player1_words: string[];
  player2_words: string[];
  winner_user_id?: string;
  duration: number;
  letter_pool: string[];
  started_at: string;
  ended_at: string;
}

export interface OnlineStats {
  active_rooms: number;
  waiting_players: number;
  total_words: number;
  online_players?: number;
}

export interface AppVersionInfo {
  min_version: string;
  latest_version: string;
  update_url: string;
  force_update: boolean;
}

export interface FriendUser {
  user_id: string;
  username: string;
}

export interface FriendRequest {
  id: number;
  status: string;
  created_at: string;
  requester: FriendUser;
}

// ---------------------------------------------------------------------------
// Base fetch helper
// ---------------------------------------------------------------------------

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly retryAfter?: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

interface ApiFetchOptions extends Omit<RequestInit, 'headers'> {
  token?: string;
  timeoutMs?: number;
}

async function apiFetch<T = any>(url: string, options: ApiFetchOptions = {}): Promise<T> {
  const { token, timeoutMs = 10_000, ...fetchOptions } = options;

  const headers: Record<string, string> = {};
  if (fetchOptions.body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, { ...fetchOptions, headers, signal: controller.signal });

    if (!response.ok) {
      if (response.status === 429) {
        const retryAfter = parseInt(response.headers.get('Retry-After') ?? '60', 10);
        throw new ApiError('İstek limiti aşıldı. Lütfen bekleyin.', 429, retryAfter);
      }
      let errorMessage = `HTTP ${response.status}`;
      try {
        const body = await response.json();
        errorMessage = body.error ?? body.detail ?? errorMessage;
      } catch {
        // non-JSON error body — use status text
      }
      throw new ApiError(errorMessage, response.status);
    }

    return response.json() as Promise<T>;
  } catch (err) {
    if (err instanceof ApiError) throw err;
    if ((err as any)?.name === 'AbortError') {
      throw new ApiError('İstek zaman aşımına uğradı.', 408);
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}

// ---------------------------------------------------------------------------
// API functions
// ---------------------------------------------------------------------------

export const validateWord = async (word: string, token?: string): Promise<ValidateWordResponse> => {
  try {
    return await apiFetch<ValidateWordResponse>(API_ENDPOINTS.validateWord, {
      method: 'POST',
      body: JSON.stringify({ word }),
      token,
    });
  } catch {
    return { valid: false, message: 'Sunucuya bağlanılamadı' };
  }
};

export const pingPresence = async (token?: string): Promise<void> => {
  try {
    await apiFetch(API_ENDPOINTS.pingPresence, { method: 'POST', token });
  } catch {
    // Presence ping failures are non-critical
  }
};

export const getPresenceStatus = (userIds: string[], token?: string) => {
  const query = userIds.map((id) => `user_ids=${encodeURIComponent(id)}`).join('&');
  return apiFetch(`${API_ENDPOINTS.getPresenceStatus}?${query}`, { token });
};

export const createUser = (userId: string, username: string, email?: string, token?: string) =>
  apiFetch(API_ENDPOINTS.createUser, {
    method: 'POST',
    body: JSON.stringify({ user_id: userId, username, email }),
    token,
  });

export const checkUsername = (username: string) =>
  apiFetch(API_ENDPOINTS.checkUsername(username));

export const updateUsername = (username: string, token?: string) =>
  apiFetch(API_ENDPOINTS.updateUsername, {
    method: 'PATCH',
    body: JSON.stringify({ username }),
    token,
  });

export const searchUsers = (query: string, token?: string) =>
  apiFetch(API_ENDPOINTS.searchUsers(query), { token });

export const getFriends = (token?: string) =>
  apiFetch(API_ENDPOINTS.getFriends, { token });

export const getFriendRequests = (token?: string) =>
  apiFetch(API_ENDPOINTS.getFriendRequests, { token });

export const sendFriendRequest = (targetUserId: string, token?: string) =>
  apiFetch(API_ENDPOINTS.sendFriendRequest, {
    method: 'POST',
    body: JSON.stringify({ target_user_id: targetUserId }),
    token,
  });

export const respondFriendRequest = (requestId: number, action: string, token?: string) =>
  apiFetch(API_ENDPOINTS.respondFriendRequest(requestId), {
    method: 'POST',
    body: JSON.stringify({ action }),
    token,
  });

export const removeFriend = (friendUserId: string, token?: string) =>
  apiFetch(API_ENDPOINTS.removeFriend(friendUserId), { method: 'DELETE', token });

export const sendFriendInvite = (targetUserId: string, token?: string) =>
  apiFetch(API_ENDPOINTS.sendFriendInvite, {
    method: 'POST',
    body: JSON.stringify({ target_user_id: targetUserId }),
    token,
  });

export const respondFriendInvite = (inviteId: string, action: string, token?: string) =>
  apiFetch(API_ENDPOINTS.respondFriendInvite, {
    method: 'POST',
    body: JSON.stringify({ invite_id: inviteId, action }),
    token,
  });

export const cancelFriendInvite = (inviteId: string, token?: string) =>
  apiFetch(API_ENDPOINTS.cancelFriendInvite, {
    method: 'POST',
    body: JSON.stringify({ invite_id: inviteId }),
    token,
  });

export const getActiveInvite = (token?: string) =>
  apiFetch(API_ENDPOINTS.getActiveInvite, { token });

export const getInviteStatus = (inviteId: string, token?: string) =>
  apiFetch(API_ENDPOINTS.getInviteStatus(inviteId), { token });

export const getUserStats = async (userId: string, token?: string): Promise<UserStats | null> => {
  const data = await apiFetch<{ success: boolean; stats: UserStats }>(
    API_ENDPOINTS.getUserStats(userId),
    { token },
  );
  return data.success ? data.stats : null;
};

export const getUserGames = async (userId: string, limit = 10, token?: string): Promise<GameHistory[]> => {
  const data = await apiFetch<{ success: boolean; games: GameHistory[] }>(
    API_ENDPOINTS.getUserGames(userId, limit),
    { token },
  );
  return data.success ? data.games : [];
};

export const getLeaderboard = async (limit = 100, token?: string): Promise<LeaderboardEntry[]> => {
  try {
    const data = await apiFetch<{ success: boolean; leaderboard: LeaderboardEntry[] }>(
      API_ENDPOINTS.getLeaderboard(limit),
      { token },
    );
    return data.success ? data.leaderboard : [];
  } catch {
    return [];
  }
};

export const saveGame = async (gameData: SaveGameData, token?: string) => {
  try {
    return await apiFetch(API_ENDPOINTS.saveGame, {
      method: 'POST',
      body: JSON.stringify(gameData),
      token,
    });
  } catch (err) {
    // Duplicate key = server already saved the game (expected race condition)
    if (err instanceof ApiError && err.message.includes('duplicate key')) {
      return { success: true, message: 'Game already saved by opponent' };
    }
    throw err;
  }
};

export const deleteUserAccount = (token?: string) =>
  apiFetch(API_ENDPOINTS.deleteUserAccount, { method: 'DELETE', token });

export const getOnlineStats = async (): Promise<OnlineStats | null> => {
  try {
    return await apiFetch<OnlineStats>(API_ENDPOINTS.getOnlineStats);
  } catch {
    return null;
  }
};

export const getAppVersionInfo = async (): Promise<AppVersionInfo | null> => {
  try {
    return await apiFetch<AppVersionInfo>(API_ENDPOINTS.getAppVersion);
  } catch {
    return null;
  }
};
