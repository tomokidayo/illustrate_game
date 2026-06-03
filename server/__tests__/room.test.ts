import request from 'supertest';
import app from '../app';
import pool from '../db';

const TEST_USER  = { username: 'testuser_room',  password: 'password123' };
const TEST_USER2 = { username: 'testuser_room2', password: 'password123' };
const TEST_USER3 = { username: 'testuser_room3', password: 'password123' };
const TEST_USER4 = { username: 'testuser_room4', password: 'password123' };
const TEST_USER5 = { username: 'testuser_room5', password: 'password123' };
const TEST_USER6 = { username: 'testuser_room6', password: 'password123' };
const TEST_USER7 = { username: 'testuser_room7', password: 'password123' };

const ALL_USERS = [TEST_USER, TEST_USER2, TEST_USER3, TEST_USER4, TEST_USER5, TEST_USER6, TEST_USER7];
const ALL_NAMES = ALL_USERS.map(u => u.username);

let token: string;
let token2: string;
let token3: string;
let token4: string;
let token5: string;
let token6: string;
let token7: string;

beforeAll(async () => {
  await pool.query(
    `DELETE FROM room_players USING rooms WHERE room_players.room_id = rooms.id
     AND rooms.host_user_id IN (SELECT id FROM users WHERE username = ANY($1::text[]))`,
    [ALL_NAMES]
  );
  await pool.query(
    `DELETE FROM rooms WHERE host_user_id IN (SELECT id FROM users WHERE username = ANY($1::text[]))`,
    [ALL_NAMES]
  );
  await pool.query(`DELETE FROM users WHERE username = ANY($1::text[])`, [ALL_NAMES]);

  for (const user of ALL_USERS) {
    await request(app).post('/api/auth/register').send(user);
  }

  const results = await Promise.all(
    ALL_USERS.map(u => request(app).post('/api/auth/login').send(u))
  );
  [token, token2, token3, token4, token5, token6, token7] = results.map(r => r.body.token as string);
});

afterAll(async () => {
  await pool.query(
    `DELETE FROM room_players USING rooms WHERE room_players.room_id = rooms.id
     AND rooms.host_user_id IN (SELECT id FROM users WHERE username = ANY($1::text[]))`,
    [ALL_NAMES]
  );
  await pool.query(
    `DELETE FROM rooms WHERE host_user_id IN (SELECT id FROM users WHERE username = ANY($1::text[]))`,
    [ALL_NAMES]
  );
  await pool.query(`DELETE FROM users WHERE username = ANY($1::text[])`, [ALL_NAMES]);
  await pool.end();
});

// ─── POST /api/rooms ─────────────────────────────────────────────────────────

describe('POST /api/rooms', () => {
  test('正常作成・ルームコードが返る', async () => {
    const res = await request(app)
      .post('/api/rooms')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('room_code');
    expect(res.body.status).toBe('waiting');
    expect(res.body.room_code).toMatch(/^[A-Z0-9]{6}$/);
  });

  test('トークンなしは401', async () => {
    const res = await request(app).post('/api/rooms');
    expect(res.status).toBe(401);
  });
});

// ─── GET /api/rooms/:roomCode ─────────────────────────────────────────────────

describe('GET /api/rooms/:roomCode', () => {
  let roomCode: string;

  beforeAll(async () => {
    const res = await request(app)
      .post('/api/rooms')
      .set('Authorization', `Bearer ${token}`);
    roomCode = res.body.room_code as string;
  });

  test('正常取得', async () => {
    const res = await request(app)
      .get(`/api/rooms/${roomCode}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.room_code).toBe(roomCode);
  });

  test('存在しないルームコードは404', async () => {
    const res = await request(app)
      .get('/api/rooms/XXXXXX')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
  });

  test('トークンなしは401', async () => {
    const res = await request(app).get(`/api/rooms/${roomCode}`);
    expect(res.status).toBe(401);
  });
});

// ─── POST /api/rooms/:roomCode/join ──────────────────────────────────────────

describe('POST /api/rooms/:roomCode/join', () => {
  let roomCode: string;

  beforeAll(async () => {
    const res = await request(app)
      .post('/api/rooms')
      .set('Authorization', `Bearer ${token}`);
    roomCode = res.body.room_code as string;
  });

  test('別ユーザーが正常参加', async () => {
    const res = await request(app)
      .post(`/api/rooms/${roomCode}/join`)
      .set('Authorization', `Bearer ${token2}`);
    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Joined');
  });

  test('存在しないルームコードは404', async () => {
    const res = await request(app)
      .post('/api/rooms/XXXXXX/join')
      .set('Authorization', `Bearer ${token2}`);
    expect(res.status).toBe(404);
  });

  test('トークンなしは401', async () => {
    const res = await request(app).post(`/api/rooms/${roomCode}/join`);
    expect(res.status).toBe(401);
  });

  test('ゲーム開始済みのルームへの参加は400', async () => {
    const createRes = await request(app)
      .post('/api/rooms')
      .set('Authorization', `Bearer ${token}`);
    const playingRoomCode = createRes.body.room_code as string;
    await pool.query("UPDATE rooms SET status = 'playing' WHERE room_code = $1", [playingRoomCode]);

    const res = await request(app)
      .post(`/api/rooms/${playingRoomCode}/join`)
      .set('Authorization', `Bearer ${token2}`);
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Game already started');
  });

  test('満員のルームへの参加は400', async () => {
    const createRes = await request(app)
      .post('/api/rooms')
      .set('Authorization', `Bearer ${token}`);
    const fullRoomCode = createRes.body.room_code as string;

    // host（token）+ token2〜token6 で6人 = 満員
    for (const t of [token2, token3, token4, token5, token6]) {
      await request(app)
        .post(`/api/rooms/${fullRoomCode}/join`)
        .set('Authorization', `Bearer ${t}`);
    }

    const res = await request(app)
      .post(`/api/rooms/${fullRoomCode}/join`)
      .set('Authorization', `Bearer ${token7}`);
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Room is full');
  });
});

// ─── POST /api/rooms/:roomCode/leave ─────────────────────────────────────────

describe('POST /api/rooms/:roomCode/leave', () => {
  let roomCode: string;

  beforeAll(async () => {
    const res = await request(app)
      .post('/api/rooms')
      .set('Authorization', `Bearer ${token}`);
    roomCode = res.body.room_code as string;
    await request(app)
      .post(`/api/rooms/${roomCode}/join`)
      .set('Authorization', `Bearer ${token2}`);
  });

  test('正常退出', async () => {
    const res = await request(app)
      .post(`/api/rooms/${roomCode}/leave`)
      .set('Authorization', `Bearer ${token2}`);
    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Left');
  });

  test('存在しないルームコードは404', async () => {
    const res = await request(app)
      .post('/api/rooms/XXXXXX/leave')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
  });

  test('トークンなしは401', async () => {
    const res = await request(app).post(`/api/rooms/${roomCode}/leave`);
    expect(res.status).toBe(401);
  });

  test('ホストはルームから退出できない（400）', async () => {
    const res = await request(app)
      .post(`/api/rooms/${roomCode}/leave`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Host cannot leave the room');
  });
});
