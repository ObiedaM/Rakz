<script setup lang="ts">
// Accessible two-step arm → confirm control (Invariant #3: zero native confirm()).
// Supports auto-disarm timeout, Escape cancellation, timer cleanup, and zero layout shift.

import { onBeforeUnmount, onMounted, ref } from "vue";
import Icon from "@/components/ui/Icon.vue";

const props = withDefaults(
  defineProps<{
    label?: string;
    confirmLabel?: string;
    timeoutMs?: number;
    disabled?: boolean;
    compact?: boolean;
  }>(),
  {
    label: "Delete",
    confirmLabel: "Confirm?",
    timeoutMs: 3200,
    disabled: false,
    compact: false,
  },
);

const emit = defineEmits<{ confirm: [] }>();

const armed = ref(false);
let timer: ReturnType<typeof setTimeout> | null = null;

function disarm(): void {
  armed.value = false;
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
}

function onClick(): void {
  if (props.disabled) return;
  if (!armed.value) {
    armed.value = true;
    if (timer) clearTimeout(timer);
    timer = setTimeout(disarm, props.timeoutMs);
    return;
  }
  disarm();
  emit("confirm");
}

function onKey(e: KeyboardEvent): void {
  if (e.key === "Escape" && armed.value) {
    e.stopPropagation();
    disarm();
  }
}

onMounted(() => window.addEventListener("keydown", onKey));
onBeforeUnmount(() => {
  disarm();
  window.removeEventListener("keydown", onKey);
});
</script>

<template>
  <button
    type="button"
    :disabled="disabled"
    :aria-pressed="armed"
    :title="armed ? 'Click again to confirm, or press Esc to cancel' : label"
    class="confirm-btn"
    :class="{ 'is-armed': armed, 'is-compact': compact }"
    @click.stop="onClick"
  >
    <Icon :name="armed ? 'alert' : 'trash'" :size="13" />
    <span>{{ armed ? confirmLabel : label }}</span>
    <span v-if="armed" class="esc-hint">Esc</span>
  </button>
</template>

<style scoped>
.confirm-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  height: 28px;
  min-width: 86px;
  padding: 0 10px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border-default);
  background-color: transparent;
  color: var(--text-secondary);
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  user-select: none;
  transition: background-color var(--ease-fast), border-color var(--ease-fast), color var(--ease-fast);
}

.confirm-btn.is-compact {
  height: 26px;
  min-width: 78px;
  padding: 0 8px;
  font-size: 11.5px;
}

.confirm-btn:hover:not(:disabled):not(.is-armed) {
  border-color: var(--danger-border);
  background-color: var(--danger-subtle);
  color: var(--danger);
}

.confirm-btn.is-armed {
  border-color: var(--danger);
  background-color: var(--danger-solid);
  color: var(--danger-fg);
  font-weight: 600;
}

.esc-hint {
  font-family: var(--font-mono);
  font-size: 9.5px;
  padding: 1px 4px;
  border-radius: 3px;
  background-color: rgba(0, 0, 0, 0.24);
  color: var(--danger-fg);
  opacity: 0.9;
}
</style>
