import { useEffect, useRef, useState, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { WS_MAX_RECONNECT_ATTEMPTS, WS_PING_INTERVAL } from '../utils/constants';

// Exponential backoff with full-jitter: base * 2^attempt ± random, capped at 30s.
const backoffDelay = (attempt: number): number => {
  const base = 1_000;
  const cap = 30_000;
  const expo = Math.min(base * 2 ** attempt, cap);
  return expo / 2 + Math.random() * (expo / 2);
};

interface UseWebSocketProps {
  onMessage: (_data: any) => void;
  onError?: (_error: Error) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
  onTokenExpiring?: () => void;
  autoReconnect?: boolean;
}

export const useWebSocket = ({
  onMessage,
  onError,
  onConnect,
  onDisconnect,
  onTokenExpiring,
  autoReconnect = true,
}: UseWebSocketProps) => {
  const { getToken } = useAuth();
  const [ws, setWs] = useState<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [reconnectAttempts, setReconnectAttempts] = useState(0);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const tokenExpiryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isManualClose = useRef(false);
  const reconnectAttemptsRef = useRef(0);

  // Keep stable refs for callbacks so reconnect closure stays current
  const urlRef = useRef<string>('');
  const initialDataRef = useRef<any>(null);
  const onMessageRef = useRef(onMessage);
  const onConnectRef = useRef(onConnect);
  const onDisconnectRef = useRef(onDisconnect);
  const onErrorRef = useRef(onError);
  const onTokenExpiringRef = useRef(onTokenExpiring);

  useEffect(() => { onMessageRef.current = onMessage; }, [onMessage]);
  useEffect(() => { onConnectRef.current = onConnect; }, [onConnect]);
  useEffect(() => { onDisconnectRef.current = onDisconnect; }, [onDisconnect]);
  useEffect(() => { onErrorRef.current = onError; }, [onError]);
  useEffect(() => { onTokenExpiringRef.current = onTokenExpiring; }, [onTokenExpiring]);

  const clearTimers = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current);
      pingIntervalRef.current = null;
    }
    if (tokenExpiryTimeoutRef.current) {
      clearTimeout(tokenExpiryTimeoutRef.current);
      tokenExpiryTimeoutRef.current = null;
    }
  }, []);

  const startPingInterval = useCallback(() => {
    if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
    pingIntervalRef.current = setInterval(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        try {
          wsRef.current.send(JSON.stringify({ type: 'ping', client_time: Date.now() }));
        } catch {
          // silent
        }
      }
    }, WS_PING_INTERVAL);
  }, []);

  const connect = useCallback(async (url: string, initialData?: any) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    urlRef.current = url;
    initialDataRef.current = initialData ?? null;

    try {
      const token = await getToken();
      if (!token) throw new Error('Failed to get authentication token');

      const websocket = new WebSocket(url);
      wsRef.current = websocket;

      websocket.onopen = () => {
        setIsConnected(true);
        reconnectAttemptsRef.current = 0;
        setReconnectAttempts(0);
        setWs(websocket);
        websocket.send(JSON.stringify({ ...(initialData ?? {}), token }));
        startPingInterval();
        onConnectRef.current?.();
      };

      websocket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          // Proactive token refresh: schedule reconnect before JWT expires
          if (data.type === 'pong' && data.token_expiring) {
            const expiresIn: number = data.expires_in ?? 60;
            const reconnectIn = Math.max((expiresIn - 30) * 1_000, 0);
            if (tokenExpiryTimeoutRef.current) clearTimeout(tokenExpiryTimeoutRef.current);
            tokenExpiryTimeoutRef.current = setTimeout(() => {
              onTokenExpiringRef.current?.();
              // Trigger a clean reconnect with a fresh token
              if (!isManualClose.current && wsRef.current?.readyState === WebSocket.OPEN) {
                wsRef.current.close(1000, 'token_refresh');
              }
            }, reconnectIn);
          }

          onMessageRef.current(data);
        } catch {
          // silent parse error
        }
      };

      websocket.onerror = () => {
        onErrorRef.current?.(new Error('WebSocket connection error'));
      };

      websocket.onclose = () => {
        setIsConnected(false);
        setWs(null);
        wsRef.current = null;
        clearTimers();
        onDisconnectRef.current?.();

        if (!autoReconnect || isManualClose.current) return;

        const attempts = reconnectAttemptsRef.current;
        if (attempts >= WS_MAX_RECONNECT_ATTEMPTS) {
          onErrorRef.current?.(new Error('Sunucuya bağlanılamadı. Lütfen tekrar deneyin.'));
          return;
        }

        const delay = backoffDelay(attempts);
        reconnectAttemptsRef.current = attempts + 1;
        setReconnectAttempts(attempts + 1);
        reconnectTimeoutRef.current = setTimeout(() => {
          connect(urlRef.current, initialDataRef.current);
        }, delay);
      };
    } catch (error) {
      onErrorRef.current?.(error as Error);
    }
  }, [autoReconnect, getToken, startPingInterval, clearTimers]);

  const disconnect = useCallback(() => {
    isManualClose.current = true;
    clearTimers();
    if (wsRef.current) {
      try { wsRef.current.close(); } catch { /* silent */ }
      wsRef.current = null;
    }
    setWs(null);
    setIsConnected(false);
    reconnectAttemptsRef.current = 0;
    setReconnectAttempts(0);
  }, [clearTimers]);

  const sendMessage = useCallback((data: any): boolean => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      try {
        wsRef.current.send(JSON.stringify(data));
        return true;
      } catch {
        return false;
      }
    }
    return false;
  }, []);

  // Reset manual close flag when consumer calls connect again
  const connectWrapped = useCallback((url: string, initialData?: any) => {
    isManualClose.current = false;
    reconnectAttemptsRef.current = 0;
    return connect(url, initialData);
  }, [connect]);

  useEffect(() => {
    return () => {
      isManualClose.current = true;
      clearTimers();
      if (wsRef.current) {
        try { wsRef.current.close(); } catch { /* silent */ }
      }
    };
  }, [clearTimers]);

  return {
    ws,
    isConnected,
    reconnectAttempts,
    connect: connectWrapped,
    disconnect,
    sendMessage,
  };
};
