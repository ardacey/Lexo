import { useReducer } from 'react';
import type { GameState, ServerMessage } from '../types';

type Action =
  | { type: 'CONNECTION_SUCCESS' }
  | { type: 'CONNECTION_CLOSED' }
  | { type: 'CONNECTION_ERROR'; payload: string }
  | { type: 'RECEIVE_MESSAGE'; payload: ServerMessage }
  | { type: 'TICK_TIMER' };

const initialState: GameState = {
  isConnected: false,
  playerId: null,
  players: [],
  letterPool: [],
  timeLeft: 0,
  messages: [],
  score: 0,
  scores: [],
  words: [],
  error: null,
  gameStarted: false,
  gameFinished: false,
  finalScores: [],
  winnerData: null,
  isTie: false,
  gameOverReason: null,
  countdown: null,
  opponentWords: [],
  gameEndTime: null,
  roomUsedWords: new Set()
};


function gameReducer(state: GameState, action: Action): GameState {
  switch (action.type) {
    case 'CONNECTION_SUCCESS':
      return { ...state, isConnected: true, error: null };

    case 'CONNECTION_CLOSED':
      return initialState;

    case 'CONNECTION_ERROR':
      return { ...state, isConnected: false, error: action.payload };

    case 'RECEIVE_MESSAGE': {
      const msg = action.payload;
      switch (msg.type) {
        case 'init':
          return {
            ...state,
            playerId: msg.playerId,
            players: msg.players,
            messages: [...state.messages, msg.message],
          };

        case 'countdown':
          return {
            ...state,
            countdown: msg.time,
            messages: [...state.messages, msg.message],
          };

        case 'player_joined':
        case 'player_left':
          return {
            ...state,
            players: msg.players,
            messages: [...state.messages, msg.message],
          };

        case 'start_game': {
          const initialScores = state.players.map(username => ({ username, score: 0 }));
          return {
            ...state,
            gameStarted: true,
            countdown: null,
            gameFinished: false,
            finalScores: [],
            winnerData: null,
            isTie: false,
            gameOverReason: null,
            words: [],
            opponentWords: [],
            score: 0,
            scores: initialScores,
            letterPool: msg.letterPool,
            gameEndTime: msg.endTime ? msg.endTime * 1000 : Date.now() + msg.duration * 1000,
            timeLeft: msg.duration,
            messages: [...state.messages, `Game started! You have ${msg.duration} seconds.`],
            roomUsedWords: new Set(),
          };
        }

        case 'word_result':
          if (msg.valid) {
            const successMessage = `Correct! "+${msg.score}" for "${msg.word}"`;
            const newUsedWords = new Set(state.roomUsedWords);
            newUsedWords.add(msg.word);
            return {
              ...state,
              score: msg.totalScore ?? state.score,
              words: [...state.words, { text: msg.word, valid: true }],
              letterPool: msg.letterPool ?? state.letterPool,
              scores: msg.scores ?? state.scores,
              messages: [...state.messages, successMessage],
              roomUsedWords: newUsedWords,
            };
          }
          return {
            ...state,
            words: [...state.words, { text: msg.word, valid: false }],
            messages: [...state.messages, msg.message ?? 'Invalid word'],
          };
        
        case 'opponent_word': {
            const newUsedWords = new Set(state.roomUsedWords);
            newUsedWords.add(msg.word);
            return {
                ...state,
                opponentWords: [...state.opponentWords, { text: msg.word, valid: true }],
                letterPool: msg.letterPool,
                messages: [...state.messages, `Opponent played "${msg.word}" for ${msg.score} points.`],
                scores: msg.scores ?? state.scores,
                roomUsedWords: newUsedWords,
            };
        }

        case 'game_over': {
          let gameOverMessage = "The game has ended!";
          if (msg.is_tie) {
            gameOverMessage = `It's a tie! Well played.`;
          } else if (msg.winner_data) {
            gameOverMessage = `${msg.winner_data.usernames.join(' & ')} wins the game!`;
          }
          return {
            ...state,
            timeLeft: 0,
            gameStarted: false,
            gameFinished: true,
            finalScores: msg.scores,
            winnerData: msg.winner_data,
            isTie: msg.is_tie,
            gameOverReason: msg.reason || null,
            messages: [...state.messages, gameOverMessage],
          };
        }
          
        case 'error':
            return { ...state, messages: [...state.messages, msg.message] };
      }
      return state;
    }

    case 'TICK_TIMER':
        if (state.gameEndTime) {
            const now = Date.now();
            const newTimeLeft = Math.round((state.gameEndTime - now) / 1000);
            return { ...state, timeLeft: Math.max(0, newTimeLeft) };
        }
        return { ...state, timeLeft: Math.max(0, state.timeLeft - 1) };

    default:
      return state;
  }
}

export function useGameReducer() {
  const [state, dispatch] = useReducer(gameReducer, initialState);
  return { state, dispatch };
}