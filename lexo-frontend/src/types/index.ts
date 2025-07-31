export interface Word {
  text: string;
  valid: boolean;
}

export interface LobbyRoom {
  id: string;
  name: string;
  player_count: number;
  total_count: number;
  max_players: number;
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
}

export interface WinnerData {
  usernames: string[];
  score: number;
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
  opponentWords: Word[];
  error: string | null;
  gameStarted: boolean;
  gameFinished: boolean;
  finalScores: PlayerScore[];
  winnerData: WinnerData | null;
  isTie: boolean;
  gameOverReason: string | null;
  countdown: number | null;
  roomUsedWords: Set<string>;
  roomStatus: string;
}

export type ServerMessage =
  | { type: "room_state"; room_status: string; players: string[]; active_players: string[]; is_viewer: boolean; letter_pool: string[]; scores: PlayerScore[]; player_words?: { [username: string]: string[] }; time_left?: number; end_time?: number }
  | { type: "start_game"; letterPool: string[]; duration: number; endTime?: number; }
  | { type: "player_joined"; message: string; players: string[] }
  | { type: "player_left"; message: string; players: string[] }
  | { type: "word_result"; word: string; valid: boolean; score?: number; message?: string; letterPool?: string[]; totalScore?: number; scores: PlayerScore[] }
  | { type: "opponent_word"; word: string; score: number; letterPool: string[]; scores: PlayerScore[] }
  | { type: "player_word"; player: string; word: string; score: number; letterPool: string[]; scores: PlayerScore[] }
  | { type: "error"; message: string }
  | { type: "countdown"; time: number; message: string }
  | { type: "game_over"; scores: PlayerScore[]; winner_data: WinnerData | null; is_tie: boolean; reason?: string };