import http from 'http';
import app from './app';
import { initWsServer } from './websocket/wsServer';

if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET is not set');

const server = http.createServer(app);
initWsServer(server);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
