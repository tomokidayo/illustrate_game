import { WebSocketServer } from 'ws';
import { AuthedWebSocket } from './wsServer';

// TODO: implement game logic
export function handle(wss: WebSocketServer, ws: AuthedWebSocket, msg: unknown): void {
  console.log('WS message:', msg);
}

export function handleDisconnect(wss: WebSocketServer, ws: AuthedWebSocket): void {
  console.log('WS disconnected:', ws.user?.username);
}
