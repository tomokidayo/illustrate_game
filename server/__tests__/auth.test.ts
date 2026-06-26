import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../app';
import pool from '../db';

const TEST_USER = { username: 'testuser_auth', password: 'password123' };

beforeAll(async () => {
  await pool.query('DELETE FROM token_blacklist');
  await pool.query('DELETE FROM users WHERE username = $1', [TEST_USER.username]);
});

afterAll(async () => {
  await pool.query('DELETE FROM token_blacklist');
  await pool.query('DELETE FROM users WHERE username = $1', [TEST_USER.username]);
});

// ─── POST /api/auth/register ────────────────────────────────────────────────

describe('POST /api/auth/register', () => {
  test('正常登録', async () => {
    const res = await request(app).post('/api/auth/register').send(TEST_USER);
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('id');
    expect(res.body.username).toBe(TEST_USER.username);
    expect(res.body).not.toHaveProperty('password_hash');
  });

  test('重複ユーザー名は409', async () => {
    const res = await request(app).post('/api/auth/register').send(TEST_USER);
    expect(res.status).toBe(409);
    expect(res.body.error).toBe('Username already taken');
  });

  test('username未指定は400', async () => {
    const res = await request(app).post('/api/auth/register').send({ password: 'pass123' });
    expect(res.status).toBe(400);
  });

  test('password未指定は400', async () => {
    const res = await request(app).post('/api/auth/register').send({ username: 'someone' });
    expect(res.status).toBe(400);
  });

  test('username短すぎは400', async () => {
    const res = await request(app).post('/api/auth/register').send({ username: 'a', password: 'pass123' });
    expect(res.status).toBe(400);
  });

  test('username長すぎは400', async () => {
    const res = await request(app).post('/api/auth/register').send({ username: 'a'.repeat(21), password: 'pass123' });
    expect(res.status).toBe(400);
  });

  test('password短すぎは400', async () => {
    const res = await request(app).post('/api/auth/register').send({ username: 'newuser2', password: '123' });
    expect(res.status).toBe(400);
  });

  test('username不正文字は400', async () => {
    const res = await request(app).post('/api/auth/register').send({ username: 'user name!', password: 'pass123' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('username must be alphanumeric');
  });
});

// ─── POST /api/auth/login ────────────────────────────────────────────────────

describe('POST /api/auth/login', () => {
  test('正常ログイン・JWTが返る', async () => {
    const res = await request(app).post('/api/auth/login').send(TEST_USER);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('token');
    expect(res.body.user.username).toBe(TEST_USER.username);
  });

  test('存在しないユーザーは401', async () => {
    const res = await request(app).post('/api/auth/login').send({ username: 'nobody', password: 'pass' });
    expect(res.status).toBe(401);
  });

  test('パスワード不一致は401', async () => {
    const res = await request(app).post('/api/auth/login').send({ username: TEST_USER.username, password: 'wrongpass' });
    expect(res.status).toBe(401);
  });

  test('username未指定は400', async () => {
    const res = await request(app).post('/api/auth/login').send({ password: 'pass123' });
    expect(res.status).toBe(400);
  });
});

// ─── GET /api/auth/me ────────────────────────────────────────────────────────

describe('GET /api/auth/me', () => {
  let token: string;

  beforeAll(async () => {
    const res = await request(app).post('/api/auth/login').send(TEST_USER);
    token = res.body.token as string;
  });

  test('正常取得', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.username).toBe(TEST_USER.username);
    expect(res.body).not.toHaveProperty('password_hash');
  });

  test('トークンなしは401', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });

  test('不正トークンは401', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', 'Bearer invalidtoken');
    expect(res.status).toBe(401);
  });
});

// ─── POST /api/auth/logout ───────────────────────────────────────────────────

describe('POST /api/auth/logout', () => {
  let logoutToken: string;

  beforeAll(async () => {
    const res = await request(app).post('/api/auth/login').send(TEST_USER);
    logoutToken = res.body.token as string;
  });

  test('正常ログアウト', async () => {
    const res = await request(app)
      .post('/api/auth/logout')
      .set('Authorization', `Bearer ${logoutToken}`);
    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Logged out');
  });

  test('ログアウト済みトークンは401', async () => {
    const res = await request(app)
      .post('/api/auth/logout')
      .set('Authorization', `Bearer ${logoutToken}`);
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Token revoked');
  });

  test('ログアウト済みトークンで /me は401', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${logoutToken}`);
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Token revoked');
  });

  test('トークンなしは401', async () => {
    const res = await request(app).post('/api/auth/logout');
    expect(res.status).toBe(401);
  });
});

// ─── POST /api/auth/guest ────────────────────────────────────────────────────

describe('POST /api/auth/guest', () => {
  test('ゲストトークンとユーザー情報が返る', async () => {
    const res = await request(app).post('/api/auth/guest').send({ username: 'ゲスト太郎' });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('token');
    expect(res.body.user.isGuest).toBe(true);
    expect(res.body.user.id).toMatch(/^guest_/);
    expect(res.body.user.username).toBe('ゲスト太郎');
  });

  test('JWTペイロードにisGuest: trueが含まれる', async () => {
    const res = await request(app).post('/api/auth/guest').send({ username: 'テストゲスト' });
    expect(res.status).toBe(200);
    const decoded = jwt.verify(res.body.token as string, process.env.JWT_SECRET as string) as { isGuest: boolean; id: string };
    expect(decoded.isGuest).toBe(true);
    expect(decoded.id).toMatch(/^guest_/);
  });

  test('username未指定は400', async () => {
    const res = await request(app).post('/api/auth/guest').send({});
    expect(res.status).toBe(400);
  });

  test('username短すぎ（1文字）は400', async () => {
    const res = await request(app).post('/api/auth/guest').send({ username: 'a' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });

  test('username長すぎ（21文字）は400', async () => {
    const res = await request(app).post('/api/auth/guest').send({ username: 'a'.repeat(21) });
    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });

  test('前後空白トリム後2文字以上であれば登録される', async () => {
    const res = await request(app).post('/api/auth/guest').send({ username: '  ab  ' });
    expect(res.status).toBe(200);
    expect(res.body.user.username).toBe('ab');
  });
});
