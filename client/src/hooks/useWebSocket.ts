import { useEffect, useRef, useCallback } from 'react';

/** WebSocketで送受信するメッセージの共通形式 */
export interface WsMessage {
  type: string;
  payload?: Record<string, unknown>;
}

/** onMessage コールバックの型 */
export type WsMessageHandler = (type: string, payload: Record<string, unknown>) => void;

/**
 * WebSocket接続を管理するフック
 * @param onMessage - メッセージ受信時に呼び出されるコールバック（refで保持するためstaleにならない）
 * @param onOpen - 接続確立（readyState === OPEN）時に呼び出されるコールバック
 * @returns `send` 関数
 */
export function useWebSocket(onMessage: WsMessageHandler, onOpen?: () => void) {
  const wsRef = useRef<WebSocket | null>(null);
  const handlerRef = useRef<WsMessageHandler>(onMessage);
  const onOpenRef = useRef(onOpen);
  const isMountedRef = useRef(true);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    handlerRef.current = onMessage;
    onOpenRef.current = onOpen;
  });

  useEffect(() => {
    function connect() {
      if (!isMountedRef.current) return;

      const base = (import.meta.env.VITE_API_URL as string) || '';
      const wsUrl = base
        ? base.replace(/^http/, 'ws')
        : `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}`;
      const token = localStorage.getItem('token') ?? '';
      const ws = new WebSocket(`${wsUrl}?token=${encodeURIComponent(token)}`);
      wsRef.current = ws;

      ws.onopen = () => {
        onOpenRef.current?.();
      };

      ws.onmessage = (event: MessageEvent) => {
        try {
          const msg = JSON.parse(event.data as string) as WsMessage;
          handlerRef.current(msg.type, (msg.payload ?? {}) as Record<string, unknown>);
        } catch {
          // malformed message — ignore
        }
      };

      // 接続が切れた場合は3秒後に再接続（アンマウント後は行わない）
      ws.onclose = () => {
        if (!isMountedRef.current) return;
        if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = setTimeout(connect, 3000);
      };
    }

    connect();

    // タブが再表示されたとき、接続が切れていれば即再接続
    const handleVisibilityChange = () => {
      if (document.visibilityState !== 'visible') return;
      const ws = wsRef.current;
      if (!ws || ws.readyState === WebSocket.CLOSED || ws.readyState === WebSocket.CLOSING) {
        connect();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      isMountedRef.current = false;
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      wsRef.current?.close();
      wsRef.current = null;
    };
  }, []);

  const send = useCallback((type: string, payload?: Record<string, unknown>) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type, payload }));
    }
  }, []);

  return { send };
}
