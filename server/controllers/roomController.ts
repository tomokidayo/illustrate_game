import { Request, Response } from 'express';
import pool from '../db';
import { nanoid } from '../utils/nanoid';
import type { Room, RoomPlayer } from '../types/room';

/**
 * ルームを新規作成し、登録ユーザーの場合は参加者として登録する
 * @route POST /api/rooms
 * @returns 作成されたルーム情報（201）
 */
export const create = async (req: Request, res: Response): Promise<void> => {
  const roomCode = nanoid(6);
  const isGuest = req.user!.isGuest === true;

  // ゲストは host_user_id を NULL にする（users テーブルに存在しないため）
  const { rows } = await pool.query<Room>(
    'INSERT INTO rooms (room_code, host_user_id) VALUES ($1, $2) RETURNING *',
    [roomCode, isGuest ? null : req.user!.id]
  );

  // ゲストは room_players に登録しない
  if (!isGuest) {
    await pool.query(
      'INSERT INTO room_players (room_id, user_id) VALUES ($1, $2)',
      [rows[0].id, req.user!.id]
    );
  }

  res.status(201).json(rows[0]);
};

/**
 * ルームコードからルーム情報を取得する
 * @route GET /api/rooms/:roomCode
 * @param req.params.roomCode - 6文字の英数字ルームコード
 * @returns ルーム情報（200）、存在しない場合は 404
 */
export const get = async (req: Request, res: Response): Promise<void> => {
  const { rows } = await pool.query<Room>(
    'SELECT * FROM rooms WHERE room_code = $1',
    [req.params.roomCode]
  );
  if (!rows[0]) { res.status(404).json({ error: 'Room not found' }); return; }
  res.json(rows[0]);
};

/**
 * 指定したルームにユーザーを参加させる
 * @route POST /api/rooms/:roomCode/join
 * @param req.params.roomCode - 参加するルームコード
 * @returns 成功メッセージ（200）
 */
export const join = async (req: Request, res: Response): Promise<void> => {
  const isGuest = req.user!.isGuest === true;

  const { rows: room } = await pool.query<Room>(
    'SELECT * FROM rooms WHERE room_code = $1',
    [req.params.roomCode]
  );
  if (!room[0]) { res.status(404).json({ error: 'Room not found' }); return; }
  if (room[0].status !== 'waiting') { res.status(400).json({ error: 'Game already started' }); return; }

  if (!isGuest) {
    const { rows: players } = await pool.query<RoomPlayer>(
      'SELECT * FROM room_players WHERE room_id = $1',
      [room[0].id]
    );
    if (players.length >= 6) { res.status(400).json({ error: 'Room is full' }); return; }

    await pool.query(
      'INSERT INTO room_players (room_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [room[0].id, req.user!.id]
    );
  }

  res.json({ message: 'Joined' });
};

/**
 * ログインユーザーを指定ルームから退出させる
 * @route POST /api/rooms/:roomCode/leave
 * @param req.params.roomCode - 退出するルームコード
 * @returns 成功メッセージ（200）
 */
export const leave = async (req: Request, res: Response): Promise<void> => {
  const isGuest = req.user!.isGuest === true;
  if (isGuest) { res.json({ message: 'Left' }); return; }

  const { rows: room } = await pool.query<Room>(
    'SELECT * FROM rooms WHERE room_code = $1',
    [req.params.roomCode]
  );
  if (!room[0]) { res.status(404).json({ error: 'Room not found' }); return; }
  if (room[0].host_user_id === req.user!.id) {
    res.status(400).json({ error: 'Host cannot leave the room' }); return;
  }
  await pool.query(
    'DELETE FROM room_players WHERE room_id = $1 AND user_id = $2',
    [room[0].id, req.user!.id]
  );
  res.json({ message: 'Left' });
};
