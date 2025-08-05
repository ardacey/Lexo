export interface Word {
  text: string;
  valid: boolean;
  score?: number;
  player?: string;
}

export interface OpponentWord {
  word: string;
  score: number;
  player: string;
}

export interface LobbyRoom {
  id: string;
  name: string;
  player_count: number;
  total_count: number;
  max_players: number;
  min_players: number;
  game_mode: 'classic' | 'battle_royale';
  status: 'waiting' | 'countdown' | 'in_progress' | 'finished';
  is_joinable: boolean;
  is_viewable: boolean;
}

export interface UserState {
  username: string | null;
  currentRoomId: string | null;
}

export interface PlayerScore {
  username: string;
  score: number;
  is_eliminated?: boolean;
  is_active?: boolean;
  rank?: number;
  elimination_time?: string;
}

export interface WinnerData {
  usernames: string[];
  score: number;
}

export interface HighestScoringWord {
  word: string;
  score: number;
  player: string;
}

export interface EliminationInfo {
  next_elimination_time: number;
  next_elimination_player: string | null;
  next_elimination_players?: string[];
  players_per_elimination?: number;
}

export interface GameState {
  isConnected: boolean;
  playerId: string | null;
  isViewer: boolean;
  players: string[];
  activePlayers: string[];
  letterPool: string[];
  timeLeft: number;
  gameEndTime: number | null;
  messages: string[];
  score: number;
  scores: PlayerScore[];
  words: Word[];
  opponentWords: OpponentWord[];
  error: string | null;
  gameStarted: boolean;
  gameFinished: boolean;
  finalScores: PlayerScore[];
  winnerData: WinnerData | null;
  isTie: boolean;
  gameOverReason: string | null;
  highestScoringWord: HighestScoringWord | null;
  countdown: number | null;
  roomUsedWords: Set<string>;
  roomStatus: string;
  gameMode: 'classic' | 'battle_royale';
  leaderboard: PlayerScore[];
  eliminatedPlayers: string[];
  eliminationInfo: EliminationInfo | null;
}

export type ServerMessage =
  | { 
      type: "room_state"; 
      room_status: string; 
      game_mode: 'classic' | 'battle_royale';
      players: string[]; 
      active_players: string[]; 
      is_viewer: boolean; 
      letter_pool: string[]; 
      scores: PlayerScore[]; 
      player_words?: { [username: string]: string[] }; 
      time_left?: number; 
      end_time?: number; 
      game_started?: boolean; 
      used_words?: string[];
      max_players?: number;
      min_players?: number;
      leaderboard?: PlayerScore[];
    }
  | { type: "start_game"; letterPool: string[]; duration: number; endTime?: number; gameMode: 'classic' | 'battle_royale'; leaderboard?: PlayerScore[]; elimination_info?: EliminationInfo; }
  | { type: "player_joined"; message: string; players: string[]; game_mode?: 'classic' | 'battle_royale'; leaderboard?: PlayerScore[]; }
  | { type: "player_left"; message: string; players: string[] }
  | { type: "word_result"; word: string; valid: boolean; score?: number; message?: string; letterPool?: string[]; totalScore?: number; scores: PlayerScore[]; leaderboard?: PlayerScore[]; }
  | { type: "opponent_word"; word: string; score: number; letterPool: string[]; scores: PlayerScore[] }
  | { type: "player_word"; player: string; word: string; score: number; letterPool: string[]; scores: PlayerScore[]; leaderboard?: PlayerScore[]; }
  | { type: "player_word_update"; word: string; score: number; letterPool: string[]; scores: PlayerScore[]; leaderboard: PlayerScore[]; }
  | { type: "error"; message: string }
  | { type: "countdown"; time: number; message: string }
  | { type: "countdown_stopped"; message: string; room_status: string }
  | { type: "battle_royale_countdown"; time: number; message: string; leaderboard: PlayerScore[]; }
  | { type: "players_eliminated"; eliminated_players: string[]; message: string; leaderboard: PlayerScore[]; }
  | { type: "leaderboard_update"; leaderboard: PlayerScore[]; elimination_info?: EliminationInfo; }
  | { type: "elimination_update"; elimination_info: EliminationInfo; }
  | { type: "game_over"; scores: PlayerScore[]; winner_data: WinnerData | null; is_tie: boolean; highest_scoring_word?: HighestScoringWord; reason?: string }
  | { type: "battle_royale_game_over"; scores: PlayerScore[]; winner_data: WinnerData | null; is_tie: boolean; leaderboard: PlayerScore[]; gameMode: string; highest_scoring_word?: HighestScoringWord; reason?: string };