import { useEffect, useRef, useState, useCallback } from 'react';
import { WS_BASE_URL, WS_RECONNECT_DELAY, WS_MAX_RECONNECT_ATTEMPTS, WS_PING_INTERVAL } from '../utils/constants';

interface UseWebSocketProps {
  onMessage: (data: any) => void;
  onError?: (error: Error) => void;
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
        } catch (error) {
          console.error('Error sending ping:', error);
        }
      }
    }, WS_PING_INTERVAL);
  }, [clearTimers]);

  const connect = useCallback((url: string, initialData?: any) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      console.log('WebSocket already connected');
      return;
    }

    try {
      const websocket = new WebSocket(url);
      wsRef.current = websocket;

      websocket.onopen = () => {
        console.log('WebSocket connected');
        setIsConnected(true);
        setReconnectAttempts(0);
        setWs(websocket);
        
        if (initialData) {
          websocket.send(JSON.stringify(initialData));
        }
        
        startPingInterval();
        onConnect?.();
      };

      websocket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          onMessage(data);
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };

      websocket.onerror = (error) => {
        console.error('WebSocket error:', error);
        onError?.(new Error('WebSocket connection error'));
      };

      websocket.onclose = (event) => {
        console.log('WebSocket closed:', event.code, event.reason);
        setIsConnected(false);
        setWs(null);
        wsRef.current = null;
        clearTimers();
        onDisconnect?.();

        // Auto-reconnect if not manually closed
        if (autoReconnect && !isManualClose.current && reconnectAttempts < WS_MAX_RECONNECT_ATTEMPTS) {
          console.log(`Attempting to reconnect... (${reconnectAttempts + 1}/${WS_MAX_RECONNECT_ATTEMPTS})`);
          
          reconnectTimeoutRef.current = setTimeout(() => {
            setReconnectAttempts(prev => prev + 1);
            connect(url, initialData);
          }, WS_RECONNECT_DELAY);
        } else if (reconnectAttempts >= WS_MAX_RECONNECT_ATTEMPTS) {
          console.error('Max reconnection attempts reached');
          onError?.(new Error('Failed to reconnect to server'));
        }
      };
    } catch (error) {
      console.error('Error creating WebSocket:', error);
      onError?.(error as Error);
    }
  }, [autoReconnect, reconnectAttempts, onMessage, onConnect, onDisconnect, onError, startPingInterval, clearTimers]);

  const disconnect = useCallback(() => {
    isManualClose.current = true;
    clearTimers();
    
    if (wsRef.current) {
      try {
        wsRef.current.close();
      } catch (error) {
        console.error('Error closing WebSocket:', error);
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
      } catch (error) {
        console.error('Error sending message:', error);
        return false;
      }
    }
    console.warn('WebSocket is not connected');
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
        } catch (error) {
          console.error('Error closing WebSocket on unmount:', error);
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
