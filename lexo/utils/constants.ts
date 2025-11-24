export const LETTER_FREQUENCY: { [key: string]: number } = {
  'a': 11.92, 'e': 8.91, 'i': 8.60, 'ı': 5.12, 'n': 7.49,
  'r': 6.95, 'l': 5.75, 'k': 4.72, 'd': 4.68, 't': 3.31,
  's': 3.00, 'm': 2.99, 'y': 2.96, 'u': 2.88, 'o': 2.61,
  'b': 2.56, 'ü': 1.85, 'z': 1.50, 'ş': 1.48, 'ç': 1.14,
  'g': 1.12, 'ğ': 1.12, 'p': 0.89, 'h': 0.84, 'v': 0.82,
  'c': 0.80, 'ö': 0.85, 'j': 0.03, 'f': 0.44
};

export const LETTER_SCORES: { [key: string]: number } = {
  'a': 1, 'e': 1, 'i': 1, 'ı': 1, 'n': 1, 'r': 1, 'l': 1,
  'k': 2, 'd': 2, 't': 2, 's': 2, 'm': 2, 'y': 2, 'u': 2,
  'o': 3, 'b': 3, 'ü': 3, 'z': 4, 'ş': 4, 'ç': 4,
  'g': 5, 'ğ': 5, 'p': 5, 'h': 5, 'v': 5, 'c': 5, 'ö': 5,
  'j': 10, 'f': 5
};

export const VOWELS = ['a', 'e', 'i', 'ı', 'o', 'ö', 'u', 'ü'];
export const CONSONANTS = ['b', 'c', 'ç', 'd', 'f', 'g', 'ğ', 'h', 'j', 'k', 'l', 'm', 'n', 'p', 'r', 's', 'ş', 't', 'v', 'y', 'z'];

export const MIN_WORD_LENGTH = 2;
export const MAX_WORD_LENGTH = 15;
export const GAME_DURATION = 60;
export const INITIAL_POOL_SIZE = 16;

export { API_BASE_URL, WS_BASE_URL, ENVIRONMENT as APP_ENV, IS_PRODUCTION } from './environment';

// WebSocket configuration
export const WS_RECONNECT_DELAY = 3000; // 3 seconds
export const WS_MAX_RECONNECT_ATTEMPTS = 5;
export const WS_PING_INTERVAL = 25000; // 25 seconds
