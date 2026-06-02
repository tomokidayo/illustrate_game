const pool = require('../db');
const { nanoid } = require('../utils/nanoid');

exports.create = async (req, res) => {
  const roomCode = nanoid(6);
  const { rows } = await pool.query(
    'INSERT INTO rooms (room_code, host_user_id) VALUES ($1, $2) RETURNING *',
    [roomCode, req.user.id]
  );
  await pool.query('INSERT INTO room_players (room_id, user_id) VALUES ($1, $2)', [rows[0].id, req.user.id]);
  res.status(201).json(rows[0]);
};

exports.get = async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM rooms WHERE room_code = $1', [req.params.roomCode]);
  if (!rows[0]) return res.status(404).json({ error: 'Room not found' });
  res.json(rows[0]);
};

exports.join = async (req, res) => {
  const { rows: room } = await pool.query('SELECT * FROM rooms WHERE room_code = $1', [req.params.roomCode]);
  if (!room[0]) return res.status(404).json({ error: 'Room not found' });
  if (room[0].status !== 'waiting') return res.status(400).json({ error: 'Game already started' });

  const { rows: players } = await pool.query('SELECT * FROM room_players WHERE room_id = $1', [room[0].id]);
  if (players.length >= 6) return res.status(400).json({ error: 'Room is full' });

  await pool.query(
    'INSERT INTO room_players (room_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
    [room[0].id, req.user.id]
  );
  res.json({ message: 'Joined' });
};

exports.leave = async (req, res) => {
  const { rows: room } = await pool.query('SELECT * FROM rooms WHERE room_code = $1', [req.params.roomCode]);
  if (!room[0]) return res.status(404).json({ error: 'Room not found' });
  await pool.query('DELETE FROM room_players WHERE room_id = $1 AND user_id = $2', [room[0].id, req.user.id]);
  res.json({ message: 'Left' });
};
