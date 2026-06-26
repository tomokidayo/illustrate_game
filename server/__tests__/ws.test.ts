import http from 'http';
import { AddressInfo } from 'net';
import { WebSocket, RawData } from 'ws';
import request from 'supertest';
import app from '../app';
import { initWsServer } from '../websocket/wsServer';
import pool from '../db';

const WS_USERS = [
  { username: 'ws_user1', password: 'password123' },
  { username: 'ws_user2', password: 'password123' },
  { username: 'ws_user3', password: 'password123' },
  { username: 'ws_nonmember', password: 'password123' },
];
const WS_NAMES = WS_USERS.map(u => u.username);

let server: http.Server;
let port: number;
let tokens: string[] = [];
let roomCode: string;

/** 特定typeのメッセージが届くまで待機する */
function waitForMessage(ws: WebSocket, type: string, timeoutMs = 3000): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timeout waiting for "${type}"`)), timeoutMs);
    const handler = (data: RawData) => {
      const msg = JSON.parse(data.toString()) as { type: string; payload: unknown };
      if (msg.type === type) {
        clearTimeout(timer);
        ws.off('message', handler);
        resolve(msg.payload);
      }
    };
    ws.on('message', handler);
  });
}

/** WebSocket接続を確立して返す */
function connectWs(token: string): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}/?token=${token}`);
    ws.once('open', () => resolve(ws));
    ws.once('error', reject);
  });
}

/** 全員が順番にroom:players_updatedを受信するまで待つ（順序を確定させるため逐次処理） */
async function joinRoomWs(wsList: WebSocket[], code: string): Promise<void> {
  for (const ws of wsList) {
    const p = waitForMessage(ws, 'room:players_updated');
    ws.send(JSON.stringify({ type: 'room:join', payload: { roomCode: code } }));
    await p;
  }
}

beforeAll(async () => {
  // DBクリーンアップ
  await pool.query(
    `DELETE FROM room_players USING rooms WHERE room_players.room_id = rooms.id
     AND rooms.host_user_id IN (SELECT id FROM users WHERE username = ANY($1::text[]))`,
    [WS_NAMES]
  );
  await pool.query(
    `DELETE FROM rooms WHERE host_user_id IN (SELECT id FROM users WHERE username = ANY($1::text[]))`,
    [WS_NAMES]
  );
  await pool.query(`DELETE FROM users WHERE username = ANY($1::text[])`, [WS_NAMES]);

  // テストユーザー登録
  for (const u of WS_USERS) await request(app).post('/api/auth/register').send(u);

  // トークン取得
  tokens = await Promise.all(
    WS_USERS.map(u => request(app).post('/api/auth/login').send(u).then(r => r.body.token as string))
  );

  // ルーム作成（ws_user1がホスト）
  const res = await request(app).post('/api/rooms').set('Authorization', `Bearer ${tokens[0]}`);
  roomCode = res.body.room_code as string;

  // ws_user2, ws_user3 がREST APIで参加
  await request(app).post(`/api/rooms/${roomCode}/join`).set('Authorization', `Bearer ${tokens[1]}`);
  await request(app).post(`/api/rooms/${roomCode}/join`).set('Authorization', `Bearer ${tokens[2]}`);

  // HTTPサーバー起動（ランダムポート）
  server = http.createServer(app);
  initWsServer(server);
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  port = (server.address() as AddressInfo).port;
});

afterAll(async () => {
  await new Promise<void>((resolve, reject) => server.close(err => err ? reject(err) : resolve()));
  await pool.query(
    `DELETE FROM room_players USING rooms WHERE room_players.room_id = rooms.id
     AND rooms.host_user_id IN (SELECT id FROM users WHERE username = ANY($1::text[]))`,
    [WS_NAMES]
  );
  await pool.query(
    `DELETE FROM rooms WHERE host_user_id IN (SELECT id FROM users WHERE username = ANY($1::text[]))`,
    [WS_NAMES]
  );
  await pool.query(`DELETE FROM users WHERE username = ANY($1::text[])`, [WS_NAMES]);
});

// ─── WebSocket認証 ────────────────────────────────────────────────────────────

describe('WebSocket認証', () => {
  test('有効なトークンで接続できる', async () => {
    const ws = await connectWs(tokens[0]);
    expect(ws.readyState).toBe(WebSocket.OPEN);
    ws.close();
  });

  test('トークンなしで1008コードで切断される', done => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}/`);
    ws.on('close', code => { expect(code).toBe(1008); done(); });
  });

  test('無効なトークンで1008コードで切断される', done => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}/?token=invalid.token.here`);
    ws.on('close', code => { expect(code).toBe(1008); done(); });
  });
});

// ─── room:join ────────────────────────────────────────────────────────────────

describe('room:join', () => {
  test('メンバーが参加するとroom:players_updatedを受信する', async () => {
    const ws = await connectWs(tokens[0]);
    const msgPromise = waitForMessage(ws, 'room:players_updated');
    ws.send(JSON.stringify({ type: 'room:join', payload: { roomCode } }));
    const payload = await msgPromise as { players: unknown[] };
    expect(Array.isArray(payload.players)).toBe(true);
    ws.close();
  });

  test('room_playersに未登録のユーザーはerrorを受信する', async () => {
    const ws = await connectWs(tokens[3]); // ws_nonmember
    const msgPromise = waitForMessage(ws, 'error');
    ws.send(JSON.stringify({ type: 'room:join', payload: { roomCode } }));
    const payload = await msgPromise as { message: string };
    expect(payload.message).toBe('Not in room');
    ws.close();
  });
});

// ─── game:start ───────────────────────────────────────────────────────────────

describe('game:start', () => {
  test('ホスト以外がgame:startを送るとerrorを受信する', async () => {
    const ws = await connectWs(tokens[1]); // ws_user2（非ホスト）
    ws.send(JSON.stringify({ type: 'room:join', payload: { roomCode } }));
    await waitForMessage(ws, 'room:players_updated');

    const errPromise = waitForMessage(ws, 'error');
    ws.send(JSON.stringify({ type: 'game:start', payload: { roomCode } }));
    const payload = await errPromise as { message: string };
    expect(payload.message).toBe('Only host can start');
    ws.close();
  });

  test('接続プレイヤーが3人未満だとerrorを受信する', async () => {
    // 別ルームを作成して1人だけ接続
    const res = await request(app).post('/api/rooms').set('Authorization', `Bearer ${tokens[0]}`);
    const smallRoomCode = res.body.room_code as string;

    const ws = await connectWs(tokens[0]);
    ws.send(JSON.stringify({ type: 'room:join', payload: { roomCode: smallRoomCode } }));
    await waitForMessage(ws, 'room:players_updated');

    const errPromise = waitForMessage(ws, 'error');
    ws.send(JSON.stringify({ type: 'game:start', payload: { roomCode: smallRoomCode } }));
    const payload = await errPromise as { message: string };
    expect(payload.message).toBe('Need at least 3 players');
    ws.close();
  });
});

// ─── ゲーム進行 ───────────────────────────────────────────────────────────────

describe('ゲーム進行', () => {
  let gameRoomCode: string;
  let ws1: WebSocket, ws2: WebSocket, ws3: WebSocket;
  let drawerUserId: string;
  let currentTopic: string;
  let userIds: string[];

  beforeAll(async () => {
    // 3人専用の別ルームを作成
    const res = await request(app).post('/api/rooms').set('Authorization', `Bearer ${tokens[0]}`);
    gameRoomCode = res.body.room_code as string;
    await request(app).post(`/api/rooms/${gameRoomCode}/join`).set('Authorization', `Bearer ${tokens[1]}`);
    await request(app).post(`/api/rooms/${gameRoomCode}/join`).set('Authorization', `Bearer ${tokens[2]}`);

    // tokens[0..2] に対応するユーザーIDを取得（drawerUserId との比較に使用）
    userIds = await Promise.all(
      tokens.slice(0, 3).map(t =>
        request(app).get('/api/auth/me').set('Authorization', `Bearer ${t}`).then(r => r.body.id as string)
      )
    );

    ws1 = await connectWs(tokens[0]);
    ws2 = await connectWs(tokens[1]);
    ws3 = await connectWs(tokens[2]);
    await joinRoomWs([ws1, ws2, ws3], gameRoomCode);
  });

  afterAll(() => {
    [ws1, ws2, ws3].forEach(ws => { if (ws.readyState === WebSocket.OPEN) ws.close(); });
  });

  test('ホストがゲームを開始すると全員がgame:turn_startを受信する', async () => {
    const [p1, p2, p3] = await Promise.all([
      waitForMessage(ws1, 'game:turn_start'),
      waitForMessage(ws2, 'game:turn_start'),
      waitForMessage(ws3, 'game:turn_start'),
    ].map(async (promise, i) => {
      if (i === 0) ws1.send(JSON.stringify({ type: 'game:start', payload: { roomCode: gameRoomCode } }));
      return promise;
    }));

    const start1 = p1 as { drawerId: string; drawerName: string; topic?: string; turnTimeLeft: number };
    expect(start1).toHaveProperty('drawerId');
    expect(start1).toHaveProperty('drawerName');
    expect(start1.turnTimeLeft).toBe(30);

    drawerUserId = start1.drawerId;

    // 絵描き役には topic が届き、非絵描き役には undefined になることを全プレイヤーで検証
    const allPayloads = [p1, p2, p3] as Array<{ topic?: string }>;
    for (const [i, payload] of allPayloads.entries()) {
      if (userIds[i] === drawerUserId) {
        expect(payload.topic).toBeDefined();
      } else {
        expect(payload.topic).toBeUndefined();
      }
    }

    currentTopic = allPayloads.find(p => p.topic !== undefined)!.topic as string;
  });

  test('不正解の回答はanswer:wrongとしてブロードキャストされる', async () => {
    // 絵描き役ではない回答者を特定（drawerUserIdはUUID、userIds[0]もUUIDで比較）
    const answererWs = drawerUserId === userIds[0] ? ws2 : ws1;
    const wrongPayload = await (async () => {
      const p = waitForMessage(ws1, 'answer:wrong');
      answererWs.send(JSON.stringify({ type: 'answer:submit', payload: { roomCode: gameRoomCode, answer: '絶対違う答え12345' } }));
      return p;
    })() as { answer: string };
    expect(wrongPayload.answer).toBe('絶対違う答え12345');
  });

  test('正解するとanswer:correctとgame:turn_endが全員に届く', async () => {
    const answererWs = drawerUserId === userIds[0] ? ws2 : ws1;
    const correctPromise = waitForMessage(ws1, 'answer:correct');
    const turnEndPromise = waitForMessage(ws1, 'game:turn_end');

    answererWs.send(JSON.stringify({ type: 'answer:submit', payload: { roomCode: gameRoomCode, answer: currentTopic } }));

    const [correctPayload, turnEndPayload] = await Promise.all([correctPromise, turnEndPromise]);
    expect((correctPayload as { score: number }).score).toBeGreaterThanOrEqual(1);
    expect((turnEndPayload as { topic: string }).topic).toBe(currentTopic);
  });
});

// ─── デュオモードゲーム進行 ───────────────────────────────────────────────────

describe('デュオモードゲーム進行', () => {
  let duoRoomCode: string;
  let dWs1: WebSocket, dWs2: WebSocket;
  let dUserIds: string[];
  // turn payloads shared between tests (game state persists across sequential tests)
  let firstTurnPayloads: [unknown, unknown];

  beforeAll(async () => {
    const res = await request(app).post('/api/rooms').set('Authorization', `Bearer ${tokens[0]}`);
    duoRoomCode = res.body.room_code as string;
    await request(app).post(`/api/rooms/${duoRoomCode}/join`).set('Authorization', `Bearer ${tokens[1]}`);

    dUserIds = await Promise.all(
      tokens.slice(0, 2).map(t =>
        request(app).get('/api/auth/me').set('Authorization', `Bearer ${t}`).then(r => r.body.id as string)
      )
    );

    dWs1 = await connectWs(tokens[0]);
    dWs2 = await connectWs(tokens[1]);
    await joinRoomWs([dWs1, dWs2], duoRoomCode);
  });

  afterAll(() => {
    [dWs1, dWs2].forEach(ws => { if (ws.readyState === WebSocket.OPEN) ws.close(); });
  });

  test('ゲーム開始でgame:turn_startのペイロードにduoLevelが含まれる', async () => {
    const [p1, p2] = await Promise.all(
      [
        waitForMessage(dWs1, 'game:turn_start'),
        waitForMessage(dWs2, 'game:turn_start'),
      ].map(async (promise, i) => {
        if (i === 0) {
          dWs1.send(JSON.stringify({
            type: 'game:start',
            payload: { roomCode: duoRoomCode, mode: 'duo', duoLevel: 1 },
          }));
        }
        return promise;
      })
    );

    firstTurnPayloads = [p1, p2];

    const payload = p1 as { duoLevel: number; mode: string };
    expect(payload.duoLevel).toBe(1);
    expect(payload.mode).toBe('duo');
  });

  test('7問正解でgame:duo_clearを受信する', async () => {
    let [tp1, tp2] = firstTurnPayloads;

    for (let turn = 0; turn < 7; turn++) {
      // 描き役を特定してお題を取得する
      const drawerIsUser0 = (tp1 as { drawerId: string }).drawerId === dUserIds[0];
      const topic = drawerIsUser0
        ? (tp1 as { topic?: string }).topic!
        : (tp2 as { topic?: string }).topic!;
      const answererWs = drawerIsUser0 ? dWs2 : dWs1;

      const turnEndPromise = waitForMessage(dWs1, 'game:turn_end', 5000);
      answererWs.send(JSON.stringify({ type: 'answer:submit', payload: { roomCode: duoRoomCode, answer: topic } }));
      const turnEnd = await turnEndPromise as { duoCorrectCount: number };
      expect(turnEnd.duoCorrectCount).toBe(turn + 1);

      if (turn < 6) {
        // 次のターン開始（サーバーが2秒後にstartTurnする）を待つ
        const [newTp1, newTp2] = await Promise.all([
          waitForMessage(dWs1, 'game:turn_start', 5000),
          waitForMessage(dWs2, 'game:turn_start', 5000),
        ]);
        [tp1, tp2] = [newTp1, newTp2];
      }
    }

    // endDuoClear が2秒後にgame:duo_clearをブロードキャストする
    const clearPayload = await waitForMessage(dWs1, 'game:duo_clear', 5000) as { level: number; timeLeft: number };
    expect(clearPayload.level).toBe(1);
    expect(typeof clearPayload.timeLeft).toBe('number');
  }, 30000);
});
