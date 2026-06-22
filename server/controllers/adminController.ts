import { Request, Response } from 'express';
import pool from '../db';

interface UserRow {
  id: string;
  username: string;
  avatar: string | null;
  created_at: string;
}

/**
 * 全ユーザー一覧を返す
 * @route GET /api/admin/users
 */
export const getUsers = async (_req: Request, res: Response): Promise<void> => {
  const { rows } = await pool.query<UserRow>(
    'SELECT id, username, avatar, created_at FROM users ORDER BY created_at DESC'
  );
  res.json(rows);
};
