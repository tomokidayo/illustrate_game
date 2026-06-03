import { Server } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import jwt from 'jsonwebtoken';
import pool from '../db';
import { handle, handleDisconnect } from './gameManager';

export interface AuthedWebSocket extends WebSocket {
  user?: { id: string; username: string };
}

export function initWsServer(server: Server): WebSocketServer {
  const wss = new WebSocketServer({ server });

  wss.on('connection', async (ws: AuthedWebSocket, req) => {
    const url = new URL(req.url!, 'http://localhost');
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
      ws.user = jwt.verify(token, process.env.JWT_SECRET as string) as { id: string; username: string };
    } catch {
      ws.close(1008, 'Invalid token');
      return;
    }

    ws.on('message', (data) => {
      let msg: unknown;
      try { msg = JSON.parse(data.toString()); } catch { return; }
      handle(wss, ws, msg);
    });

    ws.on('close', () => {
      handleDisconnect(wss, ws);
    });
  });

  return wss;
}
