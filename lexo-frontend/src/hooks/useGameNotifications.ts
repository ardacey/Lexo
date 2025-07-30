import { useEffect } from 'react';
import { toast } from 'sonner';
import type { GameState } from '../types';

export function useGameNotifications(state: GameState) {
  useEffect(() => {
    if (state.messages.length > 0) {
      const lastMessage = state.messages[state.messages.length - 1];
      if (!lastMessage) return;

      const lowerCaseMessage = lastMessage.toLowerCase();
      
      if (lowerCaseMessage.includes("error") || lowerCaseMessage.includes("invalid") || lowerCaseMessage.includes("not enough")) {
        toast.error(lastMessage);
      } else if (lowerCaseMessage.startsWith("correct!")) {
        toast.success(lastMessage);
      } else if (lowerCaseMessage.includes("wins") || lowerCaseMessage.includes("tie")) {
        toast.info(lastMessage, { duration: 5000 });
      } else {
        toast(lastMessage);
      }
    }
  }, [state.messages]);
}