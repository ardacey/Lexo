import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { toast } from 'sonner';
import type { GameState, ServerMessage, OpponentWord, Word } from '../types';

interface StoreState extends GameState {
  connect: (roomId: string, playerId: string, username: string) => void;
  disconnect: () => void;
  sendWord: (word: string) => void;
  _handleMessage: (msg: ServerMessage) => void;
  _resetState: () => void;
  _setupTimer: (endTime: number) => void;
  _clearTimer: () => void;
}

let socket: WebSocket | null = null;
let timerInterval: NodeJS.Timeout | null = null;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 3;
const RECONNECT_DELAY = 1000;

const initialState: GameState = {
  isConnected: false, 
  playerId: null, 
  isViewer: false, 
  players: [], 
  activePlayers: [],
  letterPool: [], 
  timeLeft: 0, 
  messages: [], 
  score: 0, 
  scores: [], 
  words: [], 
  opponentWords: [], 
  error: null, 
  gameStarted: false, 
  gameFinished: false, 
  finalScores: [], 
  winnerData: null, 
  isTie: false, 
  gameOverReason: null, 
  countdown: null, 
  gameEndTime: null, 
  roomUsedWords: new Set(), 
  roomStatus: 'waiting',
  gameMode: 'classic',
  leaderboard: [],
  eliminatedPlayers: [],
  eliminationInfo: null,
};

export const useGameStore = create<StoreState>()(
  devtools((set, get) => ({
    ...initialState,

    connect: (roomId, playerId, username) => {
      if (socket?.readyState === WebSocket.OPEN) {
        console.warn('WebSocket already connected');
        return;
      }

      const wsBaseUrl = import.meta.env.VITE_WS_BASE_URL || 'ws://localhost:8000/api/ws';
      const wsUrl = `${wsBaseUrl}/${roomId}/${playerId}`;
      
      try {
        socket = new WebSocket(wsUrl);
        
        socket.onopen = () => {
          set({ isConnected: true, error: null, playerId });
          toast.success("Connected to the game!");
          reconnectAttempts = 0;
        };

        socket.onmessage = (event) => {
          try {
            const data: ServerMessage = JSON.parse(event.data);
            get()._handleMessage(data);
          } catch (e) {
            console.error("Failed to parse server message:", e, event.data);
            toast.error("Received invalid message from server");
          }
        };

        socket.onclose = (event) => {
          if (!event.wasClean && reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
            reconnectAttempts++;
            toast.info(`Reconnecting... (Attempt ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})`);
            
            setTimeout(() => {
              get().connect(roomId, playerId, username);
            }, RECONNECT_DELAY * reconnectAttempts);
          } else if (!event.wasClean) {
            toast.error("Connection Lost", { 
              description: event.reason || "Server disconnected. Please refresh the page." 
            });
            set({ error: event.reason || "Server disconnected." });
            get()._resetState();
          }
        };
        
        socket.onerror = (error) => {
          console.error('WebSocket error:', error);
          toast.error("Connection Failed", { 
            description: "Could not connect to the server." 
          });
          set({ error: "Could not connect to the server." });
        };
      } catch (error) {
        console.error('Failed to create WebSocket:', error);
        toast.error("Failed to establish connection");
        set({ error: "Failed to establish connection" });
      }
    },

    disconnect: () => {
      if (socket) {
        socket.onclose = null;
        socket.onerror = null;
        socket.close(1000, "User disconnected");
      }
      get()._resetState();
    },

    sendWord: (word) => {
      const state = get();
      
      if (state.isViewer) {
        toast.error("Viewers cannot submit words.");
        return;
      }
      
      if (!state.gameStarted) {
        toast.error("Game has not started yet.");
        return;
      }
      
      const normalizedWord = word.trim().toLowerCase();
      if (state.roomUsedWords.has(normalizedWord)) {
        toast.error(`"${word}" has already been played.`);
        return;
      }
      
      if (socket?.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ type: 'word', word: normalizedWord }));
      } else {
        toast.error("Not connected to server");
      }
    },
    
    _resetState: () => {
      if (socket) {
        socket.onclose = null;
        socket.onerror = null;
        socket.close();
        socket = null;
      }
      get()._clearTimer();
      reconnectAttempts = 0;
      set(initialState);
    },

    _setupTimer: (endTime: number) => {
      get()._clearTimer();
      
      const updateTimer = () => {
        const now = Date.now() / 1000;
        const remaining = Math.max(0, Math.ceil(endTime - now));
        
        set({ timeLeft: remaining });
        
        if (remaining <= 0) {
          get()._clearTimer();
        }
      };
      
      updateTimer();
      timerInterval = setInterval(updateTimer, 1000);
    },

    _clearTimer: () => {
      if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
      }
    },

    _handleMessage: (msg) => {
      const state = get();
      
      switch (msg.type) {
        case 'room_state': {
          const roomUsedWords = new Set<string>(msg.used_words || []);
          set({
            players: msg.players || [],
            activePlayers: msg.active_players || [],
            isViewer: msg.is_viewer || false,
            letterPool: msg.letter_pool || [],
            scores: msg.scores || [],
            gameStarted: msg.game_started || false,
            timeLeft: msg.time_left || 0,
            roomUsedWords,
            roomStatus: msg.room_status || 'waiting',
            gameMode: msg.game_mode || 'classic',
            leaderboard: msg.leaderboard || msg.scores || []
          });
          
          if (msg.end_time && msg.game_started) {
            get()._setupTimer(msg.end_time);
          }
          break;
        }

        case 'player_joined':
          set({ 
            players: msg.players || [],
            leaderboard: msg.leaderboard || get().leaderboard
          });
          if (msg.message) {
            toast.info(msg.message);
          }
          break;

        case 'player_left':
          set({ players: msg.players || [] });
          if (msg.message) {
            toast.info(msg.message);
          }
          break;

        case 'countdown':
          set({ countdown: msg.time });
          break;

        case 'start_game':
          set({
            gameStarted: true,
            gameFinished: false,
            letterPool: msg.letterPool || [],
            timeLeft: msg.duration || 0,
            countdown: null,
            roomStatus: 'in_progress',
            gameMode: msg.gameMode || 'classic',
            leaderboard: msg.leaderboard || get().leaderboard,
            eliminationInfo: msg.elimination_info || null
          });
          
          if (msg.endTime) {
            get()._setupTimer(msg.endTime);
          }
          
          toast.success("Game started!");
          break;

        case 'word_result':
          if (msg.valid) {
            const newWord: Word = { text: msg.word, valid: true, score: msg.score };
            const newWords = [...state.words, newWord];
            const newUsedWords = new Set([...state.roomUsedWords, msg.word]);
            
            set({
              score: msg.totalScore || 0,
              words: newWords,
              letterPool: msg.letterPool || [],
              scores: msg.scores || [],
              roomUsedWords: newUsedWords,
              leaderboard: msg.leaderboard || get().leaderboard
            });
            
            toast.success(`"${msg.word}" +${msg.score} points!`);
          } else {
            toast.error(msg.message || "Invalid word");
          }
          break;

        case 'opponent_word':
        case 'player_word': {
          const playerName = msg.type === 'player_word' ? msg.player : 'Opponent';
          const newOpponentWord: OpponentWord = {
            word: msg.word,
            score: msg.score,
            player: playerName
          };
          const newOpponentWords = [...state.opponentWords, newOpponentWord];
          const newUsedWords = new Set([...state.roomUsedWords, msg.word]);
          
          set({
            opponentWords: newOpponentWords,
            letterPool: msg.letterPool || [],
            scores: msg.scores || [],
            roomUsedWords: newUsedWords,
            leaderboard: (msg.type === 'player_word' && msg.leaderboard) ? msg.leaderboard : get().leaderboard
          });
          
          toast.info(`${playerName}: "${msg.word}" +${msg.score}`);
          break;
        }

        case 'player_word_update': {
          const newUsedWords = new Set([...state.roomUsedWords, msg.word]);
          
          set({
            letterPool: msg.letterPool || [],
            scores: msg.scores || [],
            roomUsedWords: newUsedWords,
            leaderboard: msg.leaderboard || []
          });
          break;
        }

        case 'battle_royale_countdown':
          set({ 
            countdown: msg.time,
            leaderboard: msg.leaderboard || []
          });
          break;

        case 'countdown_stopped':
          set({ 
            countdown: null,
            roomStatus: msg.room_status || 'waiting'
          });
          if (msg.message) {
            toast.warning(msg.message);
          }
          break;

        case 'players_eliminated': {
          const eliminatedPlayers = msg.eliminated_players || [];
          set({ 
            eliminatedPlayers: [...state.eliminatedPlayers, ...eliminatedPlayers],
            leaderboard: msg.leaderboard || []
          });
          
          if (msg.message) {
            toast.warning(msg.message);
          }
          break;
        }

        case 'leaderboard_update':
          set({ 
            leaderboard: msg.leaderboard || [],
            eliminationInfo: msg.elimination_info || null
          });
          break;

        case 'elimination_update':
          set({ 
            eliminationInfo: msg.elimination_info || null
          });
          break;

        case 'game_over':
          get()._clearTimer();
          set({
            gameFinished: true,
            gameStarted: false,
            timeLeft: 0,
            finalScores: msg.scores || [],
            winnerData: msg.winner_data,
            isTie: msg.is_tie || false,
            gameOverReason: msg.reason || null,
            roomStatus: 'finished'
          });
          
          if (msg.is_tie) {
            toast.success("Game Over - It's a tie!");
          } else if (msg.winner_data) {
            const winners = msg.winner_data.usernames || [];
            toast.success(`Game Over - ${winners.join(', ')} won!`);
          }
          break;

        case 'battle_royale_game_over':
          get()._clearTimer();
          set({
            gameFinished: true,
            gameStarted: false,
            timeLeft: 0,
            finalScores: msg.scores || [],
            winnerData: msg.winner_data,
            isTie: msg.is_tie || false,
            gameOverReason: msg.reason || null,
            roomStatus: 'finished',
            leaderboard: msg.leaderboard || []
          });
          
          if (msg.is_tie) {
            toast.success("Battle Royale Over - It's a tie!");
          } else if (msg.winner_data) {
            const winners = msg.winner_data.usernames || [];
            toast.success(`Battle Royale Champion: ${winners.join(', ')}!`);
          }
          break;

        case 'error':
          toast.error(msg.message || "An error occurred");
          break;

        default:
          console.warn('Unknown message type received from server');
      }
    }
  }), {
    name: 'game-store',
    enabled: import.meta.env.DEV
  })
);
