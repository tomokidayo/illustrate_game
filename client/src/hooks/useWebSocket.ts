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
 * @returns `send` 関数
 */
export function useWebSocket(onMessage: WsMessageHandler) {
  const wsRef = useRef<WebSocket | null>(null);
  const handlerRef = useRef<WsMessageHandler>(onMessage);

  useEffect(() => {
    handlerRef.current = onMessage;
  });

  useEffect(() => {
    const base = import.meta.env.VITE_API_URL as string;
    const wsUrl = base.replace(/^http/, 'ws');
    const token = localStorage.getItem('token') ?? '';
    const ws = new WebSocket(`${wsUrl}?token=${encodeURIComponent(token)}`);
    wsRef.current = ws;

    ws.onmessage = (event: MessageEvent) => {
      try {
        const msg = JSON.parse(event.data as string) as WsMessage;
        handlerRef.current(msg.type, (msg.payload ?? {}) as Record<string, unknown>);
      } catch {
        // malformed message — ignore
      }
    };

    return () => {
      ws.close();
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
