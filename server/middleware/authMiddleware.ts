import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import pool from '../db';

export async function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) { res.status(401).json({ error: 'Token required' }); return; }

  try {
    const { rows } = await pool.query(
      'SELECT id FROM token_blacklist WHERE token = $1',
      [token]
    );
    if (rows.length > 0) { res.status(401).json({ error: 'Token revoked' }); return; }

    req.user = jwt.verify(token, process.env.JWT_SECRET as string) as { id: string; username: string };
    req.token = token;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}
