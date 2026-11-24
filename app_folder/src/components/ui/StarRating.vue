<script setup lang="ts">
import { ref } from "vue";

withDefaults(
  defineProps<{
    modelValue: number;
    size?: number;
    readonly?: boolean;
    showLabel?: boolean;
  }>(),
  {
    size: 15,
    readonly: false,
    showLabel: true,
  },
);

const emit = defineEmits<{ "update:modelValue": [value: number] }>();
const hover = ref(0);
</script>

<template>
  <div class="star-row" :class="{ 'is-readonly': readonly }">
    <button
      v-for="i in 5"
      :key="i"
      type="button"
      :disabled="readonly"
      :aria-label="`Set strength ${i} of 5`"
      class="star-btn"
      @click="!readonly && emit('update:modelValue', i)"
      @mouseenter="!readonly && (hover = i)"
      @mouseleave="hover = 0"
    >
      <svg :width="size" :height="size" viewBox="0 0 14 14" fill="none" aria-hidden="true">
        <path
          d="M7 1.5L8.545 5.28L12.5 5.635L9.625 8.155L10.545 12.05L7 9.965L3.455 12.05L4.375 8.155L1.5 5.635L5.455 5.28L7 1.5Z"
          :fill="i <= (hover || modelValue) ? 'var(--star)' : 'none'"
          :stroke="i <= (hover || modelValue) ? 'var(--star)' : 'var(--border-strong)'"
          stroke-width="1.2"
          stroke-linejoin="round"
        />
      </svg>
    </button>
    <span v-if="showLabel" class="star-label tabular">{{ modelValue }}/5</span>
  </div>
</template>

<style scoped>
.star-row {
  display: inline-flex;
  align-items: center;
  gap: 2px;
}

.star-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 2px;
  border: none;
  border-radius: 3px;
  background: transparent;
  cursor: pointer;
  transition: transform var(--ease-fast);
}

.star-row.is-readonly .star-btn {
  cursor: default;
}

.star-btn:not(:disabled):hover {
  transform: scale(1.1);
}

.star-label {
  margin-left: 5px;
  font-size: 11.5px;
  font-weight: 500;
  color: var(--text-muted);
}
</style>
