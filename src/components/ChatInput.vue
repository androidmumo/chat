<template>
  <div class="chat-input-container">
    <div class="chat-input-wrapper">
      <el-input
        v-model="innerValue"
        :placeholder="t('inputPlaceholder')"
        size="large"
        type="textarea"
        :autosize="{ minRows: 1, maxRows: 4 }"
        @keydown.enter.exact.prevent="emitSend"
      />
      <div class="chat-input-actions">
        <el-button
          circle
          class="chat-input-icon-btn"
          :title="t('sendImageTitle')"
          @click="triggerImage"
          text
        >
          <fa icon="image" />
        </el-button>
        <el-button
          circle
          class="chat-input-icon-btn"
          :title="'发送附件'"
          @click="triggerAttachment"
          text
        >
          <fa icon="paperclip" />
        </el-button>
        <el-button
          circle
          class="chat-input-icon-btn chat-input-send-btn"
          type="primary"
          :title="t('sendTextTitle')"
          @click="emitSend"
        >
          <fa icon="paper-plane" />
        </el-button>
      </div>
    </div>
    <input
      ref="fileInput"
      type="file"
      accept="image/*"
      style="display: none"
      @change="onImageChange"
    />
    <input
      ref="attachmentFileInput"
      type="file"
      accept="*/*"
      style="display: none"
      @change="onAttachmentChange"
    />
  </div>
</template>

<script setup>
import { ref, watch } from 'vue';

const props = defineProps({
  modelValue: {
    type: String,
    default: '',
  },
  t: {
    type: Function,
    required: true,
  },
});

const emit = defineEmits(['update:modelValue', 'send-text', 'send-image', 'send-attachment']);

const innerValue = ref(props.modelValue);
const fileInput = ref(null);
const attachmentFileInput = ref(null);

watch(
  () => props.modelValue,
  (val) => {
    innerValue.value = val;
  },
);

watch(innerValue, (val) => {
  emit('update:modelValue', val);
});

function emitSend() {
  const text = innerValue.value.trim();
  if (!text) return;
  emit('send-text', text);
  innerValue.value = '';
}

function triggerImage() {
  if (fileInput.value) {
    fileInput.value.click();
  }
}

function triggerAttachment() {
  if (attachmentFileInput.value) {
    attachmentFileInput.value.click();
  }
}

function onImageChange(e) {
  const file = e.target.files?.[0];
  e.target.value = '';
  if (!file) return;
  emit('send-image', file);
}

function onAttachmentChange(e) {
  const file = e.target.files?.[0];
  e.target.value = '';
  if (!file) return;
  emit('send-attachment', file);
}
</script>

