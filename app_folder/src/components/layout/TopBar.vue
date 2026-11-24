<script setup lang="ts">
// Primary workspace toolbar — crisp, non-overlapping single row across all desktop widths.

import { computed } from "vue";
import { useLibrary } from "@/composables/library";
import Icon from "@/components/ui/Icon.vue";
import SelectMenu from "@/components/ui/SelectMenu.vue";

const SORTS = [
  { id: "recent", label: "Recent" },
  { id: "importance", label: "Strength" },
  { id: "linked", label: "Most Linked" },
];

const VIEWS = [
  { id: "stack", label: "Stack", icon: "stack" as const, shortcut: "Ctrl+1" },
  { id: "study", label: "Study", icon: "study" as const, shortcut: "Ctrl+2" },
  { id: "grid", label: "Grid", icon: "grid" as const, shortcut: "Ctrl+3" },
  { id: "graph", label: "Graph", icon: "graph" as const, shortcut: "Ctrl+4" },
];

const props = defineProps<{
  view: "stack" | "study" | "grid" | "graph";
  sort: string;
  filterTag: string;
  zen: boolean;
  rightOpen: boolean;
}>();

const emit = defineEmits<{
  "update:view": [view: "stack" | "study" | "grid" | "graph"];
  "update:sort": [sort: string];
  "update:filterTag": [tag: string];
  "update:zen": [zen: boolean];
  "update:rightOpen": [open: boolean];
}>();

const { studyStats, activeLinks, activeBacklinks } = useLibrary();

const totalCardConnections = computed(() => activeLinks.value.length + activeBacklinks.value.length);
const showListControls = computed(() => props.view === "stack" || props.view === "grid" || props.view === "graph");
</script>

<template>
  <header class="topbar select-none">
    <!-- Left: Primary Mode Switcher -->
    <nav class="mode-group" aria-label="Workspace view">
      <button
        v-for="item in VIEWS"
        :key="item.id"
        type="button"
        class="mode-btn"
        :class="{ 'is-active': view === item.id }"
        :title="`${item.label} (${item.shortcut})`"
        @click="emit('update:view', item.id as 'stack' | 'study' | 'grid' | 'graph')"
      >
        <Icon :name="item.icon" :size="13" />
        <span class="mode-label">{{ item.label }}</span>
        <span
          v-if="item.id === 'study' && studyStats.dueCount > 0"
          class="due-pill tabular"
          :class="{ 'is-on-active': view === 'study' }"
        >
          {{ studyStats.dueCount }}
        </span>
      </button>
    </nav>

    <!-- Right: Tag Filter + Sort + Zen + Connections Toggle -->
    <div class="right-controls">
      <div v-if="showListControls" class="filter-wrap">
        <Icon name="search" :size="12" class="filter-icon" />
        <input
          :value="filterTag"
          placeholder="Filter #tag"
          aria-label="Filter by hashtag"
          class="filter-input font-mono-meta"
          @input="emit('update:filterTag', ($event.target as HTMLInputElement).value)"
        />
        <button
          v-if="filterTag"
          type="button"
          class="filter-clear"
          title="Clear tag filter"
          @click="emit('update:filterTag', '')"
        >
          <Icon name="x" :size="11" />
        </button>
      </div>

      <SelectMenu
        v-if="view === 'stack' || view === 'grid'"
        :model-value="sort"
        :options="SORTS"
        aria-label="Sort cards"
        @update:model-value="emit('update:sort', $event)"
      />

      <button
        type="button"
        class="tool-btn"
        :class="{ 'is-active': zen }"
        title="Zen focus mode (Ctrl+.)"
        @click="emit('update:zen', !zen)"
      >
        <Icon name="zen" :size="13" />
        <span class="zen-label">Zen</span>
      </button>

      <button
        v-if="!zen && view !== 'study'"
        type="button"
        class="tool-btn"
        :class="{ 'is-active': rightOpen }"
        :title="rightOpen ? 'Hide connections panel' : 'Show connections panel'"
        @click="emit('update:rightOpen', !rightOpen)"
      >
        <Icon name="bridge" :size="13" />
        <span v-if="totalCardConnections > 0" class="conn-count tabular">{{ totalCardConnections }}</span>
      </button>
    </div>
  </header>
</template>

<style scoped>
.topbar {
  container-type: inline-size;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  height: 46px;
  padding: 0 14px;
  background-color: var(--bg-root);
  border-bottom: 1px solid var(--border-subtle);
  flex-shrink: 0;
}

.mode-group {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  padding: 3px;
  border-radius: var(--radius-md);
  border: 1px solid var(--border-subtle);
  background-color: var(--bg-sidebar);
  flex-shrink: 0;
}

.mode-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  height: 26px;
  padding: 0 9px;
  border-radius: 5px;
  border: 1px solid transparent;
  background-color: transparent;
  color: var(--text-secondary);
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  white-space: nowrap;
  transition: background-color var(--ease-fast), color var(--ease-fast), border-color var(--ease-fast);
}

.mode-btn:hover:not(.is-active) {
  color: var(--text-primary);
  background-color: var(--bg-hover);
}

.mode-btn.is-active {
  background-color: var(--bg-surface);
  border-color: var(--border-default);
  color: var(--text-primary);
  font-weight: 600;
  box-shadow: var(--shadow-sm);
}

.due-pill {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 17px;
  height: 16px;
  padding: 0 5px;
  border-radius: 999px;
  background-color: var(--bridge-subtle);
  color: var(--bridge);
  font-size: 10px;
  font-weight: 700;
}

.due-pill.is-on-active {
  background-color: var(--bridge);
  color: #ffffff;
}

.right-controls {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 6px;
  flex: 1;
  min-width: 0;
}

.filter-wrap {
  position: relative;
  display: flex;
  align-items: center;
  flex: 0 1 180px;
  min-width: 96px;
}

.filter-icon {
  position: absolute;
  left: 9px;
  color: var(--text-muted);
  pointer-events: none;
}

.filter-input {
  width: 100%;
  height: 28px;
  padding: 0 22px 0 27px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border-subtle);
  background-color: var(--bg-input);
  color: var(--text-primary);
  font-size: 11.5px;
  transition: border-color var(--ease-fast), box-shadow var(--ease-fast);
}

.filter-input::placeholder {
  color: var(--text-muted);
}

.filter-clear {
  position: absolute;
  right: 4px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  border: none;
  border-radius: var(--radius-xs);
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
}

.filter-clear:hover {
  background-color: var(--bg-hover);
  color: var(--text-primary);
}

.tool-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  height: 28px;
  padding: 0 8px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border-subtle);
  background-color: transparent;
  color: var(--text-secondary);
  font-size: 11.5px;
  font-weight: 500;
  cursor: pointer;
  flex-shrink: 0;
  transition: background-color var(--ease-fast), border-color var(--ease-fast), color var(--ease-fast);
}

.tool-btn:hover {
  background-color: var(--bg-hover);
  border-color: var(--border-default);
  color: var(--text-primary);
}

.tool-btn.is-active {
  background-color: var(--accent-subtle);
  border-color: var(--accent-border);
  color: var(--accent);
  font-weight: 600;
}

.conn-count {
  font-size: 10.5px;
  font-weight: 700;
}

@container (max-width: 680px) {
  .zen-label {
    display: none;
  }
}

@container (max-width: 560px) {
  .filter-wrap {
    display: none;
  }
}
</style>
