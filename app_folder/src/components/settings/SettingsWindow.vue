<script setup lang="ts">
// Settings modal — Appearance (Theme + Subject Colors), AI Co-Pilot, Data & Storage, Shortcuts, General.

import { computed, onMounted, ref } from "vue";
import { SWATCHES } from "@/lib/utils";
import Dialog from "@/components/ui/Dialog.vue";
import ColorWheel from "@/components/ui/ColorWheel.vue";
import KitDropZone from "@/components/ui/KitDropZone.vue";
import ConfirmButton from "@/components/ui/ConfirmButton.vue";
import Icon from "@/components/ui/Icon.vue";
import { useLibrary } from "@/composables/library";
import { useAgent } from "@/composables/useAgent";

type TabId = "Appearance" | "AI" | "Data & Storage" | "Shortcuts" | "General";

const TABS: { id: TabId; icon: "palette" | "sparkles" | "database" | "keyboard" | "info" }[] = [
  { id: "Appearance", icon: "palette" },
  { id: "AI", icon: "sparkles" },
  { id: "Data & Storage", icon: "database" },
  { id: "Shortcuts", icon: "keyboard" },
  { id: "General", icon: "info" },
];

const SHORTCUTS = [
  { keys: "Ctrl+N", label: "New mnemonic card" },
  { keys: "Ctrl+K", label: "Search vault" },
  { keys: "Ctrl+1 / 2 / 3 / 4", label: "Switch Stack / Study / Grid / Graph" },
  { keys: "Ctrl+G", label: "Cycle workspace views" },
  { keys: "Ctrl+J", label: "Open Study Co-Pilot" },
  { keys: "Ctrl+.", label: "Toggle Zen focus mode" },
  { keys: "Ctrl+S", label: "Flush vault to disk now" },
  { keys: "Ctrl+,", label: "Open Settings" },
  { keys: "Alt+← / →", label: "Previous / next card in subject" },
  { keys: "Space · 1–4", label: "Reveal & grade in Study Mode" },
  { keys: "Esc", label: "Cancel armed delete / close dialog / exit Zen" },
];

defineProps<{ open?: boolean }>();
const emit = defineEmits<{ close: [] }>();

const {
  subjects,
  activeSubject,
  setSubjectColor,
  exportVault,
  importVault,
  vaultPath,
  openVaultFolder,
  isDesktop,
  vaultStats,
  studyStats,
  estimateVaultBytes,
  exportSettings,
  importSettings,
  lastImportFailed,
  clearImportFailure,
  theme,
  setTheme,
} = useLibrary();

const tab = ref<TabId>("Appearance");

const sizeLabel = computed(() => {
  void vaultStats.value;
  const b = estimateVaultBytes();
  return b >= 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`;
});

const editId = ref<string | null>(null);

const {
  keyStatus,
  keychainError,
  models,
  model,
  busy,
  error: agentError,
  storeKey,
  removeKey,
  refreshKeyStatus,
  refreshModels,
  setModel,
  testConnection,
} = useAgent();

const keyValue = ref("");
const keySavedFlash = ref(false);
const sessionFlash = ref(false);
const testing = ref(false);
const testResult = ref<{ ok: boolean; text: string } | null>(null);
const modelQuery = ref("");
const freeOnly = ref(false);

onMounted(() => {
  void refreshKeyStatus();
  void refreshModels();
});

function targetId(): string | undefined {
  return editId.value ?? activeSubject.value?.id;
}

function colorOf(): string {
  return subjects.value.find((s) => s.id === targetId())?.color || "#5B82F6";
}

async function saveApiKey(): Promise<void> {
  if (!keyValue.value.trim()) return;
  const wasUnavailable = keyStatus.value === "unavailable";
  await storeKey(keyValue.value);
  keyValue.value = "";
  if (wasUnavailable) {
    sessionFlash.value = true;
    setTimeout(() => (sessionFlash.value = false), 4500);
  } else {
    keySavedFlash.value = true;
    setTimeout(() => (keySavedFlash.value = false), 2200);
  }
  void refreshModels();
}

async function handleRemoveKey(): Promise<void> {
  await removeKey();
  testResult.value = null;
}

async function runTest(): Promise<void> {
  testing.value = true;
  testResult.value = null;
  const ok = await testConnection();
  testResult.value = ok
    ? { ok: true, text: "Connection verified" }
    : { ok: false, text: agentError.value || "Connection test failed." };
  testing.value = false;
}

const filteredModels = computed(() => {
  const q = modelQuery.value.trim().toLowerCase();
  const match = (m: { id: string; name: string }) =>
    !q || m.id.toLowerCase().includes(q) || m.name.toLowerCase().includes(q);
  const hits = models.value.filter((m) => match(m) && (!freeOnly.value || m.free));
  const selected = models.value.find((m) => m.id === model.value);
  if (selected && !hits.includes(selected)) hits.unshift(selected);
  return hits;
});

const freeCount = computed(() => models.value.filter((m) => m.free).length);
</script>

<template>
  <Dialog :open="open" width="760px" @close="emit('close')">
    <div class="settings-shell">
      <!-- Left Tab Rail -->
      <nav class="tab-rail select-none" aria-label="Settings sections">
        <div class="rail-head">
          <h3 class="rail-title">Settings</h3>
        </div>
        <button
          v-for="t in TABS"
          :key="t.id"
          type="button"
          class="rail-btn"
          :class="{ 'is-active': tab === t.id }"
          @click="tab = t.id"
        >
          <Icon :name="t.icon" :size="14" />
          <span>{{ t.id }}</span>
        </button>
      </nav>

      <!-- Main Panel -->
      <div class="tab-body rkz-scroll">
        <div class="panel-top select-none">
          <h4 class="panel-title">{{ tab }}</h4>
          <button type="button" class="close-btn" aria-label="Close settings" @click="emit('close')">
            <Icon name="x" :size="14" />
          </button>
        </div>

        <!-- APPEARANCE -->
        <div v-if="tab === 'Appearance'" class="stack-gap">
          <div class="surface-box">
            <div class="box-label">Workspace Theme</div>
            <div class="theme-grid">
              <button
                type="button"
                class="theme-card"
                :class="{ 'is-active': theme === 'dark' }"
                @click="setTheme('dark')"
              >
                <div class="theme-preview is-dark">
                  <span class="tp-bar" />
                  <span class="tp-card" />
                </div>
                <div class="theme-meta">
                  <span class="theme-name">Precision Dark</span>
                  <span class="theme-sub">Low-glare carbon surfaces</span>
                </div>
              </button>

              <button
                type="button"
                class="theme-card"
                :class="{ 'is-active': theme === 'light' }"
                @click="setTheme('light')"
              >
                <div class="theme-preview is-light">
                  <span class="tp-bar" />
                  <span class="tp-card" />
                </div>
                <div class="theme-meta">
                  <span class="theme-name">Warm Paper &amp; Ink</span>
                  <span class="theme-sub">Archival light reading surface</span>
                </div>
              </button>
            </div>
          </div>

          <div class="surface-box">
            <div class="box-label">Subject Marker Colors</div>
            <div class="subj-chips">
              <button
                v-for="s in subjects"
                :key="s.id"
                type="button"
                class="subj-chip"
                :class="{ 'is-active': targetId() === s.id }"
                @click="editId = s.id"
              >
                <span class="chip-dot" :style="{ backgroundColor: s.color }" />
                <span>{{ s.name }}</span>
              </button>
            </div>

            <div class="wheel-section">
              <ColorWheel
                :model-value="colorOf()"
                @update:model-value="targetId() && setSubjectColor(targetId()!, $event)"
              />
            </div>

            <div class="swatch-row">
              <button
                v-for="c in SWATCHES"
                :key="c"
                type="button"
                class="swatch-btn"
                :class="{ 'is-picked': colorOf().toUpperCase() === c.toUpperCase() }"
                :style="{ backgroundColor: c }"
                :title="c"
                @click="targetId() && setSubjectColor(targetId()!, c)"
              />
            </div>
          </div>
        </div>

        <!-- AI CO-PILOT -->
        <div v-else-if="tab === 'AI'" class="stack-gap">
          <div class="surface-box">
            <div class="box-label">OpenRouter API Key (Bring Your Own Key)</div>

            <p v-if="keyStatus === 'stored' && !sessionFlash" class="key-state is-ok">
              <span class="dot" /> Key stored securely in the OS keychain
            </p>
            <p v-else-if="keyStatus === 'stored' && sessionFlash" class="key-state is-warn">
              <span class="dot" /> Session-only key active in RAM (cleared when app closes)
            </p>
            <p v-else-if="keyStatus === 'unset'" class="key-state">
              <span class="dot" /> Not configured — paste a key from openrouter.ai/keys
            </p>
            <p v-else class="key-state is-err">
              <span class="dot" /> Keychain unavailable:
              <code class="font-mono-meta">{{ keychainError }}</code>
              — enter a session-only key below.
            </p>

            <div class="key-input-row">
              <input
                v-model="keyValue"
                type="password"
                autocomplete="off"
                spellcheck="false"
                placeholder="sk-or-v1-…"
                class="rkz-input font-mono-meta key-input"
                @keydown.enter="saveApiKey"
              />
              <button
                type="button"
                class="rkz-btn rkz-btn-primary"
                :disabled="!keyValue.trim()"
                @click="saveApiKey"
              >
                {{ keySavedFlash ? "Saved" : "Save" }}
              </button>
              <ConfirmButton
                v-if="keyStatus === 'stored'"
                label="Remove"
                confirm-label="Remove?"
                :compact="true"
                @confirm="handleRemoveKey"
              />
            </div>
            <p class="box-hint">
              Your key never enters <code class="font-mono-meta">settings.json</code> or vault files.
            </p>
          </div>

          <div class="surface-box">
            <div class="model-head">
              <span class="box-label m-0">Model Selection</span>
              <span class="model-count tabular">{{ models.length }} models · {{ freeCount }} free</span>
            </div>

            <div class="model-filter-row">
              <div class="model-search-wrap">
                <Icon name="search" :size="12" class="ms-icon" />
                <input
                  v-model="modelQuery"
                  placeholder="Filter models (e.g. free, gemini, llama)…"
                  class="rkz-input ms-input"
                />
              </div>
              <button
                type="button"
                class="rkz-btn"
                :class="{ 'rkz-btn-accent-soft': freeOnly }"
                @click="freeOnly = !freeOnly"
              >
                Free only
              </button>
              <button
                type="button"
                class="rkz-btn icon-btn"
                title="Reload OpenRouter catalog"
                @click="refreshModels"
              >
                <Icon name="refresh" :size="13" />
              </button>
            </div>

            <div class="model-list rkz-scroll">
              <button
                v-for="m in filteredModels"
                :key="m.id"
                type="button"
                class="model-row"
                :class="{ 'is-selected': model === m.id }"
                @click="setModel(m.id)"
              >
                <span class="radio-dot" :class="{ 'is-on': model === m.id }" />
                <span class="model-info">
                  <span class="model-name">{{ m.name }}</span>
                  <span class="model-id font-mono-meta">{{ m.id }}</span>
                </span>
                <span v-if="m.free" class="free-badge">FREE</span>
              </button>
              <p v-if="!filteredModels.length" class="empty-models">
                No models match "{{ modelQuery }}".
              </p>
            </div>

            <div class="test-row">
              <button
                type="button"
                class="rkz-btn rkz-btn-primary"
                :disabled="busy || testing"
                @click="runTest"
              >
                {{ testing ? "Testing…" : "Test Connection" }}
              </button>
              <span v-if="testResult" class="test-msg" :class="testResult.ok ? 'is-ok' : 'is-err'">
                {{ testResult.text }}
              </span>
            </div>
          </div>
        </div>

        <!-- DATA & STORAGE -->
        <div v-else-if="tab === 'Data & Storage'" class="stack-gap">
          <div class="surface-box">
            <div class="box-label">Local Vault Directory</div>
            <div class="path-row">
              <code class="vault-path font-mono-meta">{{ vaultPath }}</code>
              <button v-if="isDesktop" type="button" class="rkz-btn" @click="openVaultFolder">
                <Icon name="folder" :size="13" />
                <span>Open Folder</span>
              </button>
            </div>
          </div>

          <div class="stats-grid tabular">
            <div class="stat-card">
              <span class="stat-val font-mono-meta">{{ vaultStats.cards }}</span>
              <span class="stat-lbl">Mnemonics</span>
            </div>
            <div class="stat-card">
              <span class="stat-val font-mono-meta">{{ vaultStats.links }}</span>
              <span class="stat-lbl">Links</span>
            </div>
            <div class="stat-card">
              <span class="stat-val font-mono-meta">{{ studyStats.masteredCount }}</span>
              <span class="stat-lbl">Mastered</span>
            </div>
            <div class="stat-card">
              <span class="stat-val font-mono-meta">{{ sizeLabel }}</span>
              <span class="stat-lbl">Vault Size</span>
            </div>
          </div>

          <KitDropZone />

          <div class="io-row">
            <button type="button" class="rkz-btn rkz-btn-primary flex-1" @click="exportVault">
              <Icon name="download" :size="13" />
              <span>{{ isDesktop ? "Save & Open Vault (.mns)" : "Export Vault (.mns)" }}</span>
            </button>
            <button
              type="button"
              class="rkz-btn flex-1"
              @click="importVault(); clearImportFailure()"
            >
              <Icon name="upload" :size="13" />
              <span>Import Vault (.mns / .rkz)</span>
            </button>
          </div>

          <p v-if="lastImportFailed" class="err-inline">
            Selected file is not a valid RAKZ vault (.mns or .rkz).
          </p>

          <div class="io-row">
            <button type="button" class="rkz-btn flex-1" @click="exportSettings">
              Export Settings (.json)
            </button>
            <button type="button" class="rkz-btn flex-1" @click="importSettings">
              Import Settings (.json)
            </button>
          </div>
          <p class="box-hint">
            <code class="font-mono-meta">settings.json</code> stores theme and subject colors safely outside secrets so vaults stay shareable.
          </p>
        </div>

        <!-- SHORTCUTS -->
        <div v-else-if="tab === 'Shortcuts'" class="shortcut-list">
          <div v-for="s in SHORTCUTS" :key="s.label" class="shortcut-row">
            <span class="sc-label">{{ s.label }}</span>
            <kbd class="rkz-kbd sc-keys">{{ s.keys }}</kbd>
          </div>
        </div>

        <!-- GENERAL -->
        <div v-else class="stack-gap">
          <div class="surface-box">
            <div class="about-head">
              <img src="/Image.svg" alt="" width="36" height="36" class="about-logo" />
              <div>
                <div class="about-title">
                  RAKZ <span class="font-mono-meta about-ver">v0.2.1</span>
                </div>
                <div class="about-sub">
                  Local-first mnemonic vault · {{ isDesktop ? "Tauri 2 Desktop (Windows/Linux/macOS)" : "Browser Session" }}
                </div>
              </div>
            </div>

            <div class="meta-table">
              <div class="meta-line">
                <span>Format Standard</span>
                <code class="font-mono-meta">.mns v0.1 (plain-text)</code>
              </div>
              <div class="meta-line">
                <span>Parser</span>
                <code class="font-mono-meta">@rakz-app/mns-parser 0.1.0</code>
              </div>
              <div class="meta-line">
                <span>App Identifier</span>
                <code class="font-mono-meta">com.rakz.app</code>
              </div>
              <div class="meta-line">
                <span>Study Schedule</span>
                <code class="font-mono-meta">.study/reviews.json (local)</code>
              </div>
            </div>
          </div>

          <p class="box-hint">
            Built on retrieval practice, spaced repetition, cross-subject elaborative linking, and restrained AI scaffolding — 100% offline-capable and user-owned.
          </p>
        </div>
      </div>
    </div>
  </Dialog>
</template>

<style scoped>
.settings-shell {
  display: flex;
  min-height: 500px;
  max-height: 82vh;
}

.tab-rail {
  display: flex;
  flex-direction: column;
  gap: 2px;
  width: 184px;
  padding: 16px 10px;
  border-right: 1px solid var(--border-subtle);
  background-color: var(--bg-sidebar);
  flex-shrink: 0;
}

.rail-head {
  padding: 2px 8px 12px;
}

.rail-title {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
}

.rail-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  height: 32px;
  padding: 0 10px;
  border: none;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--text-secondary);
  font-size: 12.5px;
  font-weight: 500;
  text-align: left;
  cursor: pointer;
  transition: background-color var(--ease-fast), color var(--ease-fast);
}

.rail-btn:hover {
  background-color: var(--bg-hover);
  color: var(--text-primary);
}

.rail-btn.is-active {
  background-color: var(--bg-active);
  color: var(--text-primary);
  font-weight: 600;
}

.tab-body {
  flex: 1;
  min-width: 0;
  overflow-y: auto;
  padding: 18px 22px 22px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.panel-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.panel-title {
  margin: 0;
  font-size: 15px;
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

.stack-gap {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.surface-box {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 14px 16px;
  border-radius: var(--radius-md);
  border: 1px solid var(--border-subtle);
  background-color: var(--bg-surface);
}

.box-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-primary);
}

.box-hint {
  margin: 0;
  font-size: 11.5px;
  color: var(--text-muted);
  line-height: 1.5;
}

.theme-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

.theme-card {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 10px;
  border-radius: var(--radius-md);
  border: 1.5px solid var(--border-default);
  background-color: var(--bg-input);
  text-align: left;
  cursor: pointer;
  transition: border-color var(--ease-fast);
}

.theme-card:hover {
  border-color: var(--border-strong);
}

.theme-card.is-active {
  border-color: var(--accent);
}

.theme-preview {
  display: flex;
  gap: 6px;
  height: 52px;
  padding: 8px;
  border-radius: var(--radius-sm);
  border: 1px solid rgba(128, 128, 128, 0.2);
}

.theme-preview.is-dark {
  background-color: #111214;
}

.theme-preview.is-dark .tp-bar {
  width: 24%;
  border-radius: 3px;
  background-color: #1d2026;
}

.theme-preview.is-dark .tp-card {
  flex: 1;
  border-radius: 3px;
  background-color: #1b1d22;
  border-top: 2px solid #5b82f6;
}

.theme-preview.is-light {
  background-color: #f5f2ea;
}

.theme-preview.is-light .tp-bar {
  width: 24%;
  border-radius: 3px;
  background-color: #e6e0d2;
}

.theme-preview.is-light .tp-card {
  flex: 1;
  border-radius: 3px;
  background-color: #fcfbf7;
  border-top: 2px solid #3358d4;
}

.theme-meta {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.theme-name {
  font-size: 12.5px;
  font-weight: 600;
  color: var(--text-primary);
}

.theme-sub {
  font-size: 11px;
  color: var(--text-muted);
}

.subj-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.subj-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 26px;
  padding: 0 9px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border-default);
  background-color: var(--bg-input);
  color: var(--text-secondary);
  font-size: 12px;
  cursor: pointer;
}

.subj-chip.is-active {
  border-color: var(--accent);
  color: var(--text-primary);
  font-weight: 600;
}

.chip-dot {
  width: 7px;
  height: 7px;
  border-radius: 999px;
}

.wheel-section {
  padding: 4px 0;
}

.swatch-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.swatch-btn {
  width: 24px;
  height: 24px;
  border-radius: var(--radius-xs);
  border: 2px solid transparent;
  cursor: pointer;
}

.swatch-btn.is-picked {
  border-color: var(--text-primary);
}

.key-state {
  display: flex;
  align-items: center;
  gap: 7px;
  margin: 0;
  font-size: 12px;
  color: var(--text-secondary);
  flex-wrap: wrap;
}

.key-state .dot {
  width: 7px;
  height: 7px;
  border-radius: 999px;
  background-color: var(--text-muted);
  flex-shrink: 0;
}

.key-state.is-ok {
  color: var(--ok);
}
.key-state.is-ok .dot {
  background-color: var(--ok);
}

.key-state.is-warn {
  color: var(--warn);
}
.key-state.is-warn .dot {
  background-color: var(--warn);
}

.key-state.is-err {
  color: var(--danger);
}
.key-state.is-err .dot {
  background-color: var(--danger);
}

.key-input-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.key-input {
  flex: 1;
  height: 32px;
  padding: 0 10px;
}

.model-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.model-count {
  font-size: 11px;
  color: var(--ok);
  font-weight: 600;
}

.model-filter-row {
  display: flex;
  align-items: center;
  gap: 6px;
}

.model-search-wrap {
  position: relative;
  flex: 1;
  display: flex;
  align-items: center;
}

.ms-icon {
  position: absolute;
  left: 9px;
  color: var(--text-muted);
  pointer-events: none;
}

.ms-input {
  height: 30px;
  padding: 0 10px 0 28px;
}

.icon-btn {
  width: 30px;
  padding: 0;
}

.model-list {
  max-height: 200px;
  overflow-y: auto;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border-subtle);
  background-color: var(--bg-input);
}

.model-row {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 8px 10px;
  border: none;
  border-bottom: 1px solid var(--border-subtle);
  background: transparent;
  text-align: left;
  cursor: pointer;
}

.model-row:last-child {
  border-bottom: none;
}

.model-row:hover {
  background-color: var(--bg-hover);
}

.model-row.is-selected {
  background-color: var(--accent-subtle);
}

.radio-dot {
  width: 11px;
  height: 11px;
  border-radius: 999px;
  border: 1.5px solid var(--border-strong);
  flex-shrink: 0;
}

.radio-dot.is-on {
  border-color: var(--accent);
  background-color: var(--accent);
}

.model-info {
  display: flex;
  flex-direction: column;
  min-width: 0;
  flex: 1;
}

.model-name {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.model-id {
  font-size: 10.5px;
  color: var(--text-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.free-badge {
  font-size: 9.5px;
  font-weight: 700;
  letter-spacing: 0.06em;
  padding: 2px 6px;
  border-radius: 999px;
  border: 1px solid var(--ok-border);
  background-color: var(--ok-subtle);
  color: var(--ok);
  flex-shrink: 0;
}

.empty-models {
  margin: 0;
  padding: 12px;
  font-size: 12px;
  color: var(--text-muted);
}

.test-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.test-msg {
  font-size: 12px;
  font-weight: 500;
}

.test-msg.is-ok {
  color: var(--ok);
}

.test-msg.is-err {
  color: var(--danger);
}

.path-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.vault-path {
  flex: 1;
  font-size: 12px;
  color: var(--text-secondary);
  word-break: break-all;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
}

.stat-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: 12px 8px;
  border-radius: var(--radius-md);
  border: 1px solid var(--border-subtle);
  background-color: var(--bg-surface);
}

.stat-val {
  font-size: 16px;
  font-weight: 700;
  color: var(--accent);
}

.stat-lbl {
  font-size: 10.5px;
  color: var(--text-muted);
}

.io-row {
  display: flex;
  gap: 8px;
}

.err-inline {
  margin: 0;
  font-size: 12px;
  color: var(--danger);
}

.shortcut-list {
  display: flex;
  flex-direction: column;
}

.shortcut-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 2px;
  border-bottom: 1px solid var(--border-subtle);
}

.shortcut-row:last-child {
  border-bottom: none;
}

.sc-label {
  font-size: 12.5px;
  color: var(--text-primary);
}

.sc-keys {
  height: 22px;
  padding: 0 7px;
  font-size: 11px;
}

.about-head {
  display: flex;
  align-items: center;
  gap: 12px;
}

.about-logo {
  border-radius: var(--radius-md);
}

.about-title {
  font-size: 15px;
  font-weight: 700;
}

.about-ver {
  font-size: 11px;
  font-weight: 500;
  color: var(--text-muted);
  margin-left: 4px;
}

.about-sub {
  font-size: 12px;
  color: var(--text-muted);
}

.meta-table {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding-top: 6px;
  border-top: 1px solid var(--border-subtle);
}

.meta-line {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 12px;
  color: var(--text-muted);
}

.meta-line code {
  color: var(--text-primary);
  font-size: 11.5px;
}
</style>
