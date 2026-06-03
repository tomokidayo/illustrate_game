import request from 'supertest';
import app from '../app';
import pool from '../db';

const TEST_USER = { username: 'testuser_room', password: 'password123' };
const TEST_USER2 = { username: 'testuser_room2', password: 'password123' };

let token: string;
let token2: string;

beforeAll(async () => {
  await pool.query('DELETE FROM room_players USING rooms WHERE room_players.room_id = rooms.id AND rooms.host_user_id IN (SELECT id FROM users WHERE username IN ($1, $2))', [TEST_USER.username, TEST_USER2.username]);
  await pool.query('DELETE FROM rooms WHERE host_user_id IN (SELECT id FROM users WHERE username IN ($1, $2))', [TEST_USER.username, TEST_USER2.username]);
  await pool.query('DELETE FROM users WHERE username IN ($1, $2)', [TEST_USER.username, TEST_USER2.username]);

  await request(app).post('/api/auth/register').send(TEST_USER);
  await request(app).post('/api/auth/register').send(TEST_USER2);

  const res1 = await request(app).post('/api/auth/login').send(TEST_USER);
  const res2 = await request(app).post('/api/auth/login').send(TEST_USER2);
  token = res1.body.token as string;
  token2 = res2.body.token as string;
});

afterAll(async () => {
  await pool.query('DELETE FROM room_players USING rooms WHERE room_players.room_id = rooms.id AND rooms.host_user_id IN (SELECT id FROM users WHERE username IN ($1, $2))', [TEST_USER.username, TEST_USER2.username]);
  await pool.query('DELETE FROM rooms WHERE host_user_id IN (SELECT id FROM users WHERE username IN ($1, $2))', [TEST_USER.username, TEST_USER2.username]);
  await pool.query('DELETE FROM users WHERE username IN ($1, $2)', [TEST_USER.username, TEST_USER2.username]);
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
});
