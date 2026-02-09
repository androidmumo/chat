<template>
  <div class="chat-header">
    <div class="chat-header-main">
      <div class="chat-header-left">
        <h1>{{ t('title') }}</h1>
        <span class="chat-subtitle">{{ t('subtitle') }}</span>
      </div>
      <div class="chat-header-right">
        <div class="chat-control-group">
          <!-- 身份 -->
          <div class="control-item">
            <span class="control-label">{{ t('profileLabel') }}</span>
            <div class="control-inline">
              <el-select
                ref="profileSelect"
                v-model="localProfileId"
                class="control-select"
                size="small"
                @change="onProfileChange"
              >
                <el-option
                  v-for="p in profiles"
                  :key="p.id"
                  :label="p.nickname"
                  :value="p.id"
                />
                <template #footer>
                  <div style="padding: 8px; border-top: 1px solid var(--glass-border-subtle); display: flex; gap: 6px;">
                    <el-button
                      size="small"
                      type="primary"
                      text
                      style="flex: 1;"
                      :title="t('profileAddTitle')"
                      @click="handleCreateProfile"
                    >
                      <fa icon="user-plus" style="margin-right: 4px;" />
                      {{ t('profileAddTitle') }}
                    </el-button>
                    <el-button
                      size="small"
                      text
                      style="flex: 1;"
                      :title="t('profileEditTitle')"
                      @click="handleEditProfile"
                    >
                      <fa icon="user-pen" style="margin-right: 4px;" />
                      {{ t('profileEditTitle') }}
                    </el-button>
                  </div>
                </template>
              </el-select>
            </div>
          </div>

          <!-- 主题 -->
          <div class="control-item">
            <span class="control-label">{{ t('themeLabel') }}</span>
            <el-select
              v-model="localTheme"
              class="control-select"
              size="small"
              @change="(val) => $emit('update:themeMode', val)"
            >
              <el-option :label="t('themeAuto')" value="auto" />
              <el-option :label="t('themeLight')" value="light" />
              <el-option :label="t('themeDark')" value="dark" />
            </el-select>
          </div>

          <!-- 语言 -->
          <div class="control-item">
            <span class="control-label">{{ t('langLabel') }}</span>
            <el-select
              v-model="localLang"
              class="control-select"
              size="small"
              @change="(val) => $emit('update:lang', val)"
            >
              <el-option :label="t('langZh')" value="zh-CN" />
              <el-option :label="t('langEn')" value="en" />
            </el-select>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue';

const props = defineProps({
  profiles: {
    type: Array,
    required: true,
  },
  currentProfileId: {
    type: [String, null],
    default: null,
  },
  themeMode: {
    type: String,
    required: true,
  },
  lang: {
    type: String,
    required: true,
  },
  t: {
    type: Function,
    required: true,
  },
});

const emit = defineEmits([
  'update:currentProfileId',
  'update:themeMode',
  'update:lang',
  'create-profile',
  'edit-profile',
]);

const localProfileId = ref(props.currentProfileId);
const localTheme = ref(props.themeMode);
const localLang = ref(props.lang);
const profileSelect = ref(null);

watch(
  () => props.currentProfileId,
  (val) => {
    localProfileId.value = val;
  },
);

watch(
  () => props.themeMode,
  (val) => {
    localTheme.value = val;
  },
);

watch(
  () => props.lang,
  (val) => {
    localLang.value = val;
  },
);

function onProfileChange(val) {
  emit('update:currentProfileId', val);
}

function handleCreateProfile() {
  profileSelect.value?.blur();
  emit('create-profile');
}

function handleEditProfile() {
  profileSelect.value?.blur();
  emit('edit-profile');
}
</script>

