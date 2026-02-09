const express = require('express');
const app = express();
const http = require('http').createServer(app);
const { Server } = require('socket.io');

// 请求体大小限制（100KB，仅影响 express 路由）
app.use(express.json({ limit: '100kb' }));
app.use(express.static('public'));

// Socket.IO：单条消息最大 500KB，防止大图拖垮内存
const io = new Server(http, { maxHttpBufferSize: 500 * 1024 });

// 简单限流：每个 socket 每分钟最多 60 条消息
const RATE_WINDOW_MS = 60 * 1000;
const RATE_MAX_MESSAGES = 60;
const socketMessageTimes = new Map();

function isRateLimited(socketId) {
    const now = Date.now();
    let times = socketMessageTimes.get(socketId) || [];
    times = times.filter((t) => now - t < RATE_WINDOW_MS);
    if (times.length >= RATE_MAX_MESSAGES) return true;
    times.push(now);
    socketMessageTimes.set(socketId, times);
    return false;
}

function isValidMessage(msg) {
    return (
        msg &&
        typeof msg === 'object' &&
        (msg.type === 'text' || msg.type === 'image') &&
        typeof msg.content === 'string'
    );
}

io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    socket.on('chat message', (msg) => {
        if (isRateLimited(socket.id)) {
            socket.emit('error', { message: '发送过于频繁，请稍后再试' });
            return;
        }
        if (!isValidMessage(msg)) {
            socket.emit('error', { message: '无效消息格式' });
            return;
        }
        io.emit('chat message', {
            type: msg.type,
            content: msg.content,
            userId: socket.id,
            nickname: msg.nickname || null,
        });
    });

    socket.on('disconnect', () => {
        socketMessageTimes.delete(socket.id);
        console.log('User disconnected:', socket.id);
    });

    socket.on('error', (err) => {
        console.error('Socket error:', socket.id, err);
    });
});

const PORT = process.env.PORT || 3000;
const server = http.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

server.on('error', (err) => {
    console.error('Server listen error:', err);
    process.exit(1);
});

// 优雅退出
function shutdown(signal) {
    console.log(`${signal} received, closing server...`);
    io.close(() => {
        server.close(() => {
            console.log('Server closed');
            process.exit(0);
        });
    });
    setTimeout(() => process.exit(1), 10000);
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

process.on('uncaughtException', (err) => {
    console.error('Uncaught exception:', err);
    process.exit(1);
});
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled rejection at', promise, 'reason:', reason);
});
