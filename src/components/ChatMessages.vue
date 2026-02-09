<template>
  <div class="chat-messages" ref="messagesEl">
    <div
      v-for="m in messages"
      :key="m.id"
      class="message"
      :class="{ mine: m.userId === myId, others: m.userId !== myId }"
    >
      <div
        class="avatar"
        :style="{ backgroundColor: m.color || getColorForUser(m.userId) }"
      >
        {{ getAvatarText(m) }}
      </div>
      <div class="message-body">
        <span v-if="m.nickname" class="message-nickname">
          {{ m.nickname }}
        </span>
        <div
          class="message-content"
          :style="bubbleStyle(m)"
        >
          <template v-if="m.decryptedContent">
            <img
              v-if="m.type === 'image'"
              class="message-image"
              :src="m.decryptedContent"
            />
            <p
              v-else
              class="message-text"
            >
              {{ m.decryptedContent }}
            </p>
          </template>
          <p v-else class="message-text encrypted">
            (Encrypted message)
          </p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
const props = defineProps({
  messages: {
    type: Array,
    required: true,
  },
  myId: {
    type: String,
    required: true,
  },
  getAvatarText: {
    type: Function,
    required: true,
  },
  bubbleStyle: {
    type: Function,
    required: true,
  },
  getColorForUser: {
    type: Function,
    required: true,
  },
});
</script>

