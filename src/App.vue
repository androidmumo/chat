<template>
  <div class="chat-container">
    <HeaderBar
      :profiles="profilesList"
      :current-profile-id="currentProfileId"
      :theme-mode="themeMode"
      :lang="lang"
      :t="t"
      @update:currentProfileId="(id) => (currentProfileId = id)"
      @update:themeMode="(val) => (themeMode = val)"
      @update:lang="(val) => (lang = val)"
      @create-profile="createProfile"
      @edit-profile="openProfileModal"
    />

    <ChatMessages
      :messages="messages"
      :my-id="myId"
      :get-avatar-text="getAvatarText"
      :bubble-style="bubbleStyle"
      :get-color-for-user="getColorForUser"
    />

    <ChatInput
      v-model="textInput"
      :t="t"
      @send-text="sendTextFromChild"
      @send-image="sendImageFromChild"
    />

    <ProfileDialog
      v-if="currentProfile"
      v-model:visible="profileModalVisible"
      :profile="currentProfile"
      :profiles-count="profilesList.length"
      :t="t"
      @save="saveProfileFromChild"
      @delete="deleteCurrentProfile"
    />
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue';
import { io } from 'socket.io-client';
import CryptoJS from 'crypto-js';
import { ElMessage } from 'element-plus';

import HeaderBar from './components/HeaderBar.vue';
import ChatMessages from './components/ChatMessages.vue';
import ChatInput from './components/ChatInput.vue';
import ProfileDialog from './components/ProfileDialog.vue';

const MSG_TYPE_TEXT = 'text';
const MSG_TYPE_IMAGE = 'image';

const THEME_KEY = 'securechat_theme';
const LANG_KEY = 'securechat_lang';
const PROFILES_KEY = 'securechat_profiles';

const THEME_AUTO = 'auto';
const THEME_LIGHT = 'light';
const THEME_DARK = 'dark';

const i18n = {
  'zh-CN': {
    title: 'Secure Chat',
    subtitle: '轻量级端到端加密聊天室',
    profileLabel: '身份',
    themeLabel: '主题',
    themeAuto: '跟随系统',
    themeLight: '浅色',
    themeDark: '深色',
    langLabel: '语言',
    langZh: '中文',
    langEn: 'English',
    inputPlaceholder: '输入消息...',
    sendImageTitle: '发送图片',
    sendTextTitle: '发送',
    toastKeySet: '加密密钥已设置',
    toastSelectImage: '请选择图片文件',
    toastImageTooLarge: (sizeMb) => `图片不能超过 ${sizeMb}MB`,
    toastImageFailed: '图片处理失败',
    toastErrorFallback: '操作失败',
    profileAddTitle: '创建新身份',
    profileEditTitle: '编辑当前身份',
    profileModalTitle: '编辑身份',
    profileModalSubtitle: '为当前身份设置昵称与加密密钥，只保存在本地浏览器',
    profileNicknameLabel: '昵称',
    profileNicknameHint: '会显示在消息上方和头像文字中',
    profileKeyLabel: '加密密钥',
    profileKeyHint: '仅本地使用，不会上传服务器；同一个密钥的用户之间才能互相解密',
    profileColorLabel: '身份颜色',
    profileColorHint: '用于头像和自己消息的气泡颜色',
    profileCancel: '取消',
    profileSave: '保存',
    profileDelete: '删除身份',
  },
  en: {
    title: 'Secure Chat',
    subtitle: 'Lightweight end-to-end encrypted chat',
    profileLabel: 'Profile',
    themeLabel: 'Theme',
    themeAuto: 'Auto',
    themeLight: 'Light',
    themeDark: 'Dark',
    langLabel: 'Language',
    langZh: '中文',
    langEn: 'English',
    inputPlaceholder: 'Type a message...',
    sendImageTitle: 'Send image',
    sendTextTitle: 'Send',
    toastKeySet: 'Encryption key set',
    toastSelectImage: 'Please select an image file',
    toastImageTooLarge: (sizeMb) => `Image must be <= ${sizeMb}MB`,
    toastImageFailed: 'Image processing failed',
    toastErrorFallback: 'Operation failed',
    profileAddTitle: 'Create new profile',
    profileEditTitle: 'Edit current profile',
    profileModalTitle: 'Edit profile',
    profileModalSubtitle: 'Configure nickname and encryption key for this profile. Stored only in this browser.',
    profileNicknameLabel: 'Nickname',
    profileNicknameHint: 'Shown above messages and inside avatar text',
    profileKeyLabel: 'Encryption key',
    profileKeyHint: 'Used only locally. Only users with the same key can decrypt each other’s messages.',
    profileColorLabel: 'Profile color',
    profileColorHint: 'Used for avatar and your own message bubbles',
    profileCancel: 'Cancel',
    profileSave: 'Save',
    profileDelete: 'Delete profile',
  },
};

const lang = ref('zh-CN');
const themeMode = ref(THEME_AUTO);

const profiles = reactive({});
const currentProfileId = ref(null);

const messages = ref([]);
const myId = ref('');
const textInput = ref('');

const profileModalVisible = ref(false);
const editingProfile = reactive({
  id: null,
  nickname: '',
  encryptionKey: '',
  color: '#4F46E5',
});

const toast = reactive({
  visible: false,
  message: '',
  type: 'info',
});

const messagesEl = ref(null);
const imageInputEl = ref(null);

let socket = null;

function t(key, ...args) {
  const dict = i18n[lang.value] || i18n['zh-CN'];
  const val = dict[key];
  if (typeof val === 'function') return val(...args);
  return val ?? key;
}

const profilesList = computed(() =>
  Object.values(profiles).sort((a, b) => Number(a.id) - Number(b.id)),
);

const currentProfile = computed(() => {
  if (!currentProfileId.value) return null;
  return profiles[currentProfileId.value] || null;
});

function showToast(message, type = 'info') {
  toast.message = message;
  toast.type = type;
  toast.visible = true;
  ElMessage({
    message,
    type: type === 'error' ? 'error' : type === 'success' ? 'success' : 'info',
    duration: 2500,
  });
  setTimeout(() => {
    toast.visible = false;
  }, 2500);
}

function getRandomColor() {
  const letters = '0123456789ABCDEF';
  let color = '#';
  for (let i = 0; i < 6; i += 1) {
    color += letters[Math.floor(Math.random() * 16)];
  }
  return color;
}

const userColors = reactive({});

function getColorForUser(userId) {
  if (!userColors[userId]) {
    userColors[userId] = getRandomColor();
  }
  return userColors[userId];
}

function getAvatarText(msg) {
  const displayName = msg.nickname && String(msg.nickname).trim();
  if (displayName) return displayName.slice(0, 2);
  return String(msg.userId).slice(0, 2).toUpperCase();
}

function bubbleStyle(msg) {
  const style = {};
  const isMine = msg.userId === myId.value;
  const color = msg.color;
  if (isMine && typeof color === 'string' && /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(color)) {
    style.backgroundColor = color;
    const hex = color.replace('#', '');
    const full = hex.length === 3 ? hex.split('').map((c) => c + c).join('') : hex;
    const num = parseInt(full, 16);
    const r = (num >> 16) & 255;
    const g = (num >> 8) & 255;
    const b = num & 255;
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    style.color = luminance < 0.6 ? '#fff' : '#111827';
  }
  return style;
}

function encryptMessage(message, key) {
  return CryptoJS.AES.encrypt(message, key).toString();
}

function decryptMessage(encrypted, key) {
  try {
    const bytes = CryptoJS.AES.decrypt(encrypted, key);
    return bytes.toString(CryptoJS.enc.Utf8);
  } catch (e) {
    return null;
  }
}

async function sendImageFromChild(file) {
  if (!file.type.startsWith('image/')) {
    showToast(t('toastSelectImage'), 'error');
    return;
  }
  const sizeMb = file.size / 1024 / 1024;
  if (sizeMb > 2) {
    showToast(t('toastImageTooLarge', 2), 'error');
    return;
  }
  const profile = currentProfile.value;
  if (!profile) return;
  try {
    const dataUrl = await compressImage(file);
    const encrypted = encryptMessage(dataUrl, profile.encryptionKey || '');
    socket.emit('chat message', {
      type: MSG_TYPE_IMAGE,
      content: encrypted,
      nickname: profile.nickname,
      color: profile.color,
    });
  } catch (err) {
    showToast(err.message || t('toastImageFailed'), 'error');
  }
}

function compressImage(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const canvas = document.createElement('canvas');
      const MAX_WIDTH = 800;
      let { width, height } = img;
      if (width > MAX_WIDTH) {
        height = (height * MAX_WIDTH) / width;
        width = MAX_WIDTH;
      }
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);
      try {
        const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
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

function sendTextFromChild(text) {
  const value = text.trim();
  if (!value) return;
  const profile = currentProfile.value;
  if (!profile) return;
  const encrypted = encryptMessage(value, profile.encryptionKey || '');
  socket.emit('chat message', {
    type: MSG_TYPE_TEXT,
    content: encrypted,
    nickname: profile.nickname,
    color: profile.color,
  });
}

function openProfileModal() {
  profileModalVisible.value = true;
}

function closeProfileModal() {
  profileModalVisible.value = false;
}

function saveProfileFromChild(payload) {
  const { id, nickname, encryptionKey, color } = payload;
  if (!id || !profiles[id]) return;
  const name = (nickname || '').trim() || `访客 ${id}`;
  let c = (color || '').trim() || '#4F46E5';
  if (!/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(c)) {
    c = '#4F46E5';
  }
  profiles[id].nickname = name;
  profiles[id].encryptionKey = encryptionKey || '';
  profiles[id].color = c;
  currentProfileId.value = id;
  persistProfiles();
  profileModalVisible.value = false;
  showToast(t('toastKeySet'), 'success');
}

function deleteCurrentProfile() {
  const id = currentProfileId.value;
  const list = profilesList.value;
  if (!id || list.length <= 1) return;
  delete profiles[id];
  const remaining = profilesList.value;
  currentProfileId.value = remaining[0].id;
  persistProfiles();
  closeProfileModal();
}

function createProfile() {
  const ids = Object.keys(profiles).map((id) => Number(id)).filter((n) => !Number.isNaN(n));
  const nextId = (ids.length ? Math.max(...ids) + 1 : 1).toString();
  const nickname = `访客 ${nextId}`;
  const color = getRandomColor();
  profiles[nextId] = {
    id: nextId,
    nickname,
    encryptionKey: '',
    color,
  };
  currentProfileId.value = nextId;
  persistProfiles();
  openProfileModal();
}

function persistProfiles() {
  const plain = {};
  Object.values(profiles).forEach((p) => {
    plain[p.id] = {
      nickname: p.nickname,
      encryptionKey: p.encryptionKey,
      color: p.color,
    };
  });
  localStorage.setItem(PROFILES_KEY, JSON.stringify(plain));
}

function loadProfiles() {
  const saved = localStorage.getItem(PROFILES_KEY);
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      Object.keys(parsed).forEach((id) => {
        const p = parsed[id];
        profiles[id] = {
          id,
          nickname: p.nickname || `访客 ${id}`,
          encryptionKey: p.encryptionKey || '',
          color: p.color || getRandomColor(),
        };
      });
    } catch (e) {
      // ignore
    }
  }
  if (Object.keys(profiles).length === 0) {
    profiles['1'] = {
      id: '1',
      nickname: '访客',
      encryptionKey: '',
      color: '#4F46E5',
    };
  }
  currentProfileId.value = Object.keys(profiles)[0];
}

function applyTheme() {
  const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)');
  let effective = themeMode.value;
  if (themeMode.value === THEME_AUTO) {
    effective = prefersDark && prefersDark.matches ? THEME_DARK : THEME_LIGHT;
  }
  document.documentElement.setAttribute('data-theme', effective);
}

onMounted(() => {
  // 语言
  const savedLang = localStorage.getItem(LANG_KEY);
  if (savedLang && i18n[savedLang]) {
    lang.value = savedLang;
  } else {
    const browserLang = navigator.language || navigator.userLanguage;
    lang.value = browserLang.startsWith('zh') ? 'zh-CN' : 'en';
  }

  // 主题
  const savedTheme = localStorage.getItem(THEME_KEY);
  if ([THEME_AUTO, THEME_LIGHT, THEME_DARK].includes(savedTheme)) {
    themeMode.value = savedTheme;
  } else {
    themeMode.value = THEME_AUTO;
  }
  applyTheme();

  const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)');
  if (prefersDark && prefersDark.addEventListener) {
    prefersDark.addEventListener('change', () => {
      if (themeMode.value === THEME_AUTO) applyTheme();
    });
  }

  loadProfiles();

  socket = io();
  socket.on('connect', () => {
    myId.value = socket.id;
  });

  socket.on('chat message', (msg) => {
    const profileKey = currentProfile.value?.encryptionKey || '';
    const decryptedContent = decryptMessage(msg.content, profileKey);
    messages.value.push({
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      type: msg.type,
      content: msg.content,
      decryptedContent,
      userId: msg.userId,
      nickname: msg.nickname,
      color: msg.color,
    });
    nextTickScroll();
  });

  socket.on('error', (payload) => {
    showToast(payload?.message || t('toastErrorFallback'), 'error');
  });
});

onBeforeUnmount(() => {
  if (socket) socket.close();
});

watch(lang, (val) => {
  localStorage.setItem(LANG_KEY, val);
  document.documentElement.lang = val;
});

watch(themeMode, (val) => {
  localStorage.setItem(THEME_KEY, val);
  applyTheme();
});

function nextTickScroll() {
  requestAnimationFrame(() => {
    if (messagesEl.value) {
      messagesEl.value.scrollTop = messagesEl.value.scrollHeight;
    }
  });
}
</script>

