<template>
  <el-dialog
    v-model="localVisible"
    :title="t('profileModalTitle')"
    width="480px"
    :close-on-click-modal="true"
    :close-on-press-escape="true"
    @close="onClose"
  >
    <p class="modal-subtitle" style="margin-bottom: 12px;">
      {{ t('profileModalSubtitle') }}
    </p>

    <el-form label-width="72px" class="profile-form">
      <el-form-item :label="t('profileNicknameLabel')">
        <el-input
          v-model="localProfile.nickname"
          :placeholder="t('profileNicknameHint')"
          clearable
        >
          <template #prefix>
            <fa icon="user" />
          </template>
        </el-input>
      </el-form-item>

      <el-form-item :label="t('profileKeyLabel')">
        <el-input
          v-model="localProfile.encryptionKey"
          type="textarea"
          :autosize="{ minRows: 1, maxRows: 4 }"
          :placeholder="t('profileKeyHint')"
        />
      </el-form-item>

      <el-form-item :label="t('profileColorLabel')">
        <div style="display:flex;align-items:center;gap:8px;width:100%;">
          <el-color-picker v-model="localProfile.color" />
          <el-input
            v-model="localProfile.color"
            style="flex:1;"
            :placeholder="t('profileColorHint')"
          />
        </div>
      </el-form-item>
    </el-form>

    <template #footer>
      <div style="display:flex;justify-content:flex-end;gap:8px;">
        <el-button
          v-if="profilesCount > 1"
          type="danger"
          text
          @click="$emit('delete')"
        >
          {{ t('profileDelete') }}
        </el-button>
        <el-button @click="close">
          {{ t('profileCancel') }}
        </el-button>
        <el-button type="primary" @click="save">
          {{ t('profileSave') }}
        </el-button>
      </div>
    </template>
  </el-dialog>
</template>

<script setup>
import { reactive, watch, ref } from 'vue';

const props = defineProps({
  visible: {
    type: Boolean,
    default: false,
  },
  profile: {
    type: Object,
    required: true,
  },
  profilesCount: {
    type: Number,
    required: true,
  },
  t: {
    type: Function,
    required: true,
  },
});

const emit = defineEmits(['update:visible', 'save', 'delete']);

const localVisible = ref(props.visible);
const localProfile = reactive({
  id: props.profile.id,
  nickname: props.profile.nickname,
  encryptionKey: props.profile.encryptionKey,
  color: props.profile.color,
});

watch(
  () => props.visible,
  (val) => {
    localVisible.value = val;
    if (val) {
      localProfile.id = props.profile.id;
      localProfile.nickname = props.profile.nickname;
      localProfile.encryptionKey = props.profile.encryptionKey;
      localProfile.color = props.profile.color;
    }
  },
);

function onClose() {
  emit('update:visible', false);
}

function close() {
  localVisible.value = false;
  emit('update:visible', false);
}

function save() {
  emit('save', { ...localProfile });
}
</script>

