const MSG_TYPE_TEXT = 'text';
const MSG_TYPE_IMAGE = 'image';
const EVENT_CHAT_MESSAGE = 'chat message';
const EVENT_ERROR = 'error';

const MAX_IMAGE_SIZE_BYTES = 2 * 1024 * 1024; // 2MB
const MAX_IMAGE_WIDTH = 800;
const IMAGE_JPEG_QUALITY = 0.8;

const socket = io();
const form = document.getElementById('chat-form');
const input = document.getElementById('chat-input');
const messages = document.getElementById('messages');
const imageUpload = document.getElementById('image-upload');
const encryptionKeyInput = document.getElementById('encryption-key');
const setKeyButton = document.getElementById('set-key');
const nicknameInput = document.getElementById('nickname');

let encryptionKey = '';
let myId = '';
let myNickname = '访客';
const userColors = {};

function getRandomColor() {
    const letters = '0123456789ABCDEF';
    let color = '#';
    for (let i = 0; i < 6; i++) {
        color += letters[Math.floor(Math.random() * 16)];
    }
    return color;
}

function getInitials(userId) {
    return String(userId).slice(0, 2).toUpperCase();
}

function encryptMessage(message) {
    return CryptoJS.AES.encrypt(message, encryptionKey).toString();
}

function decryptMessage(encryptedMessage) {
    try {
        const bytes = CryptoJS.AES.decrypt(encryptedMessage, encryptionKey);
        return bytes.toString(CryptoJS.enc.Utf8);
    } catch (error) {
        return null;
    }
}

function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('show'));
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 2500);
}

function compressImage(file) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        const url = URL.createObjectURL(file);
        img.onload = () => {
            URL.revokeObjectURL(url);
            const canvas = document.createElement('canvas');
            let { width, height } = img;
            if (width > MAX_IMAGE_WIDTH) {
                height = (height * MAX_IMAGE_WIDTH) / width;
                width = MAX_IMAGE_WIDTH;
            }
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);
            try {
                const dataUrl = canvas.toDataURL('image/jpeg', IMAGE_JPEG_QUALITY);
                resolve(dataUrl);
            } catch (e) {
                reject(e);
            }
        };
        img.onerror = () => {
            URL.revokeObjectURL(url);
            reject(new Error('图片加载失败'));
        };
        img.src = url;
    });
}

function createMessageElement(msg, isImage = false, isMine = false) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${isMine ? 'mine' : 'others'}`;

    const avatarDiv = document.createElement('div');
    avatarDiv.className = 'avatar';
    avatarDiv.style.backgroundColor = userColors[msg.userId] || getRandomColor();
    avatarDiv.textContent = getInitials(msg.userId);
    messageDiv.appendChild(avatarDiv);

    const bodyDiv = document.createElement('div');
    bodyDiv.className = 'message-body';

    const displayName = msg.nickname && String(msg.nickname).trim();
    if (displayName) {
        const nameSpan = document.createElement('span');
        nameSpan.className = 'message-nickname';
        nameSpan.textContent = displayName;
        bodyDiv.appendChild(nameSpan);
    }

    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';

    const decryptedContent = decryptMessage(msg.content);

    if (decryptedContent) {
        if (isImage) {
            const img = document.createElement('img');
            img.src = decryptedContent;
            img.className = 'message-image';
            contentDiv.appendChild(img);
        } else {
            const p = document.createElement('p');
            p.textContent = decryptedContent;
            p.className = 'message-text';
            contentDiv.appendChild(p);
        }
    } else {
        const p = document.createElement('p');
        p.textContent = '(Encrypted message)';
        p.className = 'message-text encrypted';
        contentDiv.appendChild(p);
    }

    bodyDiv.appendChild(contentDiv);
    messageDiv.appendChild(bodyDiv);
    return messageDiv;
}

form.addEventListener('submit', (e) => {
    e.preventDefault();
    const text = input.value.trim();
    if (text) {
        const encryptedMessage = encryptMessage(text);
        socket.emit(EVENT_CHAT_MESSAGE, {
            type: MSG_TYPE_TEXT,
            content: encryptedMessage,
            nickname: myNickname,
        });
        input.value = '';
    }
});

imageUpload.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
        showToast('请选择图片文件', 'error');
        return;
    }
    if (file.size > MAX_IMAGE_SIZE_BYTES) {
        showToast(`图片不能超过 ${MAX_IMAGE_SIZE_BYTES / 1024 / 1024}MB`, 'error');
        return;
    }
    const label = document.querySelector('.image-upload-label');
    const originalTitle = label.title;
    label.title = '上传中...';
    label.style.pointerEvents = 'none';
    try {
        const dataUrl = await compressImage(file);
        const encryptedImage = encryptMessage(dataUrl);
        socket.emit(EVENT_CHAT_MESSAGE, {
            type: MSG_TYPE_IMAGE,
            content: encryptedImage,
            nickname: myNickname,
        });
    } catch (err) {
        showToast(err.message || '图片处理失败', 'error');
    } finally {
        label.title = originalTitle;
        label.style.pointerEvents = '';
    }
});

setKeyButton.addEventListener('click', () => {
    encryptionKey = encryptionKeyInput.value;
    encryptionKeyInput.value = '';
    showToast('加密密钥已设置', 'success');
});

if (nicknameInput) {
    nicknameInput.addEventListener('change', (e) => {
        const v = e.target.value.trim();
        if (v) myNickname = v;
    });
    nicknameInput.addEventListener('blur', (e) => {
        const v = e.target.value.trim();
        if (v) myNickname = v;
    });
}

socket.on('connect', () => {
    myId = socket.id;
    userColors[myId] = getRandomColor();
});

socket.on(EVENT_CHAT_MESSAGE, (msg) => {
    const messageElement = createMessageElement(
        msg,
        msg.type === MSG_TYPE_IMAGE,
        msg.userId === myId
    );
    messages.appendChild(messageElement);
    messages.scrollTop = messages.scrollHeight;
});

socket.on(EVENT_ERROR, (payload) => {
    showToast(payload.message || '操作失败', 'error');
});
