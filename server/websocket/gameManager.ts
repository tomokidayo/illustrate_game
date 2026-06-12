import { WebSocketServer } from 'ws';
import { AuthedWebSocket } from './wsServer';
import pool from '../db';
import topics, { Topic } from '../data/topics';

/** WebSocketメッセージの共通形式 */
type WsMessage = { type: string; payload?: Record<string, unknown> };

/** ルーム内の1プレイヤー */
interface Player {
  userId: string;
  username: string;
  score: number;
  ws: AuthedWebSocket;
}

/** インメモリのゲーム状態 */
interface RoomState {
  roomId: string;
  roomCode: string;
  hostUserId: string;
  players: Player[];
  /** players配列上の絵描き役インデックス */
  drawerIndex: number;
  /** 絵描き役に表示するお題（label） */
  topic: string;
  /** 正解判定用ひらがな読み */
  topicHiragana: string;
  status: 'waiting' | 'playing' | 'finished';
  /** ターン中のみ有効な毎秒インターバル */
  tickInterval: NodeJS.Timeout | null;
  turnTimeLeft: number;
  gameTimeLeft: number;
  /** 未出題のお題キュー（空になったらシャッフルして再充填） */
  topicQueue: Topic[];
  /** ゲームモード */
  mode: 'normal' | 'werewolf';
  /** 人狼役のユーザーID */
  werewolfUserId: string | null;
  /** 連続正解ターン数（人狼モード用） */
  consecutiveCorrect: number;
  /** 投票データ（voterId → targetUserId） */
  votes: Map<string, string>;
  /** ジャッジメントフェーズ中かどうか */
  judgmentPhase: boolean;
  /** ジャッジメントタイマー */
  judgmentTimer: NodeJS.Timeout | null;
}

/** roomCode → RoomState */
const rooms = new Map<string, RoomState>();
/** WebSocket接続 → 参加中roomCode */
const wsToRoom = new Map<AuthedWebSocket, string>();

/** 指定WebSocketにメッセージを送信する */
function send(ws: AuthedWebSocket, type: string, payload?: unknown): void {
  if (ws.readyState === ws.OPEN) {
    ws.send(JSON.stringify({ type, payload }));
  }
}

/** ルーム全員にブロードキャストする */
function broadcast(room: RoomState, type: string, payload?: unknown): void {
  for (const p of room.players) send(p.ws, type, payload);
}

/** プレイヤー一覧更新をブロードキャストする */
function broadcastPlayersUpdated(room: RoomState): void {
  const players = room.players.map(({ userId, username, score }) => ({ userId, username, score }));
  broadcast(room, 'room:players_updated', { players });
}

/** Fisher-Yates シャッフル */
function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * カタカナをひらがなに変換し、前後の空白を除去する
 * 「イヌ」→「いぬ」のように正規化することで、ひらがな・カタカナ両方の回答を受け付ける
 */
function normalizeToHiragana(s: string): string {
  return s
    .trim()
    .replace(/[ァ-ヶ]/g, ch => String.fromCharCode(ch.charCodeAt(0) - 0x60))
    .toLowerCase();
}

/**
 * キューから次のお題を取り出す
 * キューが空の場合はシャッフルして全お題を再充填する
 */
function pickTopic(room: RoomState): Topic {
  if (room.topicQueue.length === 0) {
    room.topicQueue = shuffle([...topics]);
  }
  return room.topicQueue.pop()!;
}

/** ターン・ジャッジメントタイマーをすべてクリアする */
function clearRoomTimers(room: RoomState): void {
  if (room.tickInterval) { clearInterval(room.tickInterval); room.tickInterval = null; }
  if (room.judgmentTimer) { clearTimeout(room.judgmentTimer); room.judgmentTimer = null; }
}

/**
 * ゲーム終了スコアをDBに永続化する
 * @param room - 対象ルーム
 * @param scores - 全プレイヤーのスコア一覧
 */
async function saveGameHistory(
  room: RoomState,
  scores: Array<{ userId: string; username: string; score: number }>
): Promise<void> {
  try {
    const sorted = [...scores].sort((a, b) => b.score - a.score);
    const { rows: [history] } = await pool.query<{ id: string }>(
      'INSERT INTO game_histories (room_id, room_code) VALUES ($1, $2) RETURNING id',
      [room.roomId, room.roomCode]
    );
    await Promise.all(
      sorted.map((player, i) =>
        pool.query(
          'INSERT INTO game_scores (game_id, user_id, username, score, rank) VALUES ($1, $2, $3, $4, $5)',
          [history.id, player.userId, player.username, player.score, i + 1]
        )
      )
    );
  } catch (err) {
    console.error('Failed to save game history:', err);
  }
}

/** ゲームを終了しDB・全員に通知する */
function endGame(room: RoomState): void {
  clearRoomTimers(room);
  if (room.mode === 'werewolf') {
    startJudgmentTime(room);
    return;
  }
  room.status = 'finished';
  const scores = room.players.map(({ userId, username, score }) => ({ userId, username, score }));
  void pool.query("UPDATE rooms SET status = 'finished' WHERE id = $1", [room.roomId]);
  void saveGameHistory(room, scores);
  broadcast(room, 'game:end', { players: scores });
}

/**
 * 人狼モード：連続正解5ターン達成時の市民勝利処理
 * @param room - 対象ルーム
 * @param correct - 正解者情報
 */
function endWerewolfCitizensStreak(
  room: RoomState,
  correct: { userId: string; username: string }
): void {
  clearRoomTimers(room);
  room.status = 'finished';
  broadcast(room, 'game:turn_end', { topic: room.topic, correct });
  const werewolf = room.players.find(p => p.userId === room.werewolfUserId);
  setTimeout(() => {
    broadcast(room, 'game:werewolf_end', {
      result: 'citizens_win_streak',
      werewolfUserId: room.werewolfUserId,
      werewolfUsername: werewolf?.username ?? '',
    });
    void pool.query("UPDATE rooms SET status = 'finished' WHERE id = $1", [room.roomId]);
  }, 2000);
}

/**
 * 人狼モード：ジャッジメントフェーズを開始する
 * @param room - 対象ルーム
 */
function startJudgmentTime(room: RoomState): void {
  room.judgmentPhase = true;
  room.votes = new Map();
  const players = room.players.map(({ userId, username }) => ({ userId, username }));
  broadcast(room, 'judgment:start', { players, timeLeft: 30 });
  room.judgmentTimer = setTimeout(() => resolveJudgment(room), 30000);
}

/**
 * 人狼モード：投票を集計して勝敗を決定する
 * @param room - 対象ルーム
 */
function resolveJudgment(room: RoomState): void {
  if (room.judgmentTimer) { clearTimeout(room.judgmentTimer); room.judgmentTimer = null; }

  const werewolf = room.players.find(p => p.userId === room.werewolfUserId);

  const countVotes = (votes: Map<string, string>): Map<string, number> => {
    const tally = new Map<string, number>();
    for (const targetId of votes.values()) {
      tally.set(targetId, (tally.get(targetId) ?? 0) + 1);
    }
    return tally;
  };

  const findWinner = (votes: Map<string, string>, totalVoters: number): 'citizens' | 'werewolf' => {
    const tally = countVotes(votes);
    let maxTarget = '';
    let maxCount = 0;
    for (const [target, count] of tally) {
      if (count > maxCount) { maxTarget = target; maxCount = count; }
    }
    const majority = maxCount > totalVoters / 2;
    if (majority && maxTarget === room.werewolfUserId) return 'citizens';

    // 同数またはno majorityの場合：人狼の票を除いて再集計
    const topCount = [...tally.values()].filter(c => c === maxCount).length;
    const isTied = topCount > 1 || !majority;
    if (isTied && room.werewolfUserId) {
      const filteredVotes = new Map(votes);
      filteredVotes.delete(room.werewolfUserId);
      const filteredTally = countVotes(filteredVotes);
      let filteredMax = '';
      let filteredMaxCount = 0;
      for (const [target, count] of filteredTally) {
        if (count > filteredMaxCount) { filteredMax = target; filteredMaxCount = count; }
      }
      const filteredMajority = filteredMaxCount > filteredVotes.size / 2;
      if (filteredMajority && filteredMax === room.werewolfUserId) return 'citizens';
    }
    return 'werewolf';
  };

  const winner = findWinner(room.votes, room.players.length);

  const voteDetails = room.players.map(p => ({
    voterId: p.userId,
    voterName: p.username,
    targetId: room.votes.get(p.userId) ?? null,
    targetName: room.players.find(t => t.userId === room.votes.get(p.userId))?.username ?? null,
  }));

  room.status = 'finished';
  room.judgmentPhase = false;
  void pool.query("UPDATE rooms SET status = 'finished' WHERE id = $1", [room.roomId]);
  broadcast(room, 'judgment:result', {
    winner,
    werewolfUserId: room.werewolfUserId,
    werewolfUsername: werewolf?.username ?? '',
    votes: voteDetails,
  });
}

/**
 * ターンを終了し次の絵描き役に切り替える
 * @param room - 対象ルーム
 * @param correct - 正解者情報（時間切れの場合はnull）
 */
function endTurn(room: RoomState, correct: { userId: string; username: string } | null): void {
  if (room.status !== 'playing') return;
  clearRoomTimers(room);

  if (correct !== null) {
    // スコア付与は handleAnswerSubmit で実施済みのため、ここではカウントのみ
    room.consecutiveCorrect += 1;
    // 人狼モード：5連続正解で市民勝利
    if (room.mode === 'werewolf' && room.consecutiveCorrect >= 5) {
      endWerewolfCitizensStreak(room, correct);
      return;
    }
  } else {
    room.consecutiveCorrect = 0;
    // 正解者なしの場合は描き手 -2（通常モードのみ）
    if (room.mode !== 'werewolf') {
      const drawer = room.players[room.drawerIndex];
      if (drawer) drawer.score -= 2;
      broadcastPlayersUpdated(room);
    }
  }

  broadcast(room, 'game:turn_end', { topic: room.topic, correct });

  if (room.gameTimeLeft <= 0) { endGame(room); return; }

  setTimeout(() => {
    if (room.status !== 'playing' || room.players.length === 0) return;
    room.drawerIndex = (room.drawerIndex + 1) % room.players.length;
    startTurn(room);
  }, 2000);
}

/**
 * ターンを開始しお題・絵描き役を通知する
 * @param room - 対象ルーム
 */
function startTurn(room: RoomState): void {
  if (room.players.length === 0) return;
  const picked = pickTopic(room);
  room.topic = picked.label;
  room.topicHiragana = normalizeToHiragana(picked.hiragana);
  room.turnTimeLeft = 30;

  const drawer = room.players[room.drawerIndex];
  for (const p of room.players) {
    send(p.ws, 'game:turn_start', {
      drawerId: drawer.userId,
      drawerName: drawer.username,
      topic: p.userId === drawer.userId ? room.topic : undefined,
      turnTimeLeft: room.turnTimeLeft,
      gameTimeLeft: room.gameTimeLeft,
    });
  }

  room.tickInterval = setInterval(() => {
    if (room.status !== 'playing') { clearRoomTimers(room); return; }
    room.turnTimeLeft -= 1;
    room.gameTimeLeft -= 1;
    broadcast(room, 'game:tick', { turnTimeLeft: room.turnTimeLeft, gameTimeLeft: room.gameTimeLeft });
    if (room.gameTimeLeft <= 0) { endGame(room); return; }
    if (room.turnTimeLeft <= 0) { endTurn(room, null); }
  }, 1000);
}

/**
 * room:join ハンドラ：DBでメンバーシップを確認してルームに接続する
 */
async function handleRoomJoin(ws: AuthedWebSocket, payload: Record<string, unknown>): Promise<void> {
  const roomCode = payload.roomCode as string;
  if (!roomCode || !ws.user) return;

  const { rows } = await pool.query<{ id: string; host_user_id: string; status: string }>(
    `SELECT r.id, r.host_user_id, r.status
     FROM rooms r JOIN room_players rp ON rp.room_id = r.id
     WHERE r.room_code = $1 AND rp.user_id = $2`,
    [roomCode, ws.user.id]
  );
  if (!rows[0]) { send(ws, 'error', { message: 'Not in room' }); return; }

  const { id: roomId, host_user_id: hostUserId, status } = rows[0];
  let room = rooms.get(roomCode);
  if (!room) {
    room = {
      roomId,
      roomCode,
      hostUserId,
      players: [],
      drawerIndex: 0,
      topic: '',
      topicHiragana: '',
      status: status as RoomState['status'],
      tickInterval: null,
      turnTimeLeft: 30,
      gameTimeLeft: 300,
      topicQueue: [],
      mode: 'normal',
      werewolfUserId: null,
      consecutiveCorrect: 0,
      votes: new Map(),
      judgmentPhase: false,
      judgmentTimer: null,
    };
    rooms.set(roomCode, room);
  }

  // 再接続対応：既存エントリのスコアを引き継いで差し替え
  const prev = room.players.find(p => p.userId === ws.user!.id);
  room.players = room.players.filter(p => p.userId !== ws.user!.id);
  room.players.push({ userId: ws.user.id, username: ws.user.username, score: prev?.score ?? 0, ws });
  wsToRoom.set(ws, roomCode);
  broadcastPlayersUpdated(room);
}

/** room:leave ハンドラ */
function handleRoomLeave(ws: AuthedWebSocket, payload: Record<string, unknown>): void {
  removePlayer(ws, payload.roomCode as string);
}

/**
 * game:start ハンドラ：ホストのみゲームを開始できる（3人以上必要）
 * @param ws - 送信元WebSocket
 * @param payload - roomCode, mode ('normal' | 'werewolf')
 */
function handleGameStart(ws: AuthedWebSocket, payload: Record<string, unknown>): void {
  const room = rooms.get(payload.roomCode as string);
  if (!room || !ws.user) return;
  if (room.hostUserId !== ws.user.id) { send(ws, 'error', { message: 'Only host can start' }); return; }
  if (room.status !== 'waiting') { send(ws, 'error', { message: 'Game already started' }); return; }
  if (room.players.length < 3) { send(ws, 'error', { message: 'Need at least 3 players' }); return; }

  const mode = (payload.mode as 'normal' | 'werewolf') ?? 'normal';
  room.mode = mode;
  room.status = 'playing';
  room.gameTimeLeft = 300;
  room.drawerIndex = 0;
  room.topicQueue = [];
  room.topicHiragana = '';
  room.consecutiveCorrect = 0;
  room.votes = new Map();
  room.judgmentPhase = false;
  for (const p of room.players) p.score = 0;
  void pool.query("UPDATE rooms SET status = 'playing' WHERE id = $1", [room.roomId]);

  if (mode === 'werewolf') {
    // ランダムに1人を人狼に選ぶ
    const werewolfIndex = Math.floor(Math.random() * room.players.length);
    room.werewolfUserId = room.players[werewolfIndex].userId;

    // 各プレイヤーに役職を通知
    for (const p of room.players) {
      send(p.ws, 'werewolf:role', {
        role: p.userId === room.werewolfUserId ? 'werewolf' : 'citizen',
      });
    }
  } else {
    room.werewolfUserId = null;
  }

  startTurn(room);
}

/**
 * canvas:draw ハンドラ：絵描き役の描画データを他全員にリレーする
 */
function handleCanvasDraw(ws: AuthedWebSocket, payload: Record<string, unknown>): void {
  const room = rooms.get(payload.roomCode as string);
  if (!room || room.status !== 'playing') return;
  if (room.players[room.drawerIndex]?.userId !== ws.user?.id) return;
  for (const p of room.players) { if (p.ws !== ws) send(p.ws, 'canvas:draw', payload); }
}

/**
 * canvas:clear ハンドラ：絵描き役のクリア操作を他全員にリレーする
 */
function handleCanvasClear(ws: AuthedWebSocket, payload: Record<string, unknown>): void {
  const room = rooms.get(payload.roomCode as string);
  if (!room || room.status !== 'playing') return;
  if (room.players[room.drawerIndex]?.userId !== ws.user?.id) return;
  for (const p of room.players) { if (p.ws !== ws) send(p.ws, 'canvas:clear', {}); }
}

/**
 * game:abort ハンドラ：誰でも呼べる。ゲームを即時中断し全員に通知する
 */
function handleGameAbort(ws: AuthedWebSocket, payload: Record<string, unknown>): void {
  const room = rooms.get(payload.roomCode as string);
  if (!room || !ws.user || room.status !== 'playing') return;
  if (!room.players.find(p => p.userId === ws.user!.id)) return;
  clearRoomTimers(room);
  room.status = 'waiting';
  room.gameTimeLeft = 300;
  room.drawerIndex = 0;
  room.judgmentPhase = false;
  void pool.query("UPDATE rooms SET status = 'waiting' WHERE id = $1", [room.roomId]);
  broadcast(room, 'game:abort', { username: ws.user.username });
}

/**
 * answer:submit ハンドラ：正解なら得点付与・ターン終了、不正解はチャット表示
 */
function handleAnswerSubmit(ws: AuthedWebSocket, payload: Record<string, unknown>): void {
  const room = rooms.get(payload.roomCode as string);
  const answer = ((payload.answer as string) ?? '').trim();
  if (!room || room.status !== 'playing' || !ws.user) return;
  if (room.judgmentPhase) return;
  if (room.players[room.drawerIndex]?.userId === ws.user.id) return; // 絵描き役は回答不可

  const normalizedAnswer = normalizeToHiragana(answer);
  if (normalizedAnswer === room.topicHiragana || answer.trim() === room.topic) {
    if (room.mode !== 'werewolf') {
      // 通常モード：スコア付与
      const player = room.players.find(p => p.userId === ws.user!.id);
      if (player) player.score += 3;
      const drawer = room.players[room.drawerIndex];
      if (drawer) drawer.score += 2;
      broadcast(room, 'answer:correct', { userId: ws.user.id, username: ws.user.username, score: player?.score ?? 3 });
      broadcastPlayersUpdated(room);
    } else {
      // 人狼モード：スコアなし
      broadcast(room, 'answer:correct', { userId: ws.user.id, username: ws.user.username, score: 0 });
    }
    endTurn(room, { userId: ws.user.id, username: ws.user.username });
  } else {
    broadcast(room, 'answer:wrong', { userId: ws.user.id, username: ws.user.username, answer });
  }
}

/**
 * judgment:vote ハンドラ：人狼モードのジャッジメントフェーズで投票を受け付ける
 * @param ws - 送信元WebSocket
 * @param payload - roomCode, targetUserId
 */
function handleJudgmentVote(ws: AuthedWebSocket, payload: Record<string, unknown>): void {
  const room = rooms.get(payload.roomCode as string);
  const targetUserId = payload.targetUserId as string;
  if (!room || !ws.user || !room.judgmentPhase) return;
  if (!room.players.find(p => p.userId === ws.user!.id)) return;
  if (!room.players.find(p => p.userId === targetUserId)) return;
  if (ws.user.id === targetUserId) return; // 自分自身には投票不可
  if (room.votes.has(ws.user.id)) return;  // 再投票不可

  room.votes.set(ws.user.id, targetUserId);
  broadcast(room, 'judgment:voted', {
    userId: ws.user.id,
    votedCount: room.votes.size,
    totalCount: room.players.length,
  });

  // 全員が投票したら即時集計
  if (room.votes.size >= room.players.length) {
    resolveJudgment(room);
  }
}

/**
 * プレイヤーをルームから除去し、必要に応じてゲーム状態を更新する
 * @param ws - 対象WebSocket接続
 * @param roomCode - 対象ルームコード（省略時はwsToRoomから取得）
 */
function removePlayer(ws: AuthedWebSocket, roomCode?: string): void {
  const code = roomCode ?? wsToRoom.get(ws);
  if (!code) return;
  const room = rooms.get(code);
  if (!room) return;

  const drawerUserId = room.players[room.drawerIndex]?.userId;
  room.players = room.players.filter(p => p.ws !== ws);
  wsToRoom.delete(ws);

  if (room.players.length === 0) {
    clearRoomTimers(room);
    rooms.delete(code);
    return;
  }

  const newDrawerIdx = room.players.findIndex(p => p.userId === drawerUserId);
  if (newDrawerIdx !== -1) {
    room.drawerIndex = newDrawerIdx;
  } else if (room.status === 'playing') {
    // 絵描き役が切断されたためターンを終了する
    room.drawerIndex = room.drawerIndex % room.players.length;
    endTurn(room, null);
    return;
  }
  broadcastPlayersUpdated(room);
}

/**
 * WebSocketメッセージをイベント種別に応じたハンドラに振り分ける
 * @param _wss - WebSocketServerインスタンス（将来の拡張用）
 * @param ws - メッセージ送信元の接続
 * @param msg - パース済みメッセージオブジェクト
 */
export function handle(_wss: WebSocketServer, ws: AuthedWebSocket, msg: unknown): void {
  const { type, payload = {} } = msg as WsMessage;
  switch (type) {
    case 'room:join':       void handleRoomJoin(ws, payload); break;
    case 'room:leave':      handleRoomLeave(ws, payload); break;
    case 'game:start':      handleGameStart(ws, payload); break;
    case 'canvas:draw':     handleCanvasDraw(ws, payload); break;
    case 'canvas:clear':    handleCanvasClear(ws, payload); break;
    case 'answer:submit':   handleAnswerSubmit(ws, payload); break;
    case 'game:abort':      handleGameAbort(ws, payload); break;
    case 'judgment:vote':   handleJudgmentVote(ws, payload); break;
  }
}

/**
 * WebSocket切断時にプレイヤーをルームから除去する
 * @param _wss - WebSocketServerインスタンス（将来の拡張用）
 * @param ws - 切断した接続
 */
export function handleDisconnect(_wss: WebSocketServer, ws: AuthedWebSocket): void {
  removePlayer(ws);
}
