import { Server } from 'http';
import { WebSocketServer, WebSocket, RawData } from 'ws';
import jwt from 'jsonwebtoken';
import pool from '../db';
import { handle, handleDisconnect } from './gameManager';

export interface AuthedWebSocket extends WebSocket {
  user?: { id: string; username: string; isGuest?: boolean };
}

export function initWsServer(server: Server): WebSocketServer {
  const wss = new WebSocketServer({ server });

  // Heroku drops idle connections after 55 s (H15). Send a ping every 30 s to keep them alive.
  const heartbeat = setInterval(() => {
    wss.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) client.ping();
    });
  }, 30000);
  wss.on('close', () => clearInterval(heartbeat));

  wss.on('connection', (ws: AuthedWebSocket, req) => {
    const url = new URL(req.url!, 'http://localhost');
    const token = url.searchParams.get('token');

    if (!token) {
      ws.close(1008, 'Token required');
      return;
    }

    // Auth is async (blacklist DB query). Register handlers synchronously so no
    // messages are lost if the client sends immediately after the WS handshake.
    const pending: RawData[] = [];
    const bufferMessage = (data: RawData) => { pending.push(data); };
    ws.on('message', bufferMessage);
    ws.on('close', () => handleDisconnect(wss, ws));

    const processMessage = (data: RawData) => {
      let msg: unknown;
      try { msg = JSON.parse(data.toString()); } catch { return; }
      handle(wss, ws, msg);
    };

    void (async () => {
      try {
        const { rows } = await pool.query(
          'SELECT id FROM token_blacklist WHERE token = $1',
          [token]
        );
        if (rows.length > 0) { ws.close(1008, 'Token revoked'); return; }
        ws.user = jwt.verify(token, process.env.JWT_SECRET as string) as { id: string; username: string };
      } catch {
        ws.close(1008, 'Invalid token');
        return;
      }

      ws.off('message', bufferMessage);
      ws.on('message', processMessage);
      for (const data of pending) processMessage(data);
    })();
  });

  return wss;
}
