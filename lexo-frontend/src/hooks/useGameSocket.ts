// src/hooks/useGameSocket.ts
import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import { useGameReducer } from './useGameReducer';
import { useWebSocket } from './useWebSocket';
import { useGameNotifications } from './useGameNotifications';
import { useGameTimer } from './useGameTimer';
import type { ServerMessage } from '../types';

export function useGameSocket() {
  const [webSocketUrl, setWebSocketUrl] = useState<string | null>(null);
  const { state, dispatch } = useGameReducer();

  // Bildirim ve zamanlayıcı hook'larını state ve dispatch ile besle
  useGameNotifications(state);
  useGameTimer(state, dispatch);

  // WebSocket event'leri için callback fonksiyonları
  const onOpen = useCallback(() => dispatch({ type: 'CONNECTION_SUCCESS' }), [dispatch]);
  const onClose = useCallback((event: CloseEvent) => {
    if (!event.wasClean) {
      dispatch({ type: 'CONNECTION_ERROR', payload: `Connection closed unexpectedly. Reason: ${event.reason || 'Unknown'}` });
    } else {
      dispatch({ type: 'CONNECTION_CLOSED' });
    }
    setWebSocketUrl(null); // Bağlantı kapandığında URL'yi sıfırla
  }, [dispatch]);
  const onError = useCallback(() => dispatch({ type: 'CONNECTION_ERROR', payload: 'WebSocket connection failed.' }), [dispatch]);
  const onMessage = useCallback((event: MessageEvent) => {
    try {
      const data: ServerMessage = JSON.parse(event.data);
      dispatch({ type: 'RECEIVE_MESSAGE', payload: data });
    } catch (e) {
      console.error("Failed to parse server message:", event.data, e);
    }
  }, [dispatch]);

  // WebSocket hook'unu başlat
  const { sendMessage, closeConnection } = useWebSocket({
    url: webSocketUrl,
    onOpen,
    onClose,
    onError,
    onMessage
  });

  // Dışarıdan çağrılacak fonksiyonlar
  const connectToRoom = (roomId: string, username: string) => {
    if (!roomId || !username) return;
    const wsUrl = `ws://localhost:8000/api/ws/${roomId}?username=${encodeURIComponent(username)}`;
    setWebSocketUrl(wsUrl); // URL'yi ayarlayarak WebSocket bağlantısını tetikle
  };

  const disconnect = () => {
    closeConnection(); // WebSocket'i kapat
    dispatch({ type: 'CONNECTION_CLOSED' }); // State'i hemen temizle
    setWebSocketUrl(null);
  };

  const sendWord = (word: string) => {
    if (state.roomUsedWords.has(word.trim().toLowerCase())) {
        toast.error(`"${word}" has already been played.`);
        return;
    }
    if (state.isConnected) {
      sendMessage({ type: 'word', word });
    } else {
      toast.error("Connection Error", { description: "Not connected to the game server." });
    }
  };

  return { state, connectToRoom, sendWord, disconnect };
}