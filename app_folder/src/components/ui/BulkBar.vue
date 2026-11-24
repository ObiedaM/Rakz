<script setup lang="ts">
// Floating bulk-action dock when multiple cards are Ctrl/Cmd-selected.
import { ref } from "vue";
import { useLibrary } from "@/composables/library";
import { useAgent } from "@/composables/useAgent";
import Icon from "@/components/ui/Icon.vue";
import ConfirmButton from "@/components/ui/ConfirmButton.vue";

const { selectedSids, clearSelected, bulkMove, bulkDelete, copySelection, exportSelection } = useLibrary();
const { openAsk } = useAgent();

const moveTo = ref("");
const copied = ref(false);

function doMove(): void {
  bulkMove(moveTo.value);
  moveTo.value = "";
}

async function doCopy(): Promise<void> {
  copied.value = await copySelection();
  setTimeout(() => (copied.value = false), 1500);
}
</script>

<template>
  <Teleport to="body">
    <div v-if="selectedSids.length" class="bulk-bar select-none">
      <span class="bulk-count tabular">
        <Icon name="check" :size="13" />
        {{ selectedSids.length }} selected
      </span>

      <div class="bulk-sep" />

      <div class="bulk-move">
        <input
          v-model="moveTo"
          placeholder="folder/path (blank = subject)"
          class="rkz-input font-mono-meta move-input"
          @keydown.enter="doMove"
        />
        <button type="button" class="rkz-btn" @click="doMove">Move</button>
      </div>

      <button type="button" class="rkz-btn" @click="doCopy">
        <Icon :name="copied ? 'check' : 'copy'" :size="13" />
        <span>{{ copied ? "Copied" : "Copy .mns" }}</span>
      </button>

      <button type="button" class="rkz-btn rkz-btn-accent-soft" @click="openAsk()">
        <Icon name="sparkles" :size="13" />
        <span>Co-Pilot</span>
      </button>

      <button type="button" class="rkz-btn" @click="exportSelection">
        <Icon name="download" :size="13" />
        <span>Export</span>
      </button>

      <ConfirmButton
        label="Delete"
        confirm-label="Confirm?"
        :compact="true"
        @confirm="bulkDelete"
      />

      <button
        type="button"
        class="close-btn"
        title="Clear selection (Esc)"
        aria-label="Clear selection"
        @click="clearSelected"
      >
        <Icon name="x" :size="14" />
      </button>
    </div>
  </Teleport>
</template>

<style scoped>
.bulk-bar {
  position: fixed;
  left: 50%;
  bottom: 36px;
  transform: translateX(-50%);
  z-index: 1500;
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  max-width: 94vw;
  padding: 8px 10px;
  border-radius: var(--radius-md);
  border: 1px solid var(--border-strong);
  background-color: var(--bg-overlay);
  box-shadow: var(--shadow-lg);
}

.bulk-count {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 0 4px;
  font-size: 12px;
  font-weight: 600;
  color: var(--accent);
}

.bulk-sep {
  width: 1px;
  height: 18px;
  background-color: var(--border-default);
}

.bulk-move {
  display: flex;
  align-items: center;
  gap: 6px;
}

.move-input {
  width: 196px;
  height: 30px;
  padding: 0 8px;
  font-size: 11.5px;
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
</style>
