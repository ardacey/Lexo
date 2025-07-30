import { useEffect, useRef } from 'react';
import type { GameState } from '../types';

type DispatchFn = (action: { type: 'TICK_TIMER' }) => void;

export function useGameTimer(state: GameState, dispatch: DispatchFn) {
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (state.gameStarted && !state.gameFinished && state.timeLeft > 0) {
      timerRef.current = setInterval(() => {
        dispatch({ type: 'TICK_TIMER' });
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [state.gameStarted, state.gameFinished, state.timeLeft, dispatch]);
}