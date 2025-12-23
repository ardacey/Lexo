import { API_BASE_URL } from './constants';

// API configuration
export const API_ENDPOINTS = {
  validateWord: `${API_BASE_URL}/api/v1/words/validate-word`,
  health: `${API_BASE_URL}/health`,
  createUser: `${API_BASE_URL}/api/users`,
  checkUsername: (username: string) => `${API_BASE_URL}/api/users/check-username/${encodeURIComponent(username)}`,
  getUserStats: (userId: string) => `${API_BASE_URL}/api/users/${userId}/stats`,
  getUserGames: (userId: string, limit: number = 10) => `${API_BASE_URL}/api/users/${userId}/games?limit=${limit}`,
  getLeaderboard: (limit: number = 100) => `${API_BASE_URL}/api/leaderboard?limit=${limit}`,
  saveGame: `${API_BASE_URL}/api/games/save`,
  deleteUserAccount: `${API_BASE_URL}/api/users/me`,
  getOnlineStats: `${API_BASE_URL}/stats`,
  getAppVersion: `${API_BASE_URL}/app/version`,
};

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
}

export interface AppVersionInfo {
  min_version: string;
  latest_version: string;
  update_url: string;
  force_update: boolean;
}

export const validateWord = async (word: string): Promise<ValidateWordResponse> => {
  try {
    const response = await fetch(API_ENDPOINTS.validateWord, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ word }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.json();
  } catch {
    return {
      valid: false,
      message: 'Sunucuya bağlanılamadı',
    };
  }
};

export const createUser = async (userId: string, username: string, email?: string, token?: string) => {
  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(API_ENDPOINTS.createUser, {
      method: 'POST',
      headers,
      body: JSON.stringify({ user_id: userId, username, email }),
    });

    if (!response.ok) {
      let errorMessage = `HTTP error! status: ${response.status}`;
      try {
        const errorData = await response.json();
        if (errorData.error) {
          errorMessage = errorData.error;
        } else if (errorData.detail) {
          errorMessage = errorData.detail;
        }
      } catch (e) {
        // Ignore JSON parse error
      }
      throw new Error(errorMessage);
    }

    return await response.json();
  } catch (error) {
    throw error;
  }
};

export const checkUsername = async (username: string) => {
  try {
    const response = await fetch(API_ENDPOINTS.checkUsername(username), {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    throw error;
  }
};

export const getUserStats = async (userId: string, token?: string): Promise<UserStats | null> => {
  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(API_ENDPOINTS.getUserStats(userId), {
      method: 'GET',
      headers,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
    }

    const data = await response.json();
    return data.success ? data.stats : null;
  } catch (error) {
    throw error;
  }
};

export const getUserGames = async (userId: string, limit: number = 10, token?: string): Promise<GameHistory[]> => {
  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(API_ENDPOINTS.getUserGames(userId, limit), {
      method: 'GET',
      headers,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
    }

    const data = await response.json();
    return data.success ? data.games : [];
  } catch (error) {
    throw error;
  }
};

export const getLeaderboard = async (limit: number = 100, token?: string): Promise<LeaderboardEntry[]> => {
  try {
    const headers: Record<string, string> = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(API_ENDPOINTS.getLeaderboard(limit), { headers });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data.success ? data.leaderboard : [];
  } catch {
    return [];
  }
};

export const saveGame = async (gameData: SaveGameData, token?: string) => {
  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(API_ENDPOINTS.saveGame, {
      method: 'POST',
      headers,
      body: JSON.stringify(gameData),
    });

    if (!response.ok) {
      const errorText = await response.text();
      // Check if this is a duplicate key error - this is expected behavior
      if (errorText.includes('duplicate key') && errorText.includes('ix_game_history_room_id')) {
        return { success: true, message: 'Game already saved by opponent' };
      }
      throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
    }

    const result = await response.json();
    return result;
  } catch (error) {
    throw error;
  }
};

export const deleteUserAccount = async (token?: string) => {
  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const response = await fetch(API_ENDPOINTS.deleteUserAccount, {
      method: 'DELETE',
      headers,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
    }

    const result = await response.json();
    return result;
  } catch (error) {
    throw error;
  }
};

export const getOnlineStats = async (): Promise<OnlineStats | null> => {
  try {
    const response = await fetch(API_ENDPOINTS.getOnlineStats, { method: 'GET' });
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return await response.json();
  } catch {
    return null;
  }
};

export const getAppVersionInfo = async (): Promise<AppVersionInfo | null> => {
  try {
    const response = await fetch(API_ENDPOINTS.getAppVersion, { method: 'GET' });
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return await response.json();
  } catch {
    return null;
  }
};
