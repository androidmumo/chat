const express = require('express');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const multer = require('multer');
const app = express();
const http = require('http').createServer(app);
const { Server } = require('socket.io');

// 请求体大小限制（100KB，仅影响 express 路由）
app.use(express.json({ limit: '100kb' }));
// 提供打包后的前端资源
const distPath = path.join(__dirname, 'dist');
app.use(express.static(distPath));

// ========== 附件上传/拉取（服务端中转） ==========
// 说明：为了支持“不要压缩图片/支持任意文件”，上传走 HTTP，而不是把大 payload 直接塞进 Socket.IO。
const UPLOAD_DIR = path.join(__dirname, 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// 24 小时清理一次（避免附件无限堆积）
const ATTACHMENT_TTL_MS = 24 * 60 * 60 * 1000;
setInterval(() => {
    try {
        const files = fs.readdirSync(UPLOAD_DIR);
        const now = Date.now();
        files.forEach((name) => {
            const filePath = path.join(UPLOAD_DIR, name);
            const stat = fs.statSync(filePath);
            if (now - stat.mtimeMs > ATTACHMENT_TTL_MS) {
                fs.unlinkSync(filePath);
            }
        });
    } catch (e) {
        // ignore cleanup errors
    }
}, 10 * 60 * 1000);

const attachmentStorage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, UPLOAD_DIR),
    filename: (req, file, cb) => {
        const id = crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(16).toString('hex');
        cb(null, `${id}.enc`);
    },
});

const uploadAttachment = multer({
    storage: attachmentStorage,
    // 上传的是“加密后的字符串/二进制”，体积可能较原文件更大
    limits: { fileSize: 60 * 1024 * 1024 }, // 60MB
});

app.post('/api/attachments', uploadAttachment.single('encrypted'), (req, res) => {
    if (!req.file) {
        res.status(400).json({ error: 'missing encrypted field' });
        return;
    }
    res.json({ attachmentId: req.file.filename });
});

app.get('/api/attachments/:id', (req, res) => {
    const id = String(req.params.id || '');
    if (!id) {
        res.status(400).send('missing id');
        return;
    }
    // 防止路径穿越
    const safeName = path.basename(id);
    const filePath = path.join(UPLOAD_DIR, safeName);
    if (!fs.existsSync(filePath)) {
        res.status(404).send('not found');
        return;
    }
    res.sendFile(filePath);
});

// Socket.IO：单条消息最大 10MB
// 说明：未压缩大图 + Base64 + AES 加密后 payload 会显著增大
// 为了保证“不要压缩图片”仍可发送，这里需要提高上限。
const io = new Server(http, { maxHttpBufferSize: 10 * 1024 * 1024 });

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
    if (!msg || typeof msg !== 'object') return false;
    if (msg.type === 'text' || msg.type === 'image') {
        return typeof msg.content === 'string';
    }
    if (msg.type === 'attachment') {
        return (
            typeof msg.attachmentId === 'string' &&
            typeof msg.mimeType === 'string' &&
            typeof msg.filename === 'string'
        );
    }
    return false;
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
            content: typeof msg.content === 'string' ? msg.content : null,
            attachmentId: msg.type === 'attachment' ? msg.attachmentId : null,
            mimeType: msg.type === 'attachment' ? msg.mimeType : null,
            filename: msg.type === 'attachment' ? msg.filename : null,
            size: msg.type === 'attachment' ? (typeof msg.size === 'number' ? msg.size : null) : null,
            userId: socket.id,
            nickname: msg.nickname || null,
            color: typeof msg.color === 'string' ? msg.color : null,
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

// 兜底：所有非 Socket.IO 请求都交给前端路由（目前是单页应用）
app.get('*', (req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
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
