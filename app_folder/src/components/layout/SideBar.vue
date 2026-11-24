<script setup lang="ts">
// Left vault navigation rail: RAKZ emblem + creation actions + search + tree + study trigger + settings.

import { nextTick, ref, watch } from "vue";
import TreeView from "@/components/tree/TreeView.vue";
import Dialog from "@/components/ui/Dialog.vue";
import Icon from "@/components/ui/Icon.vue";
import { useLibrary } from "@/composables/library";

defineProps<{ activeView?: string }>();

const emit = defineEmits<{
  "open-settings": [];
  "open-study": [];
  "select-card": [];
}>();

const query = ref("");
const { create, studyStats } = useLibrary();

const newOpen = ref(false);
const newSubject = ref("");
const newFolder = ref("");
const subjectInput = ref<HTMLInputElement | null>(null);

watch(newOpen, async (open) => {
  if (open) {
    await nextTick();
    subjectInput.value?.focus();
  }
});

function createCard(): void {
  create();
  emit("select-card");
}

function createSubject(): void {
  const s = newSubject.value.trim();
  if (!s) return;
  create(s, newFolder.value.trim());
  newOpen.value = false;
  newSubject.value = "";
  newFolder.value = "";
  emit("select-card");
}
</script>

<template>
  <aside class="sidebar select-none">
    <!-- Brand & Quick Actions -->
    <div class="sidebar-head">
      <div class="brand-row">
        <img src="/Image.svg" alt="" class="brand-logo" width="22" height="22" />
        <span class="brand-name">RAKZ</span>
        <span class="brand-ver font-mono-meta">v0.1</span>
      </div>

      <div class="action-row">
        <button
          type="button"
          class="rkz-btn rkz-btn-primary flex-1"
          title="Create new mnemonic (Ctrl+N)"
          @click="createCard"
        >
          <Icon name="plus" :size="14" />
          <span>New Mnemonic</span>
        </button>
        <button
          type="button"
          class="rkz-btn icon-only"
          title="New Subject or Folder…"
          aria-label="New Subject or Folder"
          @click="newOpen = true"
        >
          <Icon name="folder-plus" :size="15" />
        </button>
      </div>

      <!-- Search -->
      <div class="search-wrap">
        <Icon name="search" :size="13" class="search-icon" />
        <input
          id="rkz-search"
          v-model="query"
          dir="auto"
          placeholder="Search vault…"
          aria-label="Search mnemonics"
          class="rkz-input search-input"
          @keydown.esc="query = ''"
        />
        <button
          v-if="query"
          type="button"
          class="search-clear"
          title="Clear search"
          @click="query = ''"
        >
          <Icon name="x" :size="11" />
        </button>
        <kbd v-else class="rkz-kbd search-kbd">Ctrl K</kbd>
      </div>
    </div>

    <!-- Vault Explorer -->
    <div class="tree-scroll rkz-scroll">
      <TreeView :query="query" @clear-query="query = ''" @card-opened="emit('select-card')" />
    </div>

    <!-- Footer: Study queue trigger + Settings -->
    <div class="sidebar-foot">
      <button
        v-if="studyStats.dueCount > 0"
        type="button"
        class="study-banner"
        :class="{ 'is-active': activeView === 'study' }"
        title="Start Active Recall Review (Ctrl+2)"
        @click="emit('open-study')"
      >
        <Icon name="study" :size="14" />
        <span class="flex-1 text-left">Review due</span>
        <span class="study-count tabular">{{ studyStats.dueCount }}</span>
      </button>

      <button
        type="button"
        class="foot-btn"
        title="Settings (Ctrl+,)"
        @click="emit('open-settings')"
      >
        <Icon name="settings" :size="14" />
        <span class="flex-1 text-left">Settings</span>
        <kbd class="rkz-kbd">Ctrl ,</kbd>
      </button>
    </div>

    <!-- New Subject / Folder Dialog -->
    <Dialog :open="newOpen" width="420px" @close="newOpen = false">
      <div class="modal-body">
        <div class="modal-head">
          <h3 class="modal-title">New Subject or Folder</h3>
          <button type="button" class="close-btn" aria-label="Close" @click="newOpen = false">
            <Icon name="x" :size="14" />
          </button>
        </div>

        <label class="field">
          <span class="rkz-label">Subject Name</span>
          <input
            ref="subjectInput"
            v-model="newSubject"
            dir="auto"
            placeholder="e.g. Physics, Biology, الفيزياء"
            class="rkz-input field-input"
            @keydown.enter="createSubject"
          />
        </label>

        <label class="field">
          <span class="rkz-label">Folder Path (optional)</span>
          <input
            v-model="newFolder"
            placeholder="e.g. science/physics"
            class="rkz-input field-input font-mono-meta"
            @keydown.enter="createSubject"
          />
        </label>

        <p class="modal-hint">
          Creates the subject's first mnemonic card. Its <code class="font-mono-meta">.mns</code> file and folders are written locally on save.
        </p>

        <div class="modal-actions">
          <button type="button" class="rkz-btn" @click="newOpen = false">Cancel</button>
          <button
            type="button"
            class="rkz-btn rkz-btn-primary"
            :disabled="!newSubject.trim()"
            @click="createSubject"
          >
            Create Subject
          </button>
        </div>
      </div>
    </Dialog>
  </aside>
</template>

<style scoped>
.sidebar {
  display: flex;
  flex-direction: column;
  height: 100%;
  background-color: var(--bg-sidebar);
}

.sidebar-head {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 12px 12px 10px;
  border-bottom: 1px solid var(--border-subtle);
}

.brand-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 2px;
}

.brand-logo {
  border-radius: 5px;
  display: block;
}

.brand-name {
  font-size: 14px;
  font-weight: 700;
  letter-spacing: 0.14em;
  color: var(--text-primary);
}

.brand-ver {
  margin-left: auto;
  font-size: 10px;
  padding: 1px 6px;
  border-radius: var(--radius-xs);
  border: 1px solid var(--border-subtle);
  background-color: var(--bg-input);
  color: var(--text-muted);
}

.action-row {
  display: flex;
  align-items: center;
  gap: 6px;
}

.icon-only {
  width: 30px;
  padding: 0;
  flex-shrink: 0;
}

.search-wrap {
  position: relative;
  display: flex;
  align-items: center;
}

.search-icon {
  position: absolute;
  left: 9px;
  color: var(--text-muted);
  pointer-events: none;
}

.search-input {
  height: 30px;
  padding: 0 54px 0 28px;
  font-size: 12px;
}

.search-kbd {
  position: absolute;
  right: 5px;
  pointer-events: none;
}

.search-clear {
  position: absolute;
  right: 6px;
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

.search-clear:hover {
  background-color: var(--bg-hover);
  color: var(--text-primary);
}

.tree-scroll {
  flex: 1;
  overflow-y: auto;
  padding: 6px 0;
}

.sidebar-foot {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 8px 10px;
  border-top: 1px solid var(--border-subtle);
}

.study-banner {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  height: 32px;
  padding: 0 10px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--bridge-border);
  background-color: var(--bridge-subtle);
  color: var(--bridge);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: background-color var(--ease-fast), color var(--ease-fast);
}

.study-banner:hover,
.study-banner.is-active {
  background-color: var(--bridge);
  color: #ffffff;
}

.study-count {
  font-size: 11px;
  font-weight: 700;
}

.foot-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  height: 30px;
  padding: 0 8px;
  border: none;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--text-secondary);
  font-size: 12.5px;
  font-weight: 500;
  cursor: pointer;
  transition: background-color var(--ease-fast), color var(--ease-fast);
}

.foot-btn:hover {
  background-color: var(--bg-hover);
  color: var(--text-primary);
}

.modal-body {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 20px;
}

.modal-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.modal-title {
  margin: 0;
  font-size: 14.5px;
  font-weight: 600;
}

.close-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  border: none;
  border-radius: var(--radius-xs);
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
}

.close-btn:hover {
  background-color: var(--bg-hover);
  color: var(--text-primary);
}

.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.field-input {
  height: 34px;
  padding: 0 10px;
}

.modal-hint {
  margin: 0;
  font-size: 11.5px;
  color: var(--text-muted);
  line-height: 1.5;
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding-top: 4px;
}
</style>
