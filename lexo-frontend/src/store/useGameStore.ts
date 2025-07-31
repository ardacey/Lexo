import { create } from 'zustand';
import { toast } from 'sonner';
import type { GameState, ServerMessage } from '../types';

interface StoreState extends GameState {
  connect: (roomId: string, playerId: string, username: string) => void;
  disconnect: () => void;
  sendWord: (word: string) => void;
  _handleMessage: (msg: ServerMessage) => void;
  _resetState: () => void;
}

let socket: WebSocket | null = null;
let timerInterval: NodeJS.Timeout | null = null;

const initialState: GameState = {
  isConnected: false, playerId: null, isViewer: false, players: [], activePlayers: [],
  letterPool: [], timeLeft: 0, messages: [], score: 0, scores: [], words: [], 
  opponentWords: [], error: null, gameStarted: false, gameFinished: false, 
  finalScores: [], winnerData: null, isTie: false, gameOverReason: null, 
  countdown: null, gameEndTime: null, roomUsedWords: new Set(), roomStatus: 'waiting',
};

export const useGameStore = create<StoreState>((set, get) => ({
  ...initialState,

  connect: (roomId, playerId) => {
    if (socket) return;

    const wsBaseUrl = import.meta.env.VITE_WS_BASE_URL || 'ws://localhost:8000/api/ws';
    const wsUrl = `${wsBaseUrl}/${roomId}/${playerId}`;
    socket = new WebSocket(wsUrl);

    socket.onopen = () => {
      set({ isConnected: true, error: null, playerId });
      toast.success("Connected to the game!");
    };

    socket.onmessage = (event) => {
      try {
        const data: ServerMessage = JSON.parse(event.data);
        get()._handleMessage(data);
      } catch (e) {
        console.error("Failed to parse server message:", e);
      }
    };

    socket.onclose = (event) => {
      if (!event.wasClean) {
        toast.error("Connection Lost", { description: event.reason || "Server disconnected." });
        set({ error: event.reason || "Server disconnected." });
      }
      get()._resetState();
    };
    
    socket.onerror = () => {
        toast.error("Connection Failed", { description: "Could not connect to the server."});
        set({ error: "Could not connect to the server." });
        get()._resetState();
    };
  },

  disconnect: () => {
    if (socket) {
      socket.onclose = null;
      socket.close();
    }
    get()._resetState();
  },

  sendWord: (word) => {
    if (get().isViewer) {
      toast.error("Viewers cannot submit words.");
      return;
    }
    if (get().roomUsedWords.has(word.trim().toLowerCase())) {
        toast.error(`"${word}" has already been played.`);
        return;
    }
    if (socket?.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ type: 'word', word }));
    }
  },
  
  _resetState: () => {
      socket = null;
      if(timerInterval) clearInterval(timerInterval);
      set(initialState);
  },

  _handleMessage: (msg) => {
    switch (msg.type) {
      case 'room_state':
        set(state => { 
          const updates: Partial<GameState> = {
            players: msg.players,
            activePlayers: msg.active_players,
            isViewer: msg.is_viewer,
            roomStatus: msg.room_status,
            letterPool: msg.letter_pool,
            scores: msg.scores,
            gameStarted: msg.room_status === 'in_progress'
          };
          
          if (msg.is_viewer && msg.time_left && msg.end_time && msg.room_status === 'in_progress') {
            if (timerInterval) clearInterval(timerInterval);
            
            const gameEndTime = msg.end_time * 1000;
            updates.timeLeft = msg.time_left;
            updates.gameEndTime = gameEndTime;
            
            timerInterval = setInterval(() => {
              const now = Date.now();
              const newTimeLeft = Math.round((gameEndTime - now) / 1000);
              if (newTimeLeft <= 0) {
                if(timerInterval) clearInterval(timerInterval);
              }
              set(state => ({ ...state, timeLeft: Math.max(0, newTimeLeft) }));
            }, 1000);
          }
          
          if (msg.is_viewer && msg.player_words && msg.scores.length >= 2) {
            const firstPlayer = msg.scores[0].username;
            const secondPlayer = msg.scores[1].username;
            
            updates.words = (msg.player_words[firstPlayer] || []).map(word => ({ text: word, valid: true }));
            updates.opponentWords = (msg.player_words[secondPlayer] || []).map(word => ({ text: word, valid: true }));
          }
          
          return { ...state, ...updates };
        });
        break;
      case 'player_joined':
        set({ players: msg.players });
        toast.info(msg.message);
        break;
      case 'player_left':
        set({ players: msg.players });
        toast.warning(msg.message);
        break;
      case 'countdown':
        set({ countdown: msg.time, roomStatus: 'countdown' });
        break;
      case 'start_game': {
        if(timerInterval) clearInterval(timerInterval);
        const gameEndTime = msg.endTime ? msg.endTime * 1000 : Date.now() + msg.duration * 1000;
        set({
            gameStarted: true, countdown: null, gameFinished: false, words: [], opponentWords: [],
            scores: [], roomUsedWords: new Set(), letterPool: msg.letterPool, 
            timeLeft: msg.duration, gameEndTime: gameEndTime, roomStatus: 'in_progress'
        });
        timerInterval = setInterval(() => {
            const now = Date.now();
            const newTimeLeft = Math.round((get().gameEndTime! - now) / 1000);
            if (newTimeLeft <= 0) {
                if(timerInterval) clearInterval(timerInterval);
            }
            set({ timeLeft: Math.max(0, newTimeLeft) });
        }, 1000);
        break;
      }
      case 'word_result':
        if(msg.valid) {
            const state = get();
            if (!state.isViewer) {
                toast.success(`Correct! "+${msg.score}" for "${msg.word}"`);
            }
            set(state => ({
                words: [...state.words, { text: msg.word, valid: true }],
                scores: msg.scores,
                letterPool: msg.letterPool,
                roomUsedWords: new Set(state.roomUsedWords).add(msg.word)
            }));
        } else {
            toast.error(msg.message || "Invalid word");
        }
        break;
      case 'opponent_word':
        set(state => ({
            opponentWords: [...state.opponentWords, { text: msg.word, valid: true }],
            scores: msg.scores,
            letterPool: msg.letterPool,
            roomUsedWords: new Set(state.roomUsedWords).add(msg.word)
        }));
        break;
      case 'player_word': {
        const state = get();
        const playerIndex = state.scores.findIndex(s => s.username === msg.player);
        if (playerIndex === 0) {
            set(state => ({
                words: [...state.words, { text: msg.word, valid: true }],
                scores: msg.scores,
                letterPool: msg.letterPool,
                roomUsedWords: new Set(state.roomUsedWords).add(msg.word)
            }));
        } else if (playerIndex === 1) {
            set(state => ({
                opponentWords: [...state.opponentWords, { text: msg.word, valid: true }],
                scores: msg.scores,
                letterPool: msg.letterPool,
                roomUsedWords: new Set(state.roomUsedWords).add(msg.word)
            }));
        }
        break;
      }
      case 'game_over': {
        if(timerInterval) clearInterval(timerInterval);
        let gameOverMessage = "The game has ended!";
        if (msg.is_tie) gameOverMessage = `It's a tie! Well played.`;
        else if (msg.winner_data) gameOverMessage = `${msg.winner_data.usernames.join(' & ')} wins!`;
        toast.info(gameOverMessage, { duration: 5000 });
        set({
            gameFinished: true, gameStarted: false, timeLeft: 0, finalScores: msg.scores,
            winnerData: msg.winner_data, isTie: msg.is_tie, gameOverReason: msg.reason || null,
            roomStatus: 'finished'
        });
        break;
      }
      case 'error':
        toast.error(msg.message);
        break;
    }
  }
}));