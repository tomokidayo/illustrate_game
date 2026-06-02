require('dotenv').config();
const express = require('express');
const cors = require('cors');
const http = require('http');
const { initWsServer } = require('./websocket/wsServer');

const authRoutes = require('./routes/auth');
const roomRoutes = require('./routes/room');

const app = express();
const server = http.createServer(app);

app.use(cors({ origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173' }));
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/rooms', roomRoutes);

initWsServer(server);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
