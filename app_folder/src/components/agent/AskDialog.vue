<script setup lang="ts">
// Restrained AI Co-Pilot Dialog — built around peer-reviewed learning scaffolds
// (Quiz Me, Find Bridges, Critique Hook, Ask Why, Ask) so AI deepens recall
// rather than causing cognitive offloading. Never writes directly to the vault.

import { computed, ref } from "vue";
import Dialog from "@/components/ui/Dialog.vue";
import Icon from "@/components/ui/Icon.vue";
import { useAgent } from "@/composables/useAgent";
import { useLibrary } from "@/composables/library";
import { COPILOT_MODES, getCopilotMode } from "@/agent/prompt-templates";

const { open, busy, answer, error, mode, contextCount, ask, closeAsk } = useAgent();
const { copyToClipboard } = useLibrary();

const question = ref("");
const copied = ref(false);

const currentMode = computed(() => getCopilotMode(mode.value));
const canRun = computed(() => {
  if (busy.value || contextCount.value === 0) return false;
  if (mode.value === "ask") return !!question.value.trim();
  return true;
});

async function submit(): Promise<void> {
  if (!canRun.value) return;
  await ask(question.value, mode.value);
}

async function copyAnswer(): Promise<void> {
  if (await copyToClipboard(answer.value)) {
    copied.value = true;
    setTimeout(() => (copied.value = false), 1500);
  }
}
</script>

<template>
  <Dialog :open="open" width="640px" @close="closeAsk">
    <div class="ask-wrap">
      <!-- Header -->
      <div class="ask-head select-none">
        <div class="head-left">
          <Icon name="sparkles" :size="15" class="accent-ic" />
          <h3 class="ask-title">Study Co-Pilot</h3>
          <span class="ctx-pill tabular">{{ contextCount }} {{ contextCount === 1 ? "card" : "cards" }}</span>
        </div>

        <div class="head-right">
          <span class="guard-pill" title="The co-pilot scaffolds thinking and cannot overwrite your vault">
            Read-only · You encode
          </span>
          <button type="button" class="close-btn" aria-label="Close" @click="closeAsk">
            <Icon name="x" :size="14" />
          </button>
        </div>
      </div>

      <!-- Evidence-backed Scaffold Mode Selector -->
      <div class="mode-strip select-none" role="tablist" aria-label="Co-pilot scaffold mode">
        <button
          v-for="m in COPILOT_MODES"
          :key="m.id"
          type="button"
          role="tab"
          :aria-selected="mode === m.id"
          class="mode-tab"
          :class="{ 'is-active': mode === m.id }"
          @click="mode = m.id"
        >
          {{ m.label }}
        </button>
      </div>

      <p class="mode-desc">{{ currentMode.shortDesc }}</p>

      <!-- Prompt Input -->
      <textarea
        v-model="question"
        dir="auto"
        :placeholder="currentMode.placeholder"
        class="rkz-input ask-input"
        @keydown.enter.exact.prevent="submit"
      />

      <div class="ask-actions select-none">
        <span class="key-hint">
          <kbd class="rkz-kbd">Enter</kbd> run · <kbd class="rkz-kbd">Shift+Enter</kbd> newline
        </span>
        <button
          type="button"
          class="rkz-btn rkz-btn-primary"
          :disabled="!canRun"
          @click="submit"
        >
          <Icon name="sparkles" :size="13" />
          <span>{{ busy ? "Thinking…" : mode === "ask" ? "Ask" : `Run ${currentMode.label}` }}</span>
        </button>
      </div>

      <!-- Response -->
      <div v-if="answer" class="answer-box">
        <div class="answer-head select-none">
          <span class="rkz-label">Co-Pilot Response</span>
          <button type="button" class="rkz-btn copy-btn" @click="copyAnswer">
            <Icon :name="copied ? 'check' : 'copy'" :size="12" />
            <span>{{ copied ? "Copied" : "Copy" }}</span>
          </button>
        </div>
        <p dir="auto" class="answer-text select-text">{{ answer }}</p>
      </div>

      <!-- Inline Error Surface -->
      <div v-if="error" class="error-box">
        <Icon name="alert" :size="14" />
        <span>{{ error }}</span>
      </div>
    </div>
  </Dialog>
</template>

<style scoped>
.ask-wrap {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 20px;
}

.ask-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.head-left,
.head-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.accent-ic {
  color: var(--accent);
}

.ask-title {
  margin: 0;
  font-size: 14.5px;
  font-weight: 600;
}

.ctx-pill {
  font-size: 11px;
  font-weight: 600;
  padding: 2px 7px;
  border-radius: 999px;
  background-color: var(--accent-subtle);
  color: var(--accent);
}

.guard-pill {
  font-size: 10.5px;
  padding: 2px 8px;
  border-radius: 999px;
  border: 1px solid var(--border-subtle);
  background-color: var(--bg-input);
  color: var(--text-muted);
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

.mode-strip {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  padding: 3px;
  border-radius: var(--radius-md);
  border: 1px solid var(--border-subtle);
  background-color: var(--bg-input);
}

.mode-tab {
  flex: 1;
  min-width: 84px;
  height: 28px;
  padding: 0 10px;
  border: 1px solid transparent;
  border-radius: 5px;
  background: transparent;
  color: var(--text-secondary);
  font-size: 11.5px;
  font-weight: 500;
  cursor: pointer;
  transition: background-color var(--ease-fast), color var(--ease-fast), border-color var(--ease-fast);
}

.mode-tab:hover:not(.is-active) {
  background-color: var(--bg-hover);
  color: var(--text-primary);
}

.mode-tab.is-active {
  background-color: var(--bg-surface);
  border-color: var(--border-default);
  color: var(--text-primary);
  font-weight: 600;
}

.mode-desc {
  margin: 0;
  font-size: 12px;
  color: var(--text-muted);
}

.ask-input {
  min-height: 78px;
  padding: 10px 12px;
  font-size: 13px;
  line-height: 1.55;
  resize: vertical;
  font-family: var(--font-sans);
}

.ask-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.key-hint {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 11px;
  color: var(--text-muted);
}

.answer-box {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 14px;
  border-radius: var(--radius-md);
  border: 1px solid var(--accent-border);
  background-color: var(--bg-input);
}

.answer-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.copy-btn {
  height: 24px;
  padding: 0 8px;
  font-size: 11px;
}

.answer-text {
  margin: 0;
  font-size: 13px;
  line-height: 1.65;
  color: var(--text-primary);
  white-space: pre-wrap;
}

.error-box {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 10px 12px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--danger-border);
  background-color: var(--danger-subtle);
  color: var(--danger);
  font-size: 12px;
  line-height: 1.45;
}
</style>
