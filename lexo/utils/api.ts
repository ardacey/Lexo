import { API_BASE_URL } from './constants';

// API configuration
export const API_ENDPOINTS = {
  validateWord: `${API_BASE_URL}/api/validate-word`,
  health: `${API_BASE_URL}/health`,
  createUser: `${API_BASE_URL}/api/users`,
  getUserStats: (clerkId: string) => `${API_BASE_URL}/api/users/${clerkId}/stats`,
  getUserGames: (clerkId: string, limit: number = 10) => `${API_BASE_URL}/api/users/${clerkId}/games?limit=${limit}`,
  getLeaderboard: (limit: number = 100) => `${API_BASE_URL}/api/leaderboard?limit=${limit}`,
  saveGame: `${API_BASE_URL}/api/games/save`,
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
  player1_clerk_id: string;
  player2_clerk_id: string;
  player1_score: number;
  player2_score: number;
  player1_words: string[];
  player2_words: string[];
  winner_clerk_id?: string;
  duration: number;
  letter_pool: string[];
  started_at: string;
  ended_at: string;
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
  } catch (error) {
    console.error('Word validation error:', error);
    return {
      valid: false,
      message: 'Sunucuya bağlanılamadı',
    };
  }
};

export const createUser = async (clerkId: string, username: string, email?: string) => {
  try {
    const response = await fetch(API_ENDPOINTS.createUser, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ clerk_id: clerkId, username, email }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Create user error:', error);
    throw error;
  }
};

export const getUserStats = async (clerkId: string): Promise<UserStats | null> => {
  try {
    const response = await fetch(API_ENDPOINTS.getUserStats(clerkId), {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
    }

    const data = await response.json();
    return data.success ? data.stats : null;
  } catch (error) {
    console.error('Get user stats error:', error);
    throw error;
  }
};

export const getUserGames = async (clerkId: string, limit: number = 10): Promise<GameHistory[]> => {
  try {
    const response = await fetch(API_ENDPOINTS.getUserGames(clerkId, limit), {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
    }

    const data = await response.json();
    return data.success ? data.games : [];
  } catch (error) {
    console.error('Get user games error:', error);
    throw error;
  }
};

export const getLeaderboard = async (limit: number = 100): Promise<LeaderboardEntry[]> => {
  try {
    const response = await fetch(API_ENDPOINTS.getLeaderboard(limit));

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data.success ? data.leaderboard : [];
  } catch (error) {
    console.error('Get leaderboard error:', error);
    return [];
  }
};

export const saveGame = async (gameData: SaveGameData) => {
  try {
    console.log('API: Calling saveGame endpoint:', API_ENDPOINTS.saveGame);
    const response = await fetch(API_ENDPOINTS.saveGame, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(gameData),
    });

    if (!response.ok) {
      const errorText = await response.text();
      // Check if this is a duplicate key error - this is expected behavior
      if (errorText.includes('duplicate key') && errorText.includes('ix_game_history_room_id')) {
        console.log('ℹ️ Game already saved by opponent');
        return { success: true, message: 'Game already saved by opponent' };
      }
      console.error('API Error Response:', errorText);
      throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
    }

    const result = await response.json();
    console.log('API: saveGame success:', result);
    return result;
  } catch (error) {
    console.error('Save game error:', error);
    throw error;
  }
};
