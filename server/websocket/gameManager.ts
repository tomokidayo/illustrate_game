import { WebSocketServer } from 'ws';
import { AuthedWebSocket } from './wsServer';
import pool from '../db';
import topics from '../data/topics';

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
  topic: string;
  status: 'waiting' | 'playing' | 'finished';
  /** ターン中のみ有効な毎秒インターバル */
  tickInterval: NodeJS.Timeout | null;
  turnTimeLeft: number;
  gameTimeLeft: number;
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

/** ランダムなお題を選ぶ */
function pickTopic(): string {
  return topics[Math.floor(Math.random() * topics.length)];
}

/** ターンタイマーをクリアする */
function clearRoomTimers(room: RoomState): void {
  if (room.tickInterval) { clearInterval(room.tickInterval); room.tickInterval = null; }
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
  room.status = 'finished';
  const scores = room.players.map(({ userId, username, score }) => ({ userId, username, score }));
  void pool.query("UPDATE rooms SET status = 'finished' WHERE id = $1", [room.roomId]);
  void saveGameHistory(room, scores);
  broadcast(room, 'game:end', { players: scores });
}

/**
 * ターンを終了し次の絵描き役に切り替える
 * @param room - 対象ルーム
 * @param correct - 正解者情報（時間切れの場合はnull）
 */
function endTurn(room: RoomState, correct: { userId: string; username: string } | null): void {
  if (room.status !== 'playing') return;
  clearRoomTimers(room);
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
  room.topic = pickTopic();
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
    room = { roomId, roomCode, hostUserId, players: [], drawerIndex: 0, topic: '', status: status as RoomState['status'], tickInterval: null, turnTimeLeft: 30, gameTimeLeft: 300 };
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
 */
function handleGameStart(ws: AuthedWebSocket, payload: Record<string, unknown>): void {
  const room = rooms.get(payload.roomCode as string);
  if (!room || !ws.user) return;
  if (room.hostUserId !== ws.user.id) { send(ws, 'error', { message: 'Only host can start' }); return; }
  if (room.status !== 'waiting') { send(ws, 'error', { message: 'Game already started' }); return; }
  if (room.players.length < 3) { send(ws, 'error', { message: 'Need at least 3 players' }); return; }

  room.status = 'playing';
  room.gameTimeLeft = 300;
  room.drawerIndex = 0;
  void pool.query("UPDATE rooms SET status = 'playing' WHERE id = $1", [room.roomId]);
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
 * answer:submit ハンドラ：正解なら得点付与・ターン終了、不正解はチャット表示
 */
function handleAnswerSubmit(ws: AuthedWebSocket, payload: Record<string, unknown>): void {
  const room = rooms.get(payload.roomCode as string);
  const answer = ((payload.answer as string) ?? '').trim();
  if (!room || room.status !== 'playing' || !ws.user) return;
  if (room.players[room.drawerIndex]?.userId === ws.user.id) return; // 絵描き役は回答不可

  if (answer.toLowerCase() === room.topic.toLowerCase()) {
    const player = room.players.find(p => p.userId === ws.user!.id);
    if (player) player.score += 1;
    broadcast(room, 'answer:correct', { userId: ws.user.id, username: ws.user.username, score: player?.score ?? 1 });
    endTurn(room, { userId: ws.user.id, username: ws.user.username });
  } else {
    broadcast(room, 'answer:wrong', { userId: ws.user.id, username: ws.user.username, answer });
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
    case 'room:join':     void handleRoomJoin(ws, payload); break;
    case 'room:leave':    handleRoomLeave(ws, payload); break;
    case 'game:start':    handleGameStart(ws, payload); break;
    case 'canvas:draw':   handleCanvasDraw(ws, payload); break;
    case 'canvas:clear':  handleCanvasClear(ws, payload); break;
    case 'answer:submit': handleAnswerSubmit(ws, payload); break;
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
