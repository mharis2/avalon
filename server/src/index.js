const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const RoomManager = require('./RoomManager');
const setupSocketHandlers = require('./socketHandlers');

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
    cors: {
        origin: process.env.CORS_ORIGIN || '*',
        methods: ['GET', 'POST'],
    },
});

app.use(cors());
app.use(express.json());

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: Date.now() });
});

// Setup Socket.io
const roomManager = new RoomManager();
setupSocketHandlers(io, roomManager);

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
    console.log(`\n  ⚔️  Avalon Server running on port ${PORT}\n`);
});
