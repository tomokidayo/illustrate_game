import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import pool from '../db';

export const register = async (req: Request, res: Response) => {
  const { username, password } = req.body as { username: string; password: string };
  if (!username || !password) {
    res.status(400).json({ error: 'username and password required' }); return;
  }
  if (username.length < 2 || username.length > 20) {
    res.status(400).json({ error: 'username must be 2–20 characters' }); return;
  }
  if (!/^[a-zA-Z0-9_]+$/.test(username)) {
    res.status(400).json({ error: 'username must be alphanumeric' }); return;
  }
  if (password.length < 6) {
    res.status(400).json({ error: 'password must be at least 6 characters' }); return;
  }

  try {
    const password_hash = await bcrypt.hash(password, 10);
    const { rows } = await pool.query(
      'INSERT INTO users (username, password_hash) VALUES ($1, $2) RETURNING id, username, created_at',
      [username, password_hash]
    );
    res.status(201).json(rows[0]);
  } catch (err: unknown) {
    if ((err as { code?: string }).code === '23505') {
      res.status(409).json({ error: 'Username already taken' }); return;
    }
    throw err;
  }
};

export const login = async (req: Request, res: Response) => {
  const { username, password } = req.body as { username: string; password: string };
  if (!username || !password) {
    res.status(400).json({ error: 'username and password required' }); return;
  }

  const { rows } = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
  const user = rows[0] as { id: string; username: string; password_hash: string; email: string | null; avatar: string | null } | undefined;
  if (!user || !(await bcrypt.compare(password, user.password_hash))) {
    res.status(401).json({ error: 'Invalid credentials' }); return;
  }
  const token = jwt.sign(
    { id: user.id, username: user.username },
    process.env.JWT_SECRET as string,
    { expiresIn: '7d' }
  );
  res.json({ token, user: { id: user.id, username: user.username, email: user.email, avatar: user.avatar } });
};

export const logout = async (req: Request, res: Response) => {
  const decoded = jwt.decode(req.token!) as { exp: number };
  await pool.query(
    'INSERT INTO token_blacklist (token, expired_at) VALUES ($1, to_timestamp($2))',
    [req.token, decoded.exp]
  );
  res.json({ message: 'Logged out' });
};

export const me = async (req: Request, res: Response) => {
  const { rows } = await pool.query(
    'SELECT id, username, email, avatar, created_at FROM users WHERE id = $1',
    [req.user!.id]
  );
  res.json(rows[0]);
};
