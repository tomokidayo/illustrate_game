import { useState, useRef, useCallback, useEffect, RefObject } from 'react';
import { useWebSocket } from './useWebSocket';
import api from '../utils/api';

/** ゲームの進行状態 */
export type GameStatus = 'connecting' | 'waiting' | 'playing' | 'finished' | 'aborted';

/** ゲームモード */
export type GameMode = 'normal' | 'werewolf' | 'duo';

/** プレイヤー情報 */
export interface Player {
  userId: string;
  username: string;
  avatar: string | null;
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

/** デュオモード終了時の結果データ */
export interface DuoResult {
  score: number;
  bestStreak: number;
}

/** 人狼モード終了時の結果データ */
export interface WerewolfResult {
  winner: 'citizens' | 'werewolf';
  werewolfUserId: string;
  werewolfUsername: string;
  votes: Array<{
    voterId: string;
    voterName: string;
    targetId: string | null;
    targetName: string | null;
  }>;
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
  startGame: (mode?: GameMode, gameDuration?: number, turnDuration?: number) => void;
  submitAnswer: (answer: string) => void;
  sendDraw: (data: Omit<DrawData, 'roomCode'>) => void;
  sendClear: () => void;
  /** ゲームを中断しサーバーに通知する */
  sendAbort: () => void;
  /** 中断したプレイヤーのユーザー名（game:abort 受信時にセット） */
  abortedBy: string | null;
  /** 現在のゲームモード */
  gameMode: GameMode | null;
  /** 自分の人狼モード役職 */
  myRole: 'citizen' | 'werewolf' | null;
  /** 連続正解ターン数（人狼モード） */
  consecutiveCorrect: number;
  /** ジャッジメントフェーズ中かどうか */
  judgmentPhase: boolean;
  /** ジャッジメントフェーズのプレイヤー一覧 */
  judgmentPlayers: Array<{ userId: string; username: string }>;
  /** ジャッジメントの残り時間（秒） */
  judgmentTimeLeft: number;
  /** 投票済み人数 */
  judgmentVotedCount: number;
  /** 総プレイヤー数 */
  judgmentTotalCount: number;
  /** 自分が投票済みかどうか */
  hasVoted: boolean;
  /** 人狼モードの結果 */
  werewolfResult: WerewolfResult | null;
  /** 投票を送信する */
  sendVote: (targetUserId: string) => void;
  /** デュオモード：現在の連続正解数 */
  duoStreak: number;
  /** デュオモード：ゲーム中の最高連続正解数 */
  duoBestStreak: number;
  /** デュオモード：現在の合計スコア */
  duoScore: number;
  /** デュオモードの終了結果 */
  duoResult: DuoResult | null;
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
  const [abortedBy, setAbortedBy] = useState<string | null>(null);

  // 人狼モード関連の状態
  const [gameMode, setGameMode] = useState<GameMode | null>(null);
  const [myRole, setMyRole] = useState<'citizen' | 'werewolf' | null>(null);
  const [consecutiveCorrect, setConsecutiveCorrect] = useState(0);
  const [judgmentPhase, setJudgmentPhase] = useState(false);
  const [judgmentPlayers, setJudgmentPlayers] = useState<Array<{ userId: string; username: string }>>([]);
  const [judgmentTimeLeft, setJudgmentTimeLeft] = useState(30);
  const [judgmentVotedCount, setJudgmentVotedCount] = useState(0);
  const [judgmentTotalCount, setJudgmentTotalCount] = useState(0);
  const [hasVoted, setHasVoted] = useState(false);
  const [werewolfResult, setWerewolfResult] = useState<WerewolfResult | null>(null);

  // デュオモード関連の状態
  const [duoStreak, setDuoStreak] = useState(0);
  const [duoBestStreak, setDuoBestStreak] = useState(0);
  const [duoScore, setDuoScore] = useState(0);
  const [duoResult, setDuoResult] = useState<DuoResult | null>(null);

  const drawQueueRef = useRef<DrawData[]>([]);

  // ジャッジメントカウントダウン
  useEffect(() => {
    if (!judgmentPhase) return;
    const interval = setInterval(() => {
      setJudgmentTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [judgmentPhase]);

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
        if (payload.mode) setGameMode(payload.mode as GameMode);
        if (payload.duoScore !== undefined) setDuoScore(payload.duoScore as number);
        if (payload.duoStreak !== undefined) setDuoStreak(payload.duoStreak as number);
        if (payload.duoBestStreak !== undefined) setDuoBestStreak(payload.duoBestStreak as number);
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
        if (payload.duoScore !== undefined) {
          setDuoScore(payload.duoScore as number);
          setDuoStreak(payload.duoStreak as number);
          setDuoBestStreak(payload.duoBestStreak as number);
        } else if (correct) {
          setConsecutiveCorrect(prev => prev + 1);
        } else {
          setConsecutiveCorrect(0);
        }
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

      case 'game:abort': {
        const username = payload.username as string;
        setAbortedBy(username);
        setGameStatus('aborted');
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

      // ─── 人狼モード専用イベント ───────────────────────────────────────

      case 'werewolf:role': {
        const role = payload.role as 'citizen' | 'werewolf';
        setMyRole(role);
        setGameMode('werewolf');
        setConsecutiveCorrect(0);
        break;
      }

      case 'judgment:start': {
        const jPlayers = payload.players as Array<{ userId: string; username: string }>;
        const timeLeft = payload.timeLeft as number;
        setJudgmentPhase(true);
        setJudgmentPlayers(jPlayers);
        setJudgmentTimeLeft(timeLeft);
        setJudgmentVotedCount(0);
        setJudgmentTotalCount(jPlayers.length);
        setHasVoted(false);
        break;
      }

      case 'judgment:voted': {
        setJudgmentVotedCount(payload.votedCount as number);
        break;
      }

      case 'judgment:result': {
        const result: WerewolfResult = {
          winner: payload.winner as 'citizens' | 'werewolf',
          werewolfUserId: payload.werewolfUserId as string,
          werewolfUsername: payload.werewolfUsername as string,
          votes: payload.votes as WerewolfResult['votes'],
        };
        setWerewolfResult(result);
        setJudgmentPhase(false);
        setGameStatus('finished');
        break;
      }

      case 'game:duo_end': {
        setDuoResult({
          score: payload.score as number,
          bestStreak: payload.bestStreak as number,
        });
        setGameStatus('finished');
        setTurnEndInfo(null);
        break;
      }

      case 'game:werewolf_end': {
        setWerewolfResult({
          winner: 'citizens',
          werewolfUserId: payload.werewolfUserId as string,
          werewolfUsername: payload.werewolfUsername as string,
          votes: [],
        });
        setGameStatus('finished');
        setTurnEndInfo(null);
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

  /**
   * ゲームを開始する
   * @param mode - ゲームモード（デフォルト: 'normal'）
   * @param gameDuration - 1ゲームの秒数（180 / 240 / 300、デフォルト: 300）
   * @param turnDuration - 1ターンの秒数（30 / 45 / 60、デフォルト: 30）
   */
  const startGame = useCallback((mode: GameMode = 'normal', gameDuration = 300, turnDuration = 30) => {
    send('game:start', { roomCode, mode, gameDuration, turnDuration });
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

  const sendAbort = useCallback(() => {
    send('game:abort', { roomCode });
  }, [send, roomCode]);

  /**
   * ジャッジメントフェーズで投票を送信する
   * @param targetUserId - 投票先プレイヤーのID
   */
  const sendVote = useCallback((targetUserId: string) => {
    send('judgment:vote', { roomCode, targetUserId });
    setHasVoted(true);
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
    sendAbort,
    abortedBy,
    gameMode,
    myRole,
    consecutiveCorrect,
    judgmentPhase,
    judgmentPlayers,
    judgmentTimeLeft,
    judgmentVotedCount,
    judgmentTotalCount,
    hasVoted,
    werewolfResult,
    sendVote,
    duoStreak,
    duoBestStreak,
    duoScore,
    duoResult,
  };
}
