import { useState, useRef, useCallback, useEffect, RefObject } from 'react';
import { useWebSocket } from './useWebSocket';
import api from '../utils/api';

/** ゲームの進行状態 */
export type GameStatus = 'connecting' | 'waiting' | 'playing' | 'finished';

/** プレイヤー情報 */
export interface Player {
  userId: string;
  username: string;
  score: number;
}

/** 現在のターン情報 */
export interface TurnInfo {
  drawerId: string;
  drawerName: string;
  /** 絵描き役のみ受け取る */
  topic?: string;
  turnTimeLeft: number;
  gameTimeLeft: number;
}

/** チャットメッセージの種別 */
export type MessageKind = 'wrong' | 'correct' | 'system';

/** チャットメッセージ */
export interface ChatMessage {
  id: string;
  kind: MessageKind;
  userId?: string;
  username?: string;
  text: string;
}

/** キャンバス描画データ */
export interface DrawData {
  roomCode: string;
  x: number;
  y: number;
  dragging: boolean;
  color: string;
  width: number;
}

/** ターン終了時のオーバーレイ表示データ */
export interface TurnEndInfo {
  topic: string;
  correct: { userId: string; username: string } | null;
}

/** useGame フックの戻り値 */
export interface UseGameReturn {
  gameStatus: GameStatus;
  players: Player[];
  turn: TurnInfo | null;
  messages: ChatMessage[];
  turnEndInfo: TurnEndInfo | null;
  drawQueueRef: RefObject<DrawData[]>;
  clearSignal: number;
  isHost: boolean;
  send: (type: string, payload?: Record<string, unknown>) => void;
  startGame: () => void;
  submitAnswer: (answer: string) => void;
  sendDraw: (data: Omit<DrawData, 'roomCode'>) => void;
  sendClear: () => void;
}

let messageCounter = 0;
function nextId(): string {
  return String(++messageCounter);
}

/**
 * ゲーム状態を管理するフック
 * @param roomCode - 参加するルームコード
 * @param userId - 現在のユーザーID
 */
export function useGame(roomCode: string, userId: string): UseGameReturn {
  const [gameStatus, setGameStatus] = useState<GameStatus>('connecting');
  const [players, setPlayers] = useState<Player[]>([]);
  const [turn, setTurn] = useState<TurnInfo | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [turnEndInfo, setTurnEndInfo] = useState<TurnEndInfo | null>(null);
  const [clearSignal, setClearSignal] = useState(0);
  const [isHost, setIsHost] = useState(false);

  const drawQueueRef = useRef<DrawData[]>([]);

  const addMessage = useCallback((msg: Omit<ChatMessage, 'id'>) => {
    setMessages(prev => [...prev, { ...msg, id: nextId() }]);
  }, []);

  const handleMessage = useCallback((type: string, payload: Record<string, unknown>) => {
    switch (type) {
      case 'room:players_updated': {
        const ps = payload.players as Player[];
        setPlayers(ps);
        setGameStatus(prev => prev === 'connecting' ? 'waiting' : prev);
        break;
      }

      case 'game:turn_start': {
        const drawerId = payload.drawerId as string;
        const drawerName = payload.drawerName as string;
        const topic = payload.topic as string | undefined;
        const turnTimeLeft = payload.turnTimeLeft as number;
        const gameTimeLeft = payload.gameTimeLeft as number;
        setTurn({ drawerId, drawerName, topic, turnTimeLeft, gameTimeLeft });
        setGameStatus('playing');
        setTurnEndInfo(null);
        break;
      }

      case 'game:tick': {
        const turnTimeLeft = payload.turnTimeLeft as number;
        const gameTimeLeft = payload.gameTimeLeft as number;
        setTurn(prev => prev ? { ...prev, turnTimeLeft, gameTimeLeft } : prev);
        break;
      }

      case 'game:turn_end': {
        const topic = payload.topic as string;
        const correct = payload.correct as { userId: string; username: string } | null;
        setTurnEndInfo({ topic, correct });
        addMessage({
          kind: 'system',
          text: correct ? `✅ ${correct.username} が正解！ お題：${topic}` : `時間切れ。お題は「${topic}」でした`,
        });
        break;
      }

      case 'game:end': {
        const ps = payload.players as Player[];
        setPlayers(ps);
        setGameStatus('finished');
        setTurn(null);
        break;
      }

      case 'canvas:draw': {
        const data = payload as unknown as DrawData;
        drawQueueRef.current.push({ ...data, roomCode });
        break;
      }

      case 'canvas:clear': {
        setClearSignal(n => n + 1);
        break;
      }

      case 'answer:wrong': {
        const username = payload.username as string;
        const answer = payload.answer as string;
        addMessage({ kind: 'wrong', userId: payload.userId as string, username, text: answer });
        break;
      }

      case 'answer:correct': {
        const username = payload.username as string;
        addMessage({ kind: 'correct', userId: payload.userId as string, username, text: '' });
        setPlayers(prev =>
          prev.map(p =>
            p.userId === (payload.userId as string) ? { ...p, score: payload.score as number } : p
          )
        );
        break;
      }

      case 'error': {
        addMessage({ kind: 'system', text: payload.message as string });
        break;
      }
    }
  }, [addMessage, roomCode]);

  const { send } = useWebSocket(handleMessage, () => {
    send('room:join', { roomCode });
  });

  useEffect(() => {
    api.get<{ host_user_id: string }>(`/api/rooms/${roomCode}`)
      .then(res => setIsHost(res.data.host_user_id === userId))
      .catch(() => {});
  }, [roomCode, userId]);

  const startGame = useCallback(() => {
    send('game:start', { roomCode });
  }, [send, roomCode]);

  const submitAnswer = useCallback((answer: string) => {
    send('answer:submit', { roomCode, answer });
  }, [send, roomCode]);

  const sendDraw = useCallback((data: Omit<DrawData, 'roomCode'>) => {
    const full: DrawData = { ...data, roomCode };
    drawQueueRef.current.push(full);
    send('canvas:draw', full as unknown as Record<string, unknown>);
  }, [send, roomCode]);

  const sendClear = useCallback(() => {
    setClearSignal(n => n + 1);
    send('canvas:clear', { roomCode });
  }, [send, roomCode]);

  return {
    gameStatus,
    players,
    turn,
    messages,
    turnEndInfo,
    drawQueueRef,
    clearSignal,
    isHost,
    send,
    startGame,
    submitAnswer,
    sendDraw,
    sendClear,
  };
}
