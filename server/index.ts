import http from 'http';
import app from './app';
import { initWsServer } from './websocket/wsServer';

const server = http.createServer(app);
initWsServer(server);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
