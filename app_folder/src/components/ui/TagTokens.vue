<script setup lang="ts">
// Hashtag token input. Tags shared with ANOTHER subject surface as warm
// terracotta bridge indicators instead of neon glow pills.

import { ref } from "vue";
import { useLibrary } from "@/composables/library";
import Icon from "@/components/ui/Icon.vue";

const props = withDefaults(
  defineProps<{
    modelValue: string[];
    activeSubjectId?: string;
  }>(),
  { activeSubjectId: "" },
);

const emit = defineEmits<{ "update:modelValue": [tags: string[]] }>();

const { memonics } = useLibrary();
const draft = ref("");

function isCross(t: string): boolean {
  return (
    !!props.activeSubjectId &&
    memonics.value.some(
      (m) => m.id !== props.activeSubjectId && m.tags.some((x) => x.toLowerCase() === t.toLowerCase()),
    )
  );
}

function add(raw: string): void {
  const clean = raw.trim().replace(/^#/, "").replace(/,/g, "");
  if (clean && !props.modelValue.some((x) => x.toLowerCase() === clean.toLowerCase())) {
    emit("update:modelValue", [...props.modelValue, clean]);
  }
  draft.value = "";
}

function remove(t: string): void {
  emit("update:modelValue", props.modelValue.filter((x) => x !== t));
}

function onKeydown(e: KeyboardEvent): void {
  if (e.key === "Enter" || e.key === ",") {
    e.preventDefault();
    add(draft.value);
  } else if (e.key === "Backspace" && !draft.value && props.modelValue.length) {
    remove(props.modelValue[props.modelValue.length - 1]!);
  }
}
</script>

<template>
  <div class="tag-well">
    <span
      v-for="t in modelValue"
      :key="t"
      class="tag-chip font-mono-meta"
      :class="{ 'is-bridge': isCross(t) }"
      :title="isCross(t) ? 'Shared across subjects — structural bridge tag' : `#${t}`"
    >
      <Icon v-if="isCross(t)" name="bridge" :size="11" />
      <span>#{{ t }}</span>
      <button
        type="button"
        title="Remove tag"
        aria-label="Remove tag"
        class="tag-remove"
        @click="remove(t)"
      >
        <Icon name="x" :size="10" />
      </button>
    </span>

    <input
      v-model="draft"
      :placeholder="modelValue.length ? 'Add tag…' : 'Type a #concept tag and press Enter…'"
      class="tag-input font-mono-meta"
      @keydown="onKeydown"
      @blur="draft && add(draft)"
    />
  </div>
</template>

<style scoped>
.tag-well {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  min-height: 38px;
  padding: 6px 10px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border-default);
  background-color: var(--bg-input);
  transition: border-color var(--ease-fast), box-shadow var(--ease-fast);
}

.tag-well:focus-within {
  border-color: var(--accent-border);
  box-shadow: 0 0 0 2px var(--accent-subtle);
}

.tag-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  height: 24px;
  padding: 0 4px 0 8px;
  border-radius: var(--radius-xs);
  border: 1px solid var(--border-default);
  background-color: var(--bg-surface);
  color: var(--text-primary);
  font-size: 12px;
  font-weight: 500;
}

.tag-chip.is-bridge {
  border-color: var(--bridge-border);
  background-color: var(--bridge-subtle);
  color: var(--bridge);
}

.tag-remove {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  border: none;
  border-radius: 3px;
  background: transparent;
  color: currentColor;
  opacity: 0.65;
  cursor: pointer;
  transition: opacity var(--ease-fast), background-color var(--ease-fast);
}

.tag-remove:hover {
  opacity: 1;
  background-color: var(--bg-hover);
}

.tag-input {
  flex: 1;
  min-width: 120px;
  height: 24px;
  border: none;
  background: transparent;
  color: var(--text-primary);
  font-size: 12px;
  outline: none;
}

.tag-input:focus-visible {
  box-shadow: none;
}

.tag-input::placeholder {
  color: var(--text-muted);
}
</style>
