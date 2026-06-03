import { Request, Response } from 'express';
import pool from '../db';
import { nanoid } from '../utils/nanoid';

export const create = async (req: Request, res: Response) => {
  const roomCode = nanoid(6);
  const { rows } = await pool.query(
    'INSERT INTO rooms (room_code, host_user_id) VALUES ($1, $2) RETURNING *',
    [roomCode, req.user!.id]
  );
  await pool.query('INSERT INTO room_players (room_id, user_id) VALUES ($1, $2)', [rows[0].id, req.user!.id]);
  res.status(201).json(rows[0]);
};

export const get = async (req: Request, res: Response) => {
  const { rows } = await pool.query('SELECT * FROM rooms WHERE room_code = $1', [req.params.roomCode]);
  if (!rows[0]) { res.status(404).json({ error: 'Room not found' }); return; }
  res.json(rows[0]);
};

export const join = async (req: Request, res: Response) => {
  const { rows: room } = await pool.query('SELECT * FROM rooms WHERE room_code = $1', [req.params.roomCode]);
  if (!room[0]) { res.status(404).json({ error: 'Room not found' }); return; }
  if (room[0].status !== 'waiting') { res.status(400).json({ error: 'Game already started' }); return; }

  const { rows: players } = await pool.query('SELECT * FROM room_players WHERE room_id = $1', [room[0].id]);
  if (players.length >= 6) { res.status(400).json({ error: 'Room is full' }); return; }

  await pool.query(
    'INSERT INTO room_players (room_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
    [room[0].id, req.user!.id]
  );
  res.json({ message: 'Joined' });
};

export const leave = async (req: Request, res: Response) => {
  const { rows: room } = await pool.query('SELECT * FROM rooms WHERE room_code = $1', [req.params.roomCode]);
  if (!room[0]) { res.status(404).json({ error: 'Room not found' }); return; }
  await pool.query('DELETE FROM room_players WHERE room_id = $1 AND user_id = $2', [room[0].id, req.user!.id]);
  res.json({ message: 'Left' });
};
