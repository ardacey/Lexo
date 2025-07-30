import { useRef, useEffect, useCallback } from 'react';

interface WebSocketOptions {
  url: string | null;
  onOpen?: () => void;
  onClose?: (event: CloseEvent) => void;
  onError?: () => void;
  onMessage?: (event: MessageEvent) => void;
}

export function useWebSocket({ url, onOpen, onClose, onError, onMessage }: WebSocketOptions) {
  const ws = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (!url || ws.current) {
      return;
    }

    const socket = new WebSocket(url);
    ws.current = socket;

    if (onOpen) socket.onopen = onOpen;
    if (onClose) socket.onclose = onClose;
    if (onError) socket.onerror = onError;
    if (onMessage) socket.onmessage = onMessage;

    return () => {
      if (socket.readyState === WebSocket.OPEN) {
        socket.close();
      }
      ws.current = null;
    };
  }, [url, onOpen, onClose, onError, onMessage]);

  const sendMessage = useCallback((data: unknown) => {
    if (ws.current?.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify(data));
    } else {
      console.error("WebSocket is not connected.");
    }
  }, []);

  // Dışarıdan bağlantıyı kapatmak için bir fonksiyon
  const closeConnection = useCallback(() => {
    if (ws.current) {
      ws.current.close();
      ws.current = null;
    }
  }, []);

  return { sendMessage, closeConnection };
}