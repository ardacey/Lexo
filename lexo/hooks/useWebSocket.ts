import { useEffect, useRef, useState, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { WS_RECONNECT_DELAY, WS_MAX_RECONNECT_ATTEMPTS, WS_PING_INTERVAL } from '../utils/constants';

interface UseWebSocketProps {
  onMessage: (_data: any) => void;
  onError?: (_error: Error) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
  autoReconnect?: boolean;
}

export const useWebSocket = ({
  onMessage,
  onError,
  onConnect,
  onDisconnect,
  autoReconnect = true,
}: UseWebSocketProps) => {
  const { getToken } = useAuth();
  const [ws, setWs] = useState<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<any>(null);
  const pingIntervalRef = useRef<any>(null);
  const isManualClose = useRef(false);

  const clearTimers = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current);
      pingIntervalRef.current = null;
    }
  }, []);

  const startPingInterval = useCallback(() => {
    clearTimers();
    
    pingIntervalRef.current = setInterval(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        try {
          wsRef.current.send(JSON.stringify({ type: 'ping' }));
        } catch {
          // Silent ping error
        }
      }
    }, WS_PING_INTERVAL);
  }, [clearTimers]);

  const connect = useCallback(async (url: string, initialData?: any) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    try {
      // Get authentication token from Supabase
      const token = await getToken();
      if (!token) {
        throw new Error('Failed to get authentication token');
      }

      const websocket = new WebSocket(url);
      wsRef.current = websocket;

      websocket.onopen = () => {
        setIsConnected(true);
        setReconnectAttempts(0);
        setWs(websocket);
        
        // Send authentication data first
        const authData = {
          ...initialData,
          token: token,
        };
        
        if (authData) {
          websocket.send(JSON.stringify(authData));
        }
        
        startPingInterval();
        onConnect?.();
      };

      websocket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          onMessage(data);
        } catch {
          // Silent parse error
        }
      };

      websocket.onerror = () => {
        onError?.(new Error('WebSocket connection error'));
      };

      websocket.onclose = (event) => {
        setIsConnected(false);
        setWs(null);
        wsRef.current = null;
        clearTimers();
        onDisconnect?.();

        // Auto-reconnect if not manually closed
        if (autoReconnect && !isManualClose.current && reconnectAttempts < WS_MAX_RECONNECT_ATTEMPTS) {
          reconnectTimeoutRef.current = setTimeout(() => {
            setReconnectAttempts(prev => prev + 1);
            connect(url, initialData);
          }, WS_RECONNECT_DELAY);
        } else if (reconnectAttempts >= WS_MAX_RECONNECT_ATTEMPTS) {
          onError?.(new Error('Failed to reconnect to server'));
        }
      };
    } catch (error) {
      onError?.(error as Error);
    }
  }, [autoReconnect, reconnectAttempts, onMessage, onConnect, onDisconnect, onError, startPingInterval, clearTimers, getToken]);

  const disconnect = useCallback(() => {
    isManualClose.current = true;
    clearTimers();
    
    if (wsRef.current) {
      try {
        wsRef.current.close();
      } catch {
        // Silent close error
      }
      wsRef.current = null;
    }
    
    setWs(null);
    setIsConnected(false);
    setReconnectAttempts(0);
  }, [clearTimers]);

  const sendMessage = useCallback((data: any) => {
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

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isManualClose.current = true;
      clearTimers();
      if (wsRef.current) {
        try {
          wsRef.current.close();
        } catch {
          // Silent close error
        }
      }
    };
  }, [clearTimers]);

  return {
    ws,
    isConnected,
    reconnectAttempts,
    connect,
    disconnect,
    sendMessage,
  };
};
