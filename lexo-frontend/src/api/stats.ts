const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000/api";

export interface UserStats {
  id: string;
  user_id: string;
  total_games: number;
  wins: number;
  losses: number;
  draws: number;
  total_score: number;
  highest_score: number;
  average_score: number;
  total_words: number;
  longest_word_length: number;
  longest_word: string;
  total_playtime_seconds: number;
  classic_games: number;
  battle_royale_games: number;
  created_at: string;
  updated_at: string;
}

export interface LeaderboardEntry {
  rank: number;
  username: string;
  total_score: number;
  wins: number;
  total_games: number;
  win_rate: number;
  average_score: number;
  longest_word: string;
  longest_word_length: number;
}

export interface GameHistory {
  id: string;
  room_id: string;
  game_mode: string;
  result: string;
  score: number;
  words_played: number;
  started_at: string;
  ended_at: string;
  duration_seconds: number;
  final_position?: number;
  total_players: number;
  created_at: string;
}

export interface WordHistory {
  id: string;
  word: string;
  score: number;
  word_length: number;
  is_valid: boolean;
  played_at: string;
}

export interface QuickStats {
  total_users: number;
  total_games: number;
  total_words: number;
  top_player: {
    username: string;
    total_score: number;
  } | null;
}

const getAuthHeaders = () => {
  const token = localStorage.getItem('access_token');
  return {
    'Content-Type': 'application/json',
    ...(token && { Authorization: `Bearer ${token}` }),
  };
};

export const fetchUserStats = async (userId?: string): Promise<UserStats> => {
  const endpoint = userId ? `/stats/user/${userId}` : '/stats/my-stats';
  const headers = getAuthHeaders();
  
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    headers,
  });

  if (!response.ok) {
    throw new Error('Failed to fetch user stats');
  }

  return response.json();
};

export const fetchLeaderboard = async (
  limit: number = 10,
  sortBy: string = 'total_score'
): Promise<LeaderboardEntry[]> => {
  const response = await fetch(
    `${API_BASE_URL}/stats/leaderboard?limit=${limit}&sort_by=${sortBy}`,
    {
      headers: getAuthHeaders(),
    }
  );

  if (!response.ok) {
    throw new Error('Failed to fetch leaderboard');
  }

  return response.json();
};

export const fetchGameHistory = async (
  limit: number = 20,
  gameMode?: string
): Promise<GameHistory[]> => {
  const params = new URLSearchParams({ limit: limit.toString() });
  if (gameMode) {
    params.append('game_mode', gameMode);
  }

  const response = await fetch(
    `${API_BASE_URL}/stats/game-history?${params}`,
    {
      headers: getAuthHeaders(),
    }
  );

  if (!response.ok) {
    throw new Error('Failed to fetch game history');
  }

  return response.json();
};

export const fetchWordHistory = async (limit: number = 50): Promise<WordHistory[]> => {
  const response = await fetch(
    `${API_BASE_URL}/stats/word-history?limit=${limit}`,
    {
      headers: getAuthHeaders(),
    }
  );

  if (!response.ok) {
    throw new Error('Failed to fetch word history');
  }

  return response.json();
};

export const fetchQuickStats = async (): Promise<QuickStats> => {
  const response = await fetch(`${API_BASE_URL}/stats/quick-stats`);

  if (!response.ok) {
    throw new Error('Failed to fetch quick stats');
  }

  return response.json();
};
