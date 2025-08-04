import { create } from 'zustand';
import { 
  startPracticeSession, 
  submitPracticeWord, 
  getPracticeStatus, 
  endPracticeSession,
  type PracticeResults 
} from '../api/practice';
import { createLogger } from '../utils/logger';

const logger = createLogger('practice-store');

interface PracticeState {
  sessionId: string | null;
  isActive: boolean;
  loading: boolean;
  letterPool: string[];
  score: number;
  wordsFound: string[];
  timeRemaining: number;
  results: PracticeResults | null;
  currentWord: string;
  lastSubmission: {
    success: boolean;
    message: string;
  } | null;
  
  startSession: (duration?: number) => Promise<void>;
  submitWord: (word: string) => Promise<void>;
  updateStatus: () => Promise<void>;
  endSession: () => Promise<void>;
  setCurrentWord: (word: string) => void;
  resetSession: () => void;
}

const initialState = {
  sessionId: null,
  isActive: false,
  loading: false,
  letterPool: [],
  score: 0,
  wordsFound: [],
  timeRemaining: 0,
  results: null,
  currentWord: '',
  lastSubmission: null,
};

export const usePracticeStore = create<PracticeState>((set, get) => ({
  ...initialState,
  
  startSession: async (duration = 300) => {
    set({ loading: true });
    try {
      const session = await startPracticeSession(duration);
      set({
        sessionId: session.session_id,
        isActive: true,
        letterPool: session.letter_pool,
        score: session.score,
        wordsFound: session.words_found,
        timeRemaining: session.time_remaining,
        loading: false,
        results: null,
        lastSubmission: null,
      });
    } catch (error) {
      logger.error('Failed to start practice session:', error);
      set({ loading: false });
      throw error;
    }
  },
  
  submitWord: async (word: string) => {
    const { sessionId } = get();
    if (!sessionId) return;
    
    set({ loading: true });
    try {
      const result = await submitPracticeWord(sessionId, word);
      set({
        score: result.total_score || result.score,
        letterPool: result.letter_pool,
        wordsFound: result.words_found || get().wordsFound,
        timeRemaining: result.time_remaining,
        currentWord: '',
        lastSubmission: {
          success: result.success,
          message: result.message,
        },
        loading: false,
      });
      
      if (result.time_remaining <= 0) {
        set({ isActive: false });
      }
    } catch (error) {
      logger.error('Failed to submit word:', error);
      set({ loading: false });
      throw error;
    }
  },
  
  updateStatus: async () => {
    const { sessionId } = get();
    if (!sessionId) return;
    
    try {
      const status = await getPracticeStatus(sessionId);
      set({
        letterPool: status.letter_pool,
        score: status.score,
        wordsFound: status.words_found,
        timeRemaining: status.time_remaining,
        isActive: status.is_active,
      });
    } catch (error) {
      logger.error('Failed to update status:', error);
    }
  },
  
  endSession: async () => {
    const { sessionId } = get();
    if (!sessionId) return;
    
    set({ loading: true });
    try {
      const results = await endPracticeSession(sessionId);
      set({
        isActive: false,
        results,
        loading: false,
      });
    } catch (error) {
      logger.error('Failed to end session:', error);
      set({ loading: false });
      throw error;
    }
  },
  
  setCurrentWord: (word: string) => {
    set({ currentWord: word });
  },
  
  resetSession: () => {
    set({ ...initialState });
  },
}));
