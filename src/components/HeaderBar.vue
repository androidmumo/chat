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
              </el-select>
              <el-button
                circle
                size="small"
                class="control-icon-button"
                :title="t('profileAddTitle')"
                @click="$emit('create-profile')"
              >
                <fa icon="user-plus" />
              </el-button>
              <el-button
                circle
                size="small"
                class="control-icon-button"
                :title="t('profileEditTitle')"
                @click="$emit('edit-profile')"
              >
                <fa icon="user-pen" />
              </el-button>
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
</script>

