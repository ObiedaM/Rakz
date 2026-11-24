<script setup lang="ts">
// Root shell — native 3-pane desktop layout + status bar.
// Owns panel widths (viewport-clamped for Windows 11 DPI scaling), active view,
// sort/filter/zen/right-panel visibility, keyboard shortcuts, and modals.
// All data flows exclusively through useLibrary() / useAgent().

import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import SideBar from "@/components/layout/SideBar.vue";
import TopBar from "@/components/layout/TopBar.vue";
import MnemonicViewer from "@/components/viewer/MnemonicViewer.vue";
import RightPanel from "@/components/layout/RightPanel.vue";
import SettingsWindow from "@/components/settings/SettingsWindow.vue";
import Resizer from "@/components/ui/Resizer.vue";
import BulkBar from "@/components/ui/BulkBar.vue";
import AskDialog from "@/components/agent/AskDialog.vue";
import Icon from "@/components/ui/Icon.vue";
import { useLibrary } from "@/composables/library";
import { useAgent } from "@/composables/useAgent";

export type AppView = "stack" | "study" | "grid" | "graph";

const {
  load,
  create,
  saveNow,
  active,
  locateCard,
  vaultStats,
  crossSubjectLinkCount,
  studyStats,
  saveStatus,
  lastSaveError,
  isDesktop,
  selectedSids,
  clearSelected,
  theme,
  toggleTheme,
} = useLibrary();

const { openAsk } = useAgent();

const leftW = ref(252);
const rightW = ref(296);
const rightOpen = ref(true);
const view = ref<AppView>("stack");
const sort = ref("recent");
const filterTag = ref("");
const zen = ref(false);
const settingsOpen = ref(false);

const MIN_CENTER = 420;

function clampWidths(): void {
  const vw = window.innerWidth;
  if (vw < 960 && rightOpen.value) {
    rightOpen.value = false;
  }
  const maxSide = Math.max(200, Math.floor((vw - MIN_CENTER) / 2));
  leftW.value = Math.max(200, Math.min(Math.min(360, maxSide), leftW.value));
  rightW.value = Math.max(240, Math.min(Math.min(420, maxSide), rightW.value));
}

function resizeLeft(dx: number): void {
  const vw = window.innerWidth;
  const reservedRight = rightOpen.value ? rightW.value : 0;
  const maxLeft = Math.max(210, Math.min(420, vw - reservedRight - MIN_CENTER));
  leftW.value = Math.max(210, Math.min(maxLeft, leftW.value + dx));
}

function resizeRight(dx: number): void {
  const vw = window.innerWidth;
  const maxRight = Math.max(240, Math.min(460, vw - leftW.value - MIN_CENTER));
  rightW.value = Math.max(240, Math.min(maxRight, rightW.value - dx));
}

const activeLoc = computed(() => (active.value ? locateCard(active.value.sid) : null));

const saveLabel = computed(() => {
  if (!isDesktop) return "Browser session";
  if (saveStatus.value === "saving") return "Saving…";
  if (saveStatus.value === "error") return "Save failed";
  return "Saved locally";
});

function createAndShow(): void {
  create();
  if (view.value !== "stack") view.value = "stack";
}

function onKey(e: KeyboardEvent): void {
  if (e.key === "Escape") {
    if (!settingsOpen.value && zen.value) {
      zen.value = false;
      return;
    }
    if (!settingsOpen.value && selectedSids.value.length) {
      clearSelected();
      return;
    }
  }

  const mod = e.metaKey || e.ctrlKey;
  if (!mod) return;
  const k = e.key.toLowerCase();
  if (k === "n") {
    e.preventDefault();
    createAndShow();
  } else if (k === "1") {
    e.preventDefault();
    view.value = "stack";
  } else if (k === "2") {
    e.preventDefault();
    view.value = "study";
  } else if (k === "3") {
    e.preventDefault();
    view.value = "grid";
  } else if (k === "4") {
    e.preventDefault();
    view.value = "graph";
  } else if (k === "g") {
    e.preventDefault();
    const order: AppView[] = ["stack", "study", "grid", "graph"];
    view.value = order[(order.indexOf(view.value) + 1) % order.length]!;
  } else if (k === ".") {
    e.preventDefault();
    zen.value = !zen.value;
  } else if (k === "k") {
    e.preventDefault();
    if (zen.value) zen.value = false;
    setTimeout(() => document.getElementById("rkz-search")?.focus(), 0);
  } else if (k === "j") {
    e.preventDefault();
    openAsk();
  } else if (k === "s") {
    e.preventDefault();
    void saveNow();
  } else if (k === ",") {
    e.preventDefault();
    settingsOpen.value = true;
  }
}

onMounted(() => {
  void load();
  clampWidths();
  window.addEventListener("keydown", onKey);
  window.addEventListener("resize", clampWidths);
});

onBeforeUnmount(() => {
  window.removeEventListener("keydown", onKey);
  window.removeEventListener("resize", clampWidths);
});
</script>

<template>
  <div class="rkz-shell">
    <div class="rkz-workspace">
      <!-- Left sidebar (hidden in Zen) -->
      <template v-if="!zen">
        <div class="h-full shrink-0" :style="{ width: `${leftW}px` }">
          <SideBar
            :active-view="view"
            @open-settings="settingsOpen = true"
            @open-study="view = 'study'"
            @select-card="view === 'study' && (view = 'stack')"
          />
        </div>
        <Resizer @resize="resizeLeft" />
      </template>

      <!-- Center column -->
      <main class="rkz-center">
        <TopBar
          v-model:view="view"
          v-model:sort="sort"
          v-model:filter-tag="filterTag"
          v-model:zen="zen"
          v-model:right-open="rightOpen"
        />
        <MnemonicViewer
          :view="view"
          :sort="sort"
          :filter-tag="filterTag"
          @open-stack="view = 'stack'"
        />
      </main>

      <!-- Right connections panel (hidden in Zen, Study recall mode, or collapsed) -->
      <template v-if="!zen && rightOpen && view !== 'study'">
        <Resizer @resize="resizeRight" />
        <div class="h-full shrink-0" :style="{ width: `${rightW}px` }">
          <RightPanel @jump-card="view = 'stack'" />
        </div>
      </template>
    </div>

    <!-- Native Desktop Status Bar -->
    <footer class="rkz-statusbar select-none">
      <div class="status-group">
        <span
          class="status-pill"
          :class="{
            'is-ok': isDesktop && saveStatus !== 'error',
            'is-err': saveStatus === 'error',
          }"
          :title="lastSaveError || saveLabel"
        >
          <span class="status-dot" />
          <span>{{ saveLabel }}</span>
        </span>
        <span v-if="activeLoc" class="status-sep">·</span>
        <span v-if="activeLoc" class="font-mono-meta status-path" :title="`${activeLoc.file} line ${activeLoc.line}`">
          {{ activeLoc.file }}:{{ activeLoc.line }}
        </span>
      </div>

      <div class="status-group tabular">
        <span>{{ vaultStats.cards }} {{ vaultStats.cards === 1 ? "card" : "cards" }}</span>
        <span class="status-sep">·</span>
        <span :class="{ 'text-bridge': crossSubjectLinkCount > 0 }">
          {{ crossSubjectLinkCount }} {{ crossSubjectLinkCount === 1 ? "bridge" : "bridges" }}
        </span>
        <span class="status-sep">·</span>
        <button
          type="button"
          class="status-link"
          title="Switch to Active Recall Study Mode (Ctrl+2)"
          @click="view = 'study'"
        >
          {{ studyStats.dueCount }} due
        </button>
        <span class="status-sep">·</span>
        <button
          type="button"
          class="status-link"
          :title="theme === 'dark' ? 'Switch to Warm Paper Light' : 'Switch to Precision Dark'"
          @click="toggleTheme"
        >
          <Icon :name="theme === 'dark' ? 'sun' : 'moon'" :size="12" />
          <span>{{ theme === "dark" ? "Dark" : "Paper" }}</span>
        </button>
      </div>
    </footer>

    <SettingsWindow :open="settingsOpen" @close="settingsOpen = false" />
    <BulkBar />
    <AskDialog />
  </div>
</template>

<style scoped>
.rkz-shell {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  overflow: hidden;
  background-color: var(--bg-root);
}

.rkz-workspace {
  display: flex;
  flex: 1;
  min-height: 0;
  width: 100%;
  overflow: hidden;
}

.rkz-center {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-width: 0;
  height: 100%;
  overflow: hidden;
  background-color: var(--bg-root);
}

.rkz-statusbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  height: 26px;
  padding: 0 12px;
  background-color: var(--bg-sidebar);
  border-top: 1px solid var(--border-subtle);
  color: var(--text-muted);
  font-size: 11px;
  flex-shrink: 0;
}

.status-group {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.status-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--text-secondary);
}

.status-dot {
  width: 6px;
  height: 6px;
  border-radius: 999px;
  background-color: var(--text-muted);
}

.status-pill.is-ok .status-dot {
  background-color: var(--ok);
}

.status-pill.is-err {
  color: var(--danger);
}

.status-pill.is-err .status-dot {
  background-color: var(--danger);
}

.status-sep {
  opacity: 0.45;
}

.status-path {
  font-size: 10.5px;
  color: var(--text-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 260px;
}

.text-bridge {
  color: var(--bridge);
  font-weight: 600;
}

.status-link {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  border: none;
  background: transparent;
  color: var(--text-secondary);
  font-size: 11px;
  padding: 2px 5px;
  border-radius: var(--radius-xs);
  cursor: pointer;
  transition: background-color var(--ease-fast), color var(--ease-fast);
}

.status-link:hover {
  background-color: var(--bg-hover);
  color: var(--text-primary);
}
</style>
