const { WebSocketServer } = require('ws');
const jwt = require('jsonwebtoken');
const gameManager = require('./gameManager');

function initWsServer(server) {
  const wss = new WebSocketServer({ server });

  wss.on('connection', (ws, req) => {
    const url = new URL(req.url, 'http://localhost');
    const token = url.searchParams.get('token');

    try {
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
