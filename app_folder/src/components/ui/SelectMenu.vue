<script setup lang="ts">
// Custom desktop dropdown menu — guarantees identical crisp Dark & Paper Light
// rendering across every Windows 11 WebView2 build with zero native <select> chrome quirks.

import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import Icon from "@/components/ui/Icon.vue";

export interface SelectOption {
  id: string;
  label: string;
}

const props = withDefaults(
  defineProps<{
    modelValue: string;
    options: SelectOption[];
    ariaLabel?: string;
    align?: "left" | "right";
  }>(),
  { align: "right" },
);

const emit = defineEmits<{ "update:modelValue": [value: string] }>();

const open = ref(false);
const rootEl = ref<HTMLDivElement | null>(null);

const currentLabel = computed(
  () => props.options.find((o) => o.id === props.modelValue)?.label ?? props.options[0]?.label ?? "",
);

function pick(id: string): void {
  emit("update:modelValue", id);
  open.value = false;
}

function onDocClick(e: MouseEvent): void {
  if (open.value && rootEl.value && !rootEl.value.contains(e.target as Node)) {
    open.value = false;
  }
}

function onKey(e: KeyboardEvent): void {
  if (e.key === "Escape" && open.value) {
    e.stopPropagation();
    open.value = false;
  }
}

onMounted(() => {
  document.addEventListener("mousedown", onDocClick);
  window.addEventListener("keydown", onKey);
});

onBeforeUnmount(() => {
  document.removeEventListener("mousedown", onDocClick);
  window.removeEventListener("keydown", onKey);
});
</script>

<template>
  <div ref="rootEl" class="sel-root select-none">
    <button
      type="button"
      class="sel-trigger"
      :aria-label="ariaLabel"
      aria-haspopup="listbox"
      :aria-expanded="open"
      @click="open = !open"
    >
      <span class="sel-label">{{ currentLabel }}</span>
      <Icon name="chevron-down" :size="12" class="sel-chev" :class="{ 'is-open': open }" />
    </button>

    <div v-if="open" role="listbox" class="sel-menu" :class="`is-${align}`">
      <button
        v-for="opt in options"
        :key="opt.id"
        type="button"
        role="option"
        :aria-selected="opt.id === modelValue"
        class="sel-opt"
        :class="{ 'is-selected': opt.id === modelValue }"
        @click="pick(opt.id)"
      >
        <span class="truncate">{{ opt.label }}</span>
        <Icon v-if="opt.id === modelValue" name="check" :size="12" class="sel-check" />
      </button>
    </div>
  </div>
</template>

<style scoped>
.sel-root {
  position: relative;
  display: inline-flex;
  flex-shrink: 0;
}

.sel-trigger {
  display: inline-flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  height: 28px;
  min-width: 92px;
  padding: 0 8px 0 10px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border-default);
  background-color: var(--bg-input);
  color: var(--text-primary);
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  white-space: nowrap;
  transition: border-color var(--ease-fast), background-color var(--ease-fast);
}

.sel-trigger:hover {
  border-color: var(--border-strong);
  background-color: var(--bg-hover);
}

.sel-chev {
  color: var(--text-muted);
  transition: transform var(--ease-fast);
}

.sel-chev.is-open {
  transform: rotate(180deg);
}

.sel-menu {
  position: absolute;
  top: calc(100% + 4px);
  z-index: 400;
  min-width: 148px;
  padding: 4px;
  border-radius: var(--radius-md);
  border: 1px solid var(--border-default);
  background-color: var(--bg-overlay);
  box-shadow: var(--shadow-md);
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.sel-menu.is-right {
  right: 0;
}

.sel-menu.is-left {
  left: 0;
}

.sel-opt {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  width: 100%;
  height: 28px;
  padding: 0 8px;
  border: none;
  border-radius: var(--radius-xs);
  background: transparent;
  color: var(--text-secondary);
  font-size: 12px;
  text-align: left;
  cursor: pointer;
  transition: background-color var(--ease-fast), color var(--ease-fast);
}

.sel-opt:hover {
  background-color: var(--bg-hover);
  color: var(--text-primary);
}

.sel-opt.is-selected {
  color: var(--text-primary);
  font-weight: 600;
  background-color: var(--accent-subtle);
}

.sel-check {
  color: var(--accent);
  flex-shrink: 0;
}
</style>
