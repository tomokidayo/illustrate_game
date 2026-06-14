import { Request, Response } from 'express';
import pool from '../db';

interface FriendshipRow {
  id: string;
  requester_id: string;
  receiver_id: string;
  status: string;
}

/**
 * POST /api/friends/request — ユーザー名を指定してフレンド申請を送る
 */
export const sendRequest = async (req: Request, res: Response) => {
  const { username } = req.body as { username: string };
  if (!username) { res.status(400).json({ error: 'username is required' }); return; }

  const myId = req.user!.id;

  const { rows: targets } = await pool.query<{ id: string }>(
    'SELECT id FROM users WHERE username = $1',
    [username]
  );
  if (!targets[0]) { res.status(404).json({ error: 'ユーザーが見つかりません' }); return; }
  const targetId = targets[0].id;
  if (targetId === myId) { res.status(400).json({ error: '自分自身にはフレンド申請できません' }); return; }

  const { rows: existing } = await pool.query<FriendshipRow>(
    `SELECT * FROM friendships
     WHERE (requester_id = $1 AND receiver_id = $2)
        OR (requester_id = $2 AND receiver_id = $1)`,
    [myId, targetId]
  );
  if (existing[0]) {
    const msg = existing[0].status === 'accepted'
      ? 'すでにフレンドです'
      : 'すでに申請済みです';
    res.status(409).json({ error: msg }); return;
  }

  await pool.query(
    'INSERT INTO friendships (requester_id, receiver_id) VALUES ($1, $2)',
    [myId, targetId]
  );
  res.status(201).json({ message: 'フレンド申請を送りました' });
};

/**
 * GET /api/friends — 承認済みフレンド一覧を返す（ルーム参加中の場合はroom_codeも含む）
 */
export const getFriends = async (req: Request, res: Response) => {
  const myId = req.user!.id;
  const { rows } = await pool.query<{ id: string; friendship_id: string; username: string; avatar: string | null; room_code: string | null }>(
    `SELECT
       u.id,
       f.id AS friendship_id,
       u.username,
       u.avatar,
       r.room_code
     FROM friendships f
     JOIN users u ON u.id = CASE WHEN f.requester_id = $1 THEN f.receiver_id ELSE f.requester_id END
     LEFT JOIN room_players rp ON rp.user_id = u.id
     LEFT JOIN rooms r ON r.id = rp.room_id AND r.status = 'playing'
     WHERE (f.requester_id = $1 OR f.receiver_id = $1)
       AND f.status = 'accepted'`,
    [myId]
  );
  res.json(rows);
};

/**
 * GET /api/friends/requests — 自分宛の未承認申請一覧を返す
 */
export const getRequests = async (req: Request, res: Response) => {
  const myId = req.user!.id;
  const { rows } = await pool.query<{ friendship_id: string; username: string; avatar: string | null }>(
    `SELECT f.id AS friendship_id, u.username, u.avatar
     FROM friendships f
     JOIN users u ON u.id = f.requester_id
     WHERE f.receiver_id = $1 AND f.status = 'pending'
     ORDER BY f.created_at DESC`,
    [myId]
  );
  res.json(rows);
};

/**
 * PUT /api/friends/:id/accept — フレンド申請を承認する
 */
export const acceptRequest = async (req: Request, res: Response) => {
  const myId = req.user!.id;
  const { id } = req.params;
  const { rowCount } = await pool.query(
    `UPDATE friendships SET status = 'accepted'
     WHERE id = $1 AND receiver_id = $2 AND status = 'pending'`,
    [id, myId]
  );
  if (!rowCount) { res.status(404).json({ error: '申請が見つかりません' }); return; }
  res.json({ message: 'フレンド申請を承認しました' });
};

/**
 * DELETE /api/friends/:id — フレンド申請を拒否、またはフレンドを解除する
 */
export const deleteFriend = async (req: Request, res: Response) => {
  const myId = req.user!.id;
  const { id } = req.params;
  const { rowCount } = await pool.query(
    `DELETE FROM friendships
     WHERE id = $1 AND (requester_id = $2 OR receiver_id = $2)`,
    [id, myId]
  );
  if (!rowCount) { res.status(404).json({ error: '見つかりません' }); return; }
  res.json({ message: '削除しました' });
};
