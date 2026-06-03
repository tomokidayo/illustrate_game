const http = require('http');
const app = require('./app');
const { initWsServer } = require('./websocket/wsServer');

const server = http.createServer(app);
initWsServer(server);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
