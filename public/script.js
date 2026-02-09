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
const profileSelect = document.getElementById('profile-select');
const themeSelect = document.getElementById('theme-select');
const langSelect = document.getElementById('lang-select');
const profileAddBtn = document.getElementById('profile-add-btn');
const profileEditBtn = document.getElementById('profile-edit-btn');
const profileModal = document.getElementById('profile-modal');
const profileModalClose = document.getElementById('profile-modal-close');
const profileModalCancel = document.getElementById('profile-modal-cancel');
const profileForm = document.getElementById('profile-form');
const profileNicknameInput = document.getElementById('profile-nickname');
const profileKeyInput = document.getElementById('profile-key');
const profileColorInput = document.getElementById('profile-color');
const profileColorPicker = document.getElementById('profile-color-picker');

let encryptionKey = '';
let myId = '';
let myNickname = '访客';
let myColor = '#4F46E5';
let currentProfileId = '1';
let themeMode = THEME_AUTO;
let currentLang = 'zh-CN';
const userColors = {};
let profiles = {
    1: { nickname: '访客', encryptionKey: '', color: '#4F46E5' },
};

function loadProfiles() {
    try {
        const saved = localStorage.getItem(PROFILES_KEY);
        if (saved) {
            const parsed = JSON.parse(saved);
            if (parsed && typeof parsed === 'object') {
                profiles = {};
                Object.keys(parsed).forEach((id) => {
                    const p = parsed[id] || {};
                    profiles[id] = {
                        nickname: p.nickname || '访客',
                        encryptionKey: p.encryptionKey || '',
                        color: p.color || getRandomColor(),
                    };
                });
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
        profileEditTitle: '编辑当前身份',
        profileModalTitle: '编辑身份',
        profileModalSubtitle: '为当前身份设置昵称与加密密钥，只保存在本地浏览器',
        profileNicknameLabel: '昵称',
        profileNicknameHint: '会显示在消息上方和头像文字中',
        profileNicknamePlaceholder: '输入一个你喜欢的昵称',
        profileKeyLabel: '加密密钥',
        profileKeyHint: '仅本地使用，不会上传服务器；同一个密钥的用户之间才能互相解密',
        profileKeyPlaceholder: '为当前身份设置一个加密密钥',
        profileCancel: '取消',
        profileSave: '保存',
        profileAddTitle: '创建新身份',
        profileColorLabel: '身份颜色',
        profileColorHint: '用于头像和自己消息的气泡颜色',
        profileColorPlaceholder: '#4F46E5',
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
        profileEditTitle: 'Edit current profile',
        profileModalTitle: 'Edit profile',
        profileModalSubtitle: 'Configure nickname and encryption key for this profile. Stored only in this browser.',
        profileNicknameLabel: 'Nickname',
        profileNicknameHint: 'Shown above messages and inside avatar text',
        profileNicknamePlaceholder: 'Enter a nickname you like',
        profileKeyLabel: 'Encryption key',
        profileKeyHint:
            'Used only locally. Only users with the same key can decrypt each other’s messages.',
        profileKeyPlaceholder: 'Set an encryption key for this profile',
        profileCancel: 'Cancel',
        profileSave: 'Save',
        profileAddTitle: 'Create new profile',
        profileColorLabel: 'Profile color',
        profileColorHint: 'Used for avatar and your own message bubbles',
        profileColorPlaceholder: '#4F46E5',
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
    const msgColor =
        typeof msg.color === 'string' && /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(msg.color)
            ? msg.color
            : null;
    if (!userColors[msg.userId]) {
        userColors[msg.userId] = msgColor || getRandomColor();
    }
    avatarDiv.style.backgroundColor = msgColor || userColors[msg.userId];
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

    // 如果消息携带身份颜色，则对自己消息的气泡应用该颜色
    if (msgColor && isMine) {
        contentDiv.style.backgroundColor = msgColor;
        // 简单对比度处理：根据亮度决定文字颜色
        const hex = msgColor.replace('#', '');
        const num = parseInt(hex.length === 3 ? hex.split('').map((c) => c + c).join('') : hex, 16);
        const r = (num >> 16) & 255;
        const g = (num >> 8) & 255;
        const b = num & 255;
        const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
        if (luminance < 0.6) {
            contentDiv.style.color = '#fff';
        } else {
            contentDiv.style.color = '#111827';
        }
    }

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
            color: myColor,
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
            color: myColor,
        });
    } catch (err) {
        showToast(err.message || t('toastImageFailed'), 'error');
    } finally {
        label.title = originalTitle;
        label.style.pointerEvents = '';
    }
});

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

// 初始化应用状态（主题、语言、身份、弹窗）
function initAppState() {
    loadProfiles();

    // 没有任何身份时，创建一个默认访客身份
    const profileIds = Object.keys(profiles);
    if (profileIds.length === 0) {
        profiles['1'] = { nickname: '访客', encryptionKey: '', color: '#4F46E5' };
    }
    currentProfileId = profileIds[0] || '1';

    // 渲染身份下拉选项
    if (profileSelect) {
        const renderProfiles = () => {
            profileSelect.innerHTML = '';
            Object.entries(profiles).forEach(([id, p]) => {
                const opt = document.createElement('option');
                opt.value = id;
                opt.textContent = p.nickname || `访客 ${id}`;
                profileSelect.appendChild(opt);
            });
            profileSelect.value = currentProfileId;
        };
        renderProfiles();

        profileSelect.addEventListener('change', (e) => {
            const newId = e.target.value || currentProfileId;
            if (!profiles[newId]) return;
            currentProfileId = newId;
            const p = profiles[currentProfileId];
            myNickname = p.nickname || `访客 ${currentProfileId}`;
            encryptionKey = p.encryptionKey || '';
            myColor = p.color || '#4F46E5';
        });
    }

    // 使用当前 profile 初始化昵称、密钥、颜色
    const profile = profiles[currentProfileId] || profiles['1'];
    myNickname = profile.nickname || myNickname;
    encryptionKey = profile.encryptionKey || encryptionKey;
    myColor = profile.color || myColor;

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

    // 自动高度文本域
    document.querySelectorAll('textarea[data-autoresize="true"]').forEach((el) => {
        const resize = () => {
            el.style.height = 'auto';
            el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
        };
        el.addEventListener('input', resize);
        resize();
    });

    // 弹窗相关事件
    if (profileEditBtn && profileModal && profileForm) {
        const openModal = () => {
            const p = profiles[currentProfileId] || { nickname: '', encryptionKey: '' };
            if (profileNicknameInput) {
                profileNicknameInput.value = p.nickname || '';
                profileNicknameInput.dispatchEvent(new Event('input'));
            }
            if (profileKeyInput) {
                profileKeyInput.value = p.encryptionKey || '';
                profileKeyInput.dispatchEvent(new Event('input'));
            }
            if (profileColorInput && profileColorPicker) {
                const color = p.color || '#4F46E5';
                profileColorInput.value = color;
                profileColorPicker.value = color;
            }
            profileModal.classList.add('active');
            profileModal.setAttribute('aria-hidden', 'false');
        };

        const closeModal = () => {
            profileModal.classList.remove('active');
            profileModal.setAttribute('aria-hidden', 'true');
        };

        profileEditBtn.addEventListener('click', openModal);

        if (profileAddBtn) {
            profileAddBtn.addEventListener('click', () => {
                // 创建新身份 id
                const ids = Object.keys(profiles).map((id) => Number(id)).filter((n) => !Number.isNaN(n));
                const nextId = (ids.length ? Math.max(...ids) + 1 : 1).toString();
                const baseColor = getRandomColor();
                profiles[nextId] = {
                    nickname: `访客 ${nextId}`,
                    encryptionKey: '',
                    color: baseColor,
                };
                saveProfiles();
                currentProfileId = nextId;
                myNickname = profiles[nextId].nickname;
                encryptionKey = '';
                myColor = baseColor;

                if (profileSelect) {
                    const opt = document.createElement('option');
                    opt.value = nextId;
                    opt.textContent = profiles[nextId].nickname;
                    profileSelect.appendChild(opt);
                    profileSelect.value = nextId;
                }

                openModal();
            });
        }

        if (profileModalClose) {
            profileModalClose.addEventListener('click', closeModal);
        }
        if (profileModalCancel) {
            profileModalCancel.addEventListener('click', (e) => {
                e.preventDefault();
                closeModal();
            });
        }
        profileModal.addEventListener('click', (e) => {
            if (e.target === profileModal) {
                closeModal();
            }
        });
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && profileModal.classList.contains('active')) {
                closeModal();
            }
        });

        profileForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const nickname = (profileNicknameInput && profileNicknameInput.value.trim()) || '';
            const key = (profileKeyInput && profileKeyInput.value) || '';
            let color = (profileColorInput && profileColorInput.value.trim()) || '#4F46E5';
            if (!/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(color)) {
                color = '#4F46E5';
            }
            if (profiles[currentProfileId]) {
                profiles[currentProfileId].nickname = nickname || `访客 ${currentProfileId}`;
                profiles[currentProfileId].encryptionKey = key;
                profiles[currentProfileId].color = color;
                saveProfiles();
            }
            myNickname = nickname || `访客 ${currentProfileId}`;
            encryptionKey = key;
            myColor = color;
            closeModal();
            showToast(t('toastKeySet'), 'success');
        });
    }
}

document.addEventListener('DOMContentLoaded', initAppState);
