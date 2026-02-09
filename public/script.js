const MSG_TYPE_TEXT = 'text';
const MSG_TYPE_IMAGE = 'image';
const EVENT_CHAT_MESSAGE = 'chat message';
const EVENT_ERROR = 'error';

const MAX_IMAGE_SIZE_BYTES = 2 * 1024 * 1024; // 2MB
const MAX_IMAGE_WIDTH = 800;
const IMAGE_JPEG_QUALITY = 0.8;

const THEME_KEY = 'securechat_theme';
const LANG_KEY = 'securechat_lang';
const PROFILES_KEY = 'securechat_profiles';
const THEME_AUTO = 'auto';
const THEME_LIGHT = 'light';
const THEME_DARK = 'dark';

const socket = io();
const form = document.getElementById('chat-form');
const input = document.getElementById('chat-input');
const messages = document.getElementById('messages');
const imageUpload = document.getElementById('image-upload');
const encryptionKeyInput = document.getElementById('encryption-key');
const setKeyButton = document.getElementById('set-key');
const nicknameInput = document.getElementById('nickname');
const profileSelect = document.getElementById('profile-select');
const themeSelect = document.getElementById('theme-select');
const langSelect = document.getElementById('lang-select');

let encryptionKey = '';
let myId = '';
let myNickname = '访客';
let currentProfileId = '1';
let themeMode = THEME_AUTO;
let currentLang = 'zh-CN';
const userColors = {};
let profiles = {
    1: { nickname: '访客 1', encryptionKey: '' },
    2: { nickname: '访客 2', encryptionKey: '' },
    3: { nickname: '访客 3', encryptionKey: '' },
};

function loadProfiles() {
    try {
        const saved = localStorage.getItem(PROFILES_KEY);
        if (saved) {
            const parsed = JSON.parse(saved);
            if (parsed && typeof parsed === 'object') {
                profiles = {
                    1: { nickname: '访客 1', encryptionKey: '', ...(parsed['1'] || {}) },
                    2: { nickname: '访客 2', encryptionKey: '', ...(parsed['2'] || {}) },
                    3: { nickname: '访客 3', encryptionKey: '', ...(parsed['3'] || {}) },
                };
            }
        }
    } catch (e) {
        // ignore
    }
}

function saveProfiles() {
    try {
        localStorage.setItem(PROFILES_KEY, JSON.stringify(profiles));
    } catch (e) {
        // ignore
    }
}

const i18n = {
    'zh-CN': {
        title: 'Secure Chat',
        subtitle: '轻量级端到端加密聊天室',
        profileLabel: '身份',
        profile1: '身份 1',
        profile2: '身份 2',
        profile3: '身份 3',
        themeLabel: '主题',
        themeAuto: '跟随系统',
        themeLight: '浅色',
        themeDark: '深色',
        langLabel: '语言',
        langZh: '中文',
        langEn: 'English',
        nicknamePlaceholder: '昵称（可选）',
        nicknameTitle: '设置后将在消息中显示',
        encryptionKeyPlaceholder: '加密密钥',
        encryptionKeyTitle: '设置后本地消息将使用该密钥加密',
        setKeyTitle: '设置加密密钥',
        inputPlaceholder: '输入消息...',
        toastKeySet: '加密密钥已设置',
        toastSelectImage: '请选择图片文件',
        toastImageTooLarge: (sizeMb) => `图片不能超过 ${sizeMb}MB`,
        toastImageFailed: '图片处理失败',
        toastErrorFallback: '操作失败',
    },
    en: {
        title: 'Secure Chat',
        subtitle: 'Lightweight end-to-end encrypted chat',
        profileLabel: 'Profile',
        profile1: 'Profile 1',
        profile2: 'Profile 2',
        profile3: 'Profile 3',
        themeLabel: 'Theme',
        themeAuto: 'Auto',
        themeLight: 'Light',
        themeDark: 'Dark',
        langLabel: 'Language',
        langZh: '中文',
        langEn: 'English',
        nicknamePlaceholder: 'Nickname (optional)',
        nicknameTitle: 'Will be shown with your messages',
        encryptionKeyPlaceholder: 'Encryption key',
        encryptionKeyTitle: 'Outgoing messages will be encrypted with this key',
        setKeyTitle: 'Set encryption key',
        inputPlaceholder: 'Type a message...',
        toastKeySet: 'Encryption key set',
        toastSelectImage: 'Please select an image file',
        toastImageTooLarge: (sizeMb) => `Image must be <= ${sizeMb}MB`,
        toastImageFailed: 'Image processing failed',
        toastErrorFallback: 'Operation failed',
    },
};

function t(key, ...args) {
    const dict = i18n[currentLang] || i18n['zh-CN'];
    const value = dict[key];
    if (typeof value === 'function') return value(...args);
    return value || key;
}

function applyLanguage() {
    document.documentElement.lang = currentLang;

    document
        .querySelectorAll('[data-i18n]')
        .forEach((el) => {
            const key = el.getAttribute('data-i18n');
            const text = t(key);
            if (typeof text === 'string') el.textContent = text;
        });

    document
        .querySelectorAll('[data-i18n-placeholder]')
        .forEach((el) => {
            const key = el.getAttribute('data-i18n-placeholder');
            const text = t(key);
            if (typeof text === 'string') el.placeholder = text;
        });

    document
        .querySelectorAll('[data-i18n-title]')
        .forEach((el) => {
            const key = el.getAttribute('data-i18n-title');
            const text = t(key);
            if (typeof text === 'string') el.title = text;
        });

    if (langSelect) {
        langSelect.value = currentLang;
    }
}

function applyTheme() {
    const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)');
    let effective = themeMode;
    if (themeMode === THEME_AUTO) {
        effective = prefersDark && prefersDark.matches ? THEME_DARK : THEME_LIGHT;
    }
    document.documentElement.setAttribute('data-theme', effective);
    if (themeSelect) {
        themeSelect.value = themeMode;
    }
}

function initThemeAndLanguage() {
    try {
        const savedLang = localStorage.getItem(LANG_KEY);
        if (savedLang && i18n[savedLang]) {
            currentLang = savedLang;
        } else {
            const browserLang = navigator.language || navigator.userLanguage;
            currentLang = browserLang.startsWith('zh') ? 'zh-CN' : 'en';
        }

        const savedTheme = localStorage.getItem(THEME_KEY);
        if (savedTheme === THEME_LIGHT || savedTheme === THEME_DARK || savedTheme === THEME_AUTO) {
            themeMode = savedTheme;
        } else {
            themeMode = THEME_AUTO;
        }
    } catch (e) {
        // 忽略本地存储错误
    }

    applyLanguage();
    applyTheme();

    const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)');
    if (prefersDark && prefersDark.addEventListener) {
        prefersDark.addEventListener('change', () => {
            if (themeMode === THEME_AUTO) {
                applyTheme();
            }
        });
    }
}

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

function getAvatarText(msg) {
    const displayName = msg.nickname && String(msg.nickname).trim();
    if (displayName) {
        // 显示昵称前两个字符，避免过长撑破头像
        return displayName.slice(0, 2);
    }
    return getInitials(msg.userId);
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
    if (!userColors[msg.userId]) {
        userColors[msg.userId] = getRandomColor();
    }
    avatarDiv.style.backgroundColor = userColors[msg.userId];
    avatarDiv.textContent = getAvatarText(msg);
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
        showToast(t('toastSelectImage'), 'error');
        return;
    }
    if (file.size > MAX_IMAGE_SIZE_BYTES) {
        showToast(t('toastImageTooLarge', MAX_IMAGE_SIZE_BYTES / 1024 / 1024), 'error');
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
        showToast(err.message || t('toastImageFailed'), 'error');
    } finally {
        label.title = originalTitle;
        label.style.pointerEvents = '';
    }
});

setKeyButton.addEventListener('click', () => {
    encryptionKey = encryptionKeyInput.value;
    encryptionKeyInput.value = '';
    if (profiles[currentProfileId]) {
        profiles[currentProfileId].encryptionKey = encryptionKey;
        saveProfiles();
    }
    showToast(t('toastKeySet'), 'success');
});

if (nicknameInput) {
    nicknameInput.addEventListener('change', (e) => {
        const v = e.target.value.trim();
        if (v) {
            myNickname = v;
            if (profiles[currentProfileId]) {
                profiles[currentProfileId].nickname = v;
                saveProfiles();
            }
        }
    });
    nicknameInput.addEventListener('blur', (e) => {
        const v = e.target.value.trim();
        if (v) {
            myNickname = v;
            if (profiles[currentProfileId]) {
                profiles[currentProfileId].nickname = v;
                saveProfiles();
            }
        }
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
    showToast(payload.message || t('toastErrorFallback'), 'error');
});

// 初始化应用状态（主题、语言、身份）
function initAppState() {
    loadProfiles();

    // 初始 profile 选择
    if (profileSelect) {
        currentProfileId = profileSelect.value || '1';
    }

    // 使用当前 profile 初始化昵称和加密密钥
    const profile = profiles[currentProfileId] || profiles['1'];
    myNickname = profile.nickname || myNickname;
    encryptionKey = profile.encryptionKey || encryptionKey;

    if (nicknameInput && profile.nickname) {
        nicknameInput.value = profile.nickname;
    }

    initThemeAndLanguage();

    // 绑定下拉框事件
    if (langSelect) {
        langSelect.addEventListener('change', (e) => {
            currentLang = e.target.value;
            try {
                localStorage.setItem(LANG_KEY, currentLang);
            } catch (err) {
                // ignore
            }
            applyLanguage();
        });
    }

    if (themeSelect) {
        themeSelect.addEventListener('change', (e) => {
            themeMode = e.target.value;
            try {
                localStorage.setItem(THEME_KEY, themeMode);
            } catch (err) {
                // ignore
            }
            applyTheme();
        });
    }

    if (profileSelect) {
        profileSelect.addEventListener('change', (e) => {
            const newId = e.target.value || '1';
            currentProfileId = newId;
            const p = profiles[currentProfileId] || { nickname: '', encryptionKey: '' };
            myNickname = p.nickname || `访客 ${currentProfileId}`;
            encryptionKey = p.encryptionKey || '';
            if (nicknameInput) {
                nicknameInput.value = p.nickname || '';
            }
        });
    }
}

document.addEventListener('DOMContentLoaded', initAppState);
