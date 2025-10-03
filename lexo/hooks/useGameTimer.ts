import { useState, useEffect, useRef } from 'react';

export const useGameTimer = (duration: number, onEnd: () => void, isActive: boolean = true) => {
  const [timeLeft, setTimeLeft] = useState(duration);
  const timerRef = useRef<any>(null);

  useEffect(() => {
    if (!isActive) return;

    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          if (timerRef.current) {
            clearInterval(timerRef.current);
          }
          onEnd();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [isActive, onEnd]);

  const resetTimer = (newDuration?: number) => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    setTimeLeft(newDuration ?? duration);
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return { timeLeft, resetTimer, formatTime: () => formatTime(timeLeft) };
};
