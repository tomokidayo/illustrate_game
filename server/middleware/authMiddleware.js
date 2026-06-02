const jwt = require('jsonwebtoken');
const pool = require('../db');

async function authMiddleware(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Token required' });

  const { rows } = await pool.query(
    'SELECT id FROM token_blacklist WHERE token = $1',
    [token]
  );
  if (rows.length > 0) return res.status(401).json({ error: 'Token revoked' });

  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}

module.exports = authMiddleware;
