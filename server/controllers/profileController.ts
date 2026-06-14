import { Request, Response } from 'express';
import pool from '../db';

const VALID_AVATARS = ['😀','😎','🤩','😴','🐱','🐶','🐺','🦊','🐻','🐼','🐸','🐙','🦁','🐯','🐨','🐮','🌸','🌻','⭐','🌈','🎨','🎮','🍕','🎵'];

export const updateProfile = async (req: Request, res: Response) => {
  const { email, avatar } = req.body as { email?: string; avatar?: string };

  if (email !== undefined && email !== null && email !== '') {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      res.status(400).json({ error: '有効なメールアドレスを入力してください' }); return;
    }
  }

  if (avatar !== undefined && avatar !== null && avatar !== '') {
    if (!VALID_AVATARS.includes(avatar)) {
      res.status(400).json({ error: '無効なアイコンです' }); return;
    }
  }

  const newEmail = email === '' ? null : (email ?? undefined);
  const newAvatar = avatar === '' ? null : (avatar ?? undefined);

  const setClauses: string[] = [];
  const values: unknown[] = [];
  let idx = 1;

  if (newEmail !== undefined) { setClauses.push(`email = $${idx++}`); values.push(newEmail); }
  if (newAvatar !== undefined) { setClauses.push(`avatar = $${idx++}`); values.push(newAvatar); }

  if (setClauses.length === 0) {
    res.status(400).json({ error: '更新する項目がありません' }); return;
  }

  values.push(req.user!.id);
  try {
    const { rows } = await pool.query(
      `UPDATE users SET ${setClauses.join(', ')} WHERE id = $${idx} RETURNING id, username, email, avatar`,
      values
    );
    res.json(rows[0]);
  } catch (err: unknown) {
    if ((err as { code?: string }).code === '23505') {
      res.status(409).json({ error: 'このメールアドレスはすでに使用されています' }); return;
    }
    throw err;
  }
};
