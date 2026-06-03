const { WebSocketServer } = require('ws');
const jwt = require('jsonwebtoken');
const pool = require('../db');
const gameManager = require('./gameManager');

function initWsServer(server) {
  const wss = new WebSocketServer({ server });

  wss.on('connection', async (ws, req) => {
    const url = new URL(req.url, 'http://localhost');
    const token = url.searchParams.get('token');

    if (!token) {
      ws.close(1008, 'Token required');
      return;
    }

    try {
      const { rows } = await pool.query(
        'SELECT id FROM token_blacklist WHERE token = $1',
        [token]
      );
      if (rows.length > 0) {
        ws.close(1008, 'Token revoked');
        return;
      }
      ws.user = jwt.verify(token, process.env.JWT_SECRET);
    } catch {
      ws.close(1008, 'Invalid token');
      return;
    }

    ws.on('message', (data) => {
      let msg;
      try { msg = JSON.parse(data); } catch { return; }
      gameManager.handle(wss, ws, msg);
    });

    ws.on('close', () => {
      gameManager.handleDisconnect(wss, ws);
    });
  });

  return wss;
}

module.exports = { initWsServer };
