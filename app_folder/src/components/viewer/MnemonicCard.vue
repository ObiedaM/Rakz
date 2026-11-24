<script setup lang="ts">
// Mnemonic Studio Card — clean, focused editing & reading surface.
// Uses only useLibrary() (Invariant #1), case-insensitive card type toggles,
// Escape-cancellable inline rename & two-step delete (Invariant #3).

import { computed, ref } from "vue";
import StarRating from "@/components/ui/StarRating.vue";
import TagTokens from "@/components/ui/TagTokens.vue";
import ConfirmButton from "@/components/ui/ConfirmButton.vue";
import Icon from "@/components/ui/Icon.vue";
import { useLibrary } from "@/composables/library";
import type { Link, Memonic } from "@/composables/library";

interface LinkTarget {
  sid: number;
  title: string;
}

const TYPES = ["Rule", "Fact", "Story"];

const props = withDefaults(
  defineProps<{
    memonic: Memonic;
    editable?: boolean;
    compact?: boolean;
  }>(),
  { editable: false, compact: false },
);

const {
  editField,
  setTags,
  memonics,
  subjects,
  deck,
  select,
  remove,
  link,
  renameLink,
  getReviewRecord,
  isCardDue,
  formatInterval,
  getDeepRoots,
  setDeepRoots,
  cardDepthLevel,
  cardCrossBridgeCount,
} = useLibrary();

const rootsOpen = ref(false);
const linksOpen = ref(true);
const newLinkOpen = ref(false);
const linkQuery = ref("");
const linkTarget = ref<LinkTarget | null>(null);
const linkTitle = ref("");
const editingLink = ref<number | null>(null);
const editTitle = ref("");

const liveCard = computed<Memonic>(() =>
  memonics.value.find((m) => m.sid === props.memonic.sid) || props.memonic,
);

const cardSubject = computed(() =>
  subjects.value.find((s) => s.id === liveCard.value.id),
);

const deepRootsText = computed(() => getDeepRoots(liveCard.value));
const depthLevel = computed(() => cardDepthLevel(liveCard.value));
const crossBridges = computed(() => cardCrossBridgeCount(liveCard.value));

function updateDeepRoots(val: string): void {
  if (!props.editable) return;
  setDeepRoots(liveCard.value, val);
}

const reviewBadge = computed(() => {
  const rec = getReviewRecord(liveCard.value);
  if (!rec) return { label: "New · Due", due: true };
  if (isCardDue(liveCard.value)) return { label: "Due now", due: true };
  return { label: `Review in ${formatInterval(rec.intervalDays, rec.dueAt)}`, due: false };
});

function set(field: string, value: unknown): void {
  if (!props.editable) return;
  if (field === "tags") {
    setTags(props.memonic.sid, value as string[]);
    return;
  }
  editField(props.memonic.sid, field, value);
}

function isTypeActive(t: string): boolean {
  return (liveCard.value.type || "fact").toLowerCase() === t.toLowerCase();
}

function nav(dir: number): void {
  const list = deck.value;
  if (list.length < 2) return;
  const i = list.findIndex((m) => m.sid === liveCard.value.sid);
  const next = list[(i + dir + list.length) % list.length]!;
  select(next.sid);
}

const deckPos = computed(() => {
  const list = deck.value;
  const i = list.findIndex((m) => m.sid === liveCard.value.sid);
  return { i: i >= 0 ? i + 1 : 1, n: Math.max(list.length, 1) };
});

function targetTitle(sid: number): string {
  return memonics.value.find((m) => m.sid === sid)?.title ?? "(missing card)";
}

function isCrossTarget(sid: number): boolean {
  const target = memonics.value.find((m) => m.sid === sid);
  return !!target && target.id !== liveCard.value.id;
}

const linkResults = computed<Memonic[]>(() => {
  const q = linkQuery.value.trim().toLowerCase();
  if (!q || linkTarget.value) return [];
  const linked = new Set((liveCard.value.links ?? []).map((l) => l.targetSID));
  return memonics.value
    .filter(
      (m) =>
        m.sid !== liveCard.value.sid &&
        !linked.has(m.sid) &&
        `${m.title} ${m.id}`.toLowerCase().includes(q),
    )
    .slice(0, 6);
});

function createLink(): void {
  if (!linkTarget.value) return;
  link(liveCard.value.sid, linkTarget.value.sid, linkTitle.value.trim() || "related");
  closeNewLink();
}

function closeNewLink(): void {
  newLinkOpen.value = false;
  linkQuery.value = "";
  linkTarget.value = null;
  linkTitle.value = "";
}

function startRename(l: Link): void {
  if (!props.editable) return;
  editingLink.value = l.targetSID;
  editTitle.value = l.title;
}

function cancelRename(): void {
  editingLink.value = null;
  editTitle.value = "";
}

function commitRename(l: Link): void {
  if (editingLink.value !== l.targetSID) return;
  const t = editTitle.value.trim();
  editingLink.value = null;
  if (t && t !== l.title) renameLink(liveCard.value.sid, l.targetSID, t);
}
</script>

<template>
  <article class="card-shell">
    <!-- Top Header Bar -->
    <div class="card-head select-none">
      <div class="head-left">
        <div class="nav-arrows">
          <button
            type="button"
            class="nav-btn"
            :disabled="deckPos.n < 2"
            title="Previous card in subject (Alt+←)"
            aria-label="Previous card"
            @click.stop="nav(-1)"
          >
            <Icon name="arrow-left" :size="13" />
          </button>
          <button
            type="button"
            class="nav-btn"
            :disabled="deckPos.n < 2"
            title="Next card in subject (Alt+→)"
            aria-label="Next card"
            @click.stop="nav(1)"
          >
            <Icon name="arrow-right" :size="13" />
          </button>
        </div>

        <span class="pos-badge tabular font-mono-meta">{{ deckPos.i }}/{{ deckPos.n }}</span>

        <span v-if="cardSubject" class="subject-tag">
          <span class="subject-dot" :style="{ backgroundColor: cardSubject.color }" />
          <span>{{ cardSubject.name }}</span>
        </span>
      </div>

      <!-- Segmented Card Type -->
      <div class="type-group" role="radiogroup" aria-label="Mnemonic type">
        <button
          v-for="t in TYPES"
          :key="t"
          type="button"
          role="radio"
          :aria-checked="isTypeActive(t)"
          class="type-btn"
          :class="{ 'is-active': isTypeActive(t) }"
          :disabled="!editable"
          @click.prevent="set('type', t)"
        >
          {{ t }}
        </button>
      </div>

      <span class="review-pill tabular" :class="{ 'is-due': reviewBadge.due }">
        {{ reviewBadge.label }}
      </span>
    </div>

    <!-- Main Editable Studio Body -->
    <div class="card-body rkz-scroll select-text">
      <!-- Layer 1: Mnemonic Title / Hook -->
      <div class="title-block">
        <label v-if="editable" class="sr-only" :for="`card-title-${liveCard.sid}`">Mnemonic hook</label>
        <input
          v-if="editable"
          :id="`card-title-${liveCard.sid}`"
          dir="auto"
          :value="liveCard.title"
          placeholder="Write a vivid mnemonic hook or condensed rule…"
          class="title-input"
          :class="{ 'is-compact': compact }"
          @input="set('title', ($event.target as HTMLInputElement).value)"
        />
        <h1 v-else dir="auto" class="title-heading" :class="{ 'is-compact': compact }">
          {{ liveCard.title || "Untitled mnemonic" }}
        </h1>
      </div>

      <!-- Layer 2: Core Context & Explanation -->
      <div class="section-block flex-1">
        <div class="section-head select-none">
          <span class="rkz-label">Core Explanation (L2)</span>
          <div class="depth-meta">
            <span
              class="depth-pill font-mono-meta"
              :title="`Learning depth: L1 Hook${depthLevel >= 2 ? ' · L2 Core' : ''}${depthLevel >= 3 ? ' · L3 Deep Roots' : ''}`"
            >
              <span class="depth-step is-lit">L1</span>
              <span class="depth-step" :class="{ 'is-lit': depthLevel >= 2 }">L2</span>
              <span class="depth-step" :class="{ 'is-lit': depthLevel >= 3 }">L3</span>
            </span>
            <span
              class="bridge-state-pill"
              :class="crossBridges > 0 ? 'is-bridged' : 'is-island'"
              :title="
                crossBridges > 0
                  ? `Connected to ${crossBridges} other ${crossBridges === 1 ? 'subject' : 'subjects'}`
                  : 'Isolated island — bridge to another subject for durable retention'
              "
            >
              {{ crossBridges > 0 ? `Bridged · ${crossBridges}` : "Island" }}
            </span>
          </div>
        </div>
        <textarea
          v-if="editable"
          dir="auto"
          :value="liveCard.context"
          placeholder="Explain the concept in your own words — why does this rule or fact hold?"
          class="rkz-input context-area"
          @input="set('context', ($event.target as HTMLTextAreaElement).value)"
        />
        <p v-else dir="auto" class="context-prose">
          {{ liveCard.context || "No explanation added yet." }}
        </p>
      </div>

      <!-- Layer 3: Deep Roots & First Principles (True Science — local study metadata) -->
      <div v-if="editable || deepRootsText" class="section-block roots-block">
        <div class="section-head select-none">
          <button
            type="button"
            class="collapse-trigger"
            @click.stop="rootsOpen = !rootsOpen"
          >
            <Icon :name="rootsOpen ? 'chevron-down' : 'chevron-right'" :size="12" />
            <span class="rkz-label">Deep Roots &amp; First Principles (L3)</span>
            <span v-if="deepRootsText" class="roots-badge">authored</span>
            <span v-else class="roots-opt">optional</span>
          </button>
        </div>

        <button
          v-if="!rootsOpen && deepRootsText"
          type="button"
          dir="auto"
          class="roots-preview"
          @click.stop="rootsOpen = true"
        >
          {{ deepRootsText }}
        </button>

        <template v-if="rootsOpen">
          <textarea
            v-if="editable"
            dir="auto"
            :value="deepRootsText"
            placeholder="First-principles derivation, historical origin, edge cases, or real-world transfer…"
            class="rkz-input roots-area"
            @input="updateDeepRoots(($event.target as HTMLTextAreaElement).value)"
          />
          <p v-else dir="auto" class="context-prose">
            {{ deepRootsText }}
          </p>
        </template>
      </div>

      <!-- Concept Tags -->
      <div class="section-block">
        <div class="section-head select-none">
          <span class="rkz-label">Concept Tags</span>
          <span class="tag-hint">Shared tags across subjects surface bridges automatically</span>
        </div>
        <TagTokens
          v-if="editable"
          :model-value="liveCard.tags || []"
          :active-subject-id="liveCard.id"
          @update:model-value="set('tags', $event)"
        />
        <div v-else class="readonly-tags">
          <span v-for="t in liveCard.tags" :key="t" class="readonly-tag font-mono-meta">#{{ t }}</span>
          <span v-if="!liveCard.tags.length" class="muted-note">No tags</span>
        </div>
      </div>

      <!-- Outgoing Structural Links -->
      <div v-if="editable || liveCard.links.length" class="section-block">
        <div class="section-head select-none">
          <button type="button" class="collapse-trigger" @click.stop="linksOpen = !linksOpen">
            <Icon name="link" :size="12" />
            <span class="rkz-label">Outgoing Links</span>
            <span class="link-count tabular">{{ liveCard.links.length }}</span>
            <span class="toggle-word">{{ linksOpen ? "hide" : "show" }}</span>
          </button>

          <button
            v-if="editable"
            type="button"
            class="rkz-btn mini-btn"
            @click.stop="newLinkOpen = !newLinkOpen"
          >
            <Icon name="plus" :size="12" />
            <span>Add Link</span>
          </button>
        </div>

        <div v-if="linksOpen && liveCard.links.length" class="link-list">
          <div
            v-for="l in liveCard.links"
            :key="`${l.targetSID}-${l.title}`"
            class="link-row"
          >
            <input
              v-if="editingLink === l.targetSID"
              v-model="editTitle"
              class="rkz-input font-mono-meta rename-input"
              @keydown.enter.prevent="commitRename(l)"
              @keydown.esc.stop.prevent="cancelRename"
              @blur="commitRename(l)"
              @click.stop
            />
            <button
              v-else
              type="button"
              class="edge-chip font-mono-meta"
              :class="{ 'is-bridge': isCrossTarget(l.targetSID) }"
              :title="editable ? 'Click to rename why these concepts connect' : l.title"
              @click.stop="startRename(l)"
            >
              #{{ l.title }}
            </button>

            <Icon name="arrow-right" :size="12" class="edge-arrow" />

            <button
              type="button"
              class="target-btn"
              :title="`Open ${targetTitle(l.targetSID)}`"
              @click.stop="select(l.targetSID)"
            >
              <span dir="auto" class="truncate">{{ targetTitle(l.targetSID) }}</span>
              <span v-if="isCrossTarget(l.targetSID)" class="bridge-dot" title="Cross-subject bridge" />
            </button>
          </div>
        </div>

        <!-- Inline New Link Form -->
        <div
          v-if="newLinkOpen && editable"
          class="new-link-form"
          @click.stop
          @keydown.esc.stop="closeNewLink"
        >
          <input
            v-model="linkQuery"
            placeholder="Search a card by title or subject…"
            class="rkz-input form-input"
            @input="linkTarget = null"
          />

          <div v-if="linkResults.length" class="picker-list">
            <button
              v-for="m in linkResults"
              :key="m.sid"
              type="button"
              class="picker-row"
              @click.stop="
                linkTarget = { sid: m.sid, title: m.title };
                linkQuery = m.title;
              "
            >
              <span class="truncate">{{ m.title }}</span>
              <span class="picker-subj font-mono-meta">{{ m.id }}</span>
            </button>
          </div>

          <div v-if="linkTarget" class="picked-target">
            <Icon name="check" :size="12" />
            <span>Connecting to <strong>{{ linkTarget.title }}</strong></span>
          </div>

          <input
            v-model="linkTitle"
            placeholder="Why are they linked? (e.g. shared-mechanism, contrast, analogy…)"
            class="rkz-input form-input font-mono-meta"
            @keydown.enter.prevent="createLink"
          />

          <div class="form-actions">
            <button type="button" class="rkz-btn mini-btn" @click.stop="closeNewLink">Cancel</button>
            <button
              type="button"
              class="rkz-btn rkz-btn-primary mini-btn"
              :disabled="!linkTarget"
              @click.stop="createLink"
            >
              Create Link
            </button>
          </div>
        </div>
      </div>

      <!-- Vault File Location (@hir) -->
      <div v-if="editable" class="loc-row">
        <span class="loc-label select-none">
          <Icon name="folder" :size="12" />
          <span class="rkz-label">File Path</span>
        </span>
        <input
          :value="liveCard.hierarchy || ''"
          placeholder="folder/subfolder (blank saves to <subject>.mns)"
          class="rkz-input font-mono-meta loc-input"
          @change="set('hierarchy', ($event.target as HTMLInputElement).value.trim())"
        />
      </div>
    </div>

    <!-- Bottom Metadata & Actions Bar -->
    <div class="card-foot select-none">
      <div class="foot-left">
        <ConfirmButton
          v-if="editable"
          label="Delete"
          confirm-label="Delete card?"
          @confirm="remove(liveCard.sid)"
        />
        <span v-if="editable" class="autosave-hint">Autosaves locally</span>
      </div>

      <div class="foot-right">
        <span class="rkz-label">Strength</span>
        <StarRating
          :model-value="liveCard.importance"
          :readonly="!editable"
          @update:model-value="set('importance', $event)"
        />
      </div>
    </div>
  </article>
</template>

<style scoped>
.card-shell {
  container-type: inline-size;
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  background-color: var(--bg-surface);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-sm);
  overflow: hidden;
}

.card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  height: 46px;
  padding: 0 18px;
  border-bottom: 1px solid var(--border-subtle);
  flex-shrink: 0;
}

.head-left {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.nav-arrows {
  display: inline-flex;
  align-items: center;
  gap: 2px;
}

.nav-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  border-radius: var(--radius-xs);
  border: 1px solid var(--border-subtle);
  background-color: var(--bg-input);
  color: var(--text-secondary);
  cursor: pointer;
  transition: background-color var(--ease-fast), color var(--ease-fast), border-color var(--ease-fast);
}

.nav-btn:hover:not(:disabled) {
  background-color: var(--bg-hover);
  border-color: var(--border-default);
  color: var(--text-primary);
}

.nav-btn:disabled {
  opacity: 0.35;
  cursor: default;
}

.pos-badge {
  font-size: 11px;
  color: var(--text-muted);
  padding: 0 4px;
}

.subject-tag {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 11.5px;
  font-weight: 600;
  color: var(--text-secondary);
  max-width: 150px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.subject-dot {
  width: 7px;
  height: 7px;
  border-radius: 999px;
  flex-shrink: 0;
}

.type-group {
  display: inline-flex;
  gap: 2px;
  padding: 2px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border-subtle);
  background-color: var(--bg-input);
}

.type-btn {
  height: 24px;
  padding: 0 11px;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: var(--text-muted);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  cursor: pointer;
  transition: background-color var(--ease-fast), color var(--ease-fast);
}

.type-btn:hover:not(:disabled):not(.is-active) {
  color: var(--text-primary);
}

.type-btn.is-active {
  background-color: var(--accent-subtle);
  color: var(--accent);
}

.review-pill {
  font-size: 11px;
  font-weight: 500;
  padding: 3px 8px;
  border-radius: 999px;
  border: 1px solid var(--border-subtle);
  background-color: var(--bg-input);
  color: var(--text-muted);
  white-space: nowrap;
}

.review-pill.is-due {
  border-color: var(--bridge-border);
  background-color: var(--bridge-subtle);
  color: var(--bridge);
  font-weight: 600;
}

.card-body {
  display: flex;
  flex-direction: column;
  gap: 18px;
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 22px 24px;
}

.title-input {
  width: 100%;
  border: none;
  background: transparent;
  padding: 2px 0;
  font-size: 24px;
  font-weight: 650;
  letter-spacing: -0.02em;
  line-height: 1.25;
  color: var(--text-primary);
  outline: none;
}

.title-input:focus-visible {
  box-shadow: none;
}

.title-input::placeholder {
  color: var(--text-muted);
  font-weight: 500;
}

.title-input.is-compact,
.title-heading.is-compact {
  font-size: 20px;
}

.title-heading {
  margin: 0;
  font-size: 24px;
  font-weight: 650;
  letter-spacing: -0.02em;
  line-height: 1.25;
}

.section-block {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.tag-hint {
  font-size: 11px;
  color: var(--text-muted);
}

.context-area {
  width: 100%;
  min-height: 108px;
  flex: 1;
  padding: 12px 14px;
  font-size: 14px;
  line-height: 1.65;
  resize: vertical;
  font-family: var(--font-sans);
}

.depth-meta {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.depth-pill {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding: 2px 6px;
  border-radius: var(--radius-xs);
  border: 1px solid var(--border-subtle);
  background-color: var(--bg-input);
  font-size: 10px;
}

.depth-step {
  color: var(--text-muted);
  opacity: 0.45;
}

.depth-step.is-lit {
  color: var(--text-primary);
  opacity: 1;
  font-weight: 600;
}

.bridge-state-pill {
  font-size: 10.5px;
  font-weight: 600;
  padding: 2px 7px;
  border-radius: 999px;
  border: 1px solid var(--border-subtle);
}

.bridge-state-pill.is-bridged {
  border-color: var(--bridge-border);
  background-color: var(--bridge-subtle);
  color: var(--bridge);
}

.bridge-state-pill.is-island {
  background-color: var(--bg-input);
  color: var(--text-muted);
}

.roots-block {
  padding-top: 2px;
}

.roots-badge {
  font-size: 10px;
  font-weight: 600;
  padding: 1px 6px;
  border-radius: var(--radius-xs);
  background-color: var(--accent-subtle);
  color: var(--accent);
}

.roots-opt {
  font-size: 10.5px;
  color: var(--text-muted);
}

.roots-preview {
  display: block;
  width: 100%;
  padding: 8px 12px;
  border: 1px dashed var(--border-subtle);
  border-radius: var(--radius-sm);
  background-color: var(--bg-input);
  color: var(--text-secondary);
  font-size: 12.5px;
  line-height: 1.5;
  text-align: start;
  cursor: pointer;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  transition: border-color var(--ease-fast), color var(--ease-fast);
}

.roots-preview:hover {
  border-color: var(--border-strong);
  color: var(--text-primary);
}

.roots-area {
  width: 100%;
  min-height: 82px;
  padding: 10px 12px;
  font-size: 13px;
  line-height: 1.6;
  resize: vertical;
  font-family: var(--font-sans);
}

.context-prose {
  margin: 0;
  font-size: 14px;
  line-height: 1.65;
  color: var(--text-secondary);
  white-space: pre-wrap;
}

.readonly-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.readonly-tag {
  font-size: 11.5px;
  padding: 2px 8px;
  border-radius: var(--radius-xs);
  border: 1px solid var(--border-default);
  background-color: var(--bg-input);
  color: var(--text-secondary);
}

.muted-note {
  font-size: 12px;
  color: var(--text-muted);
}

.collapse-trigger {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  border: none;
  background: transparent;
  padding: 0;
  color: var(--text-muted);
  cursor: pointer;
}

.link-count {
  font-size: 11px;
  font-weight: 600;
  color: var(--text-secondary);
}

.toggle-word {
  font-size: 11px;
  color: var(--accent);
  font-weight: 500;
}

.mini-btn {
  height: 24px;
  padding: 0 8px;
  font-size: 11px;
}

.link-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.link-row {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.edge-chip {
  height: 24px;
  padding: 0 8px;
  border-radius: var(--radius-xs);
  border: 1px solid var(--border-default);
  background-color: var(--bg-input);
  color: var(--text-secondary);
  font-size: 11.5px;
  cursor: pointer;
  flex-shrink: 0;
  transition: border-color var(--ease-fast), color var(--ease-fast);
}

.edge-chip:hover {
  border-color: var(--accent-border);
  color: var(--accent);
}

.edge-chip.is-bridge {
  border-color: var(--bridge-border);
  background-color: var(--bridge-subtle);
  color: var(--bridge);
}

.rename-input {
  width: 170px;
  height: 24px;
  padding: 0 8px;
  font-size: 11.5px;
}

.edge-arrow {
  color: var(--text-muted);
  flex-shrink: 0;
}

.target-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  max-width: 280px;
  height: 24px;
  padding: 0 9px;
  border-radius: var(--radius-xs);
  border: 1px solid var(--border-subtle);
  background-color: var(--bg-input);
  color: var(--text-primary);
  font-size: 12px;
  cursor: pointer;
  transition: background-color var(--ease-fast), border-color var(--ease-fast);
}

.target-btn:hover {
  background-color: var(--bg-hover);
  border-color: var(--border-strong);
}

.bridge-dot {
  width: 6px;
  height: 6px;
  border-radius: 999px;
  background-color: var(--bridge);
  flex-shrink: 0;
}

.new-link-form {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 10px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border-default);
  background-color: var(--bg-input);
}

.form-input {
  height: 30px;
  padding: 0 9px;
  font-size: 12px;
}

.picker-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
  max-height: 132px;
  overflow-y: auto;
}

.picker-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  width: 100%;
  padding: 5px 8px;
  border: none;
  border-radius: var(--radius-xs);
  background: transparent;
  color: var(--text-primary);
  font-size: 12px;
  text-align: left;
  cursor: pointer;
}

.picker-row:hover {
  background-color: var(--bg-hover);
}

.picker-subj {
  font-size: 10.5px;
  color: var(--text-muted);
  flex-shrink: 0;
}

.picked-target {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11.5px;
  color: var(--ok);
}

.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 6px;
}

.loc-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding-top: 2px;
}

.loc-label {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  color: var(--text-muted);
  flex-shrink: 0;
}

.loc-input {
  height: 28px;
  padding: 0 9px;
  font-size: 11.5px;
  color: var(--text-secondary);
}

.card-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  height: 46px;
  padding: 0 18px;
  background-color: var(--bg-sidebar);
  border-top: 1px solid var(--border-subtle);
  flex-shrink: 0;
}

.foot-left,
.foot-right {
  display: flex;
  align-items: center;
  gap: 10px;
}

.autosave-hint {
  font-size: 11px;
  color: var(--text-muted);
  white-space: nowrap;
}

@container (max-width: 560px) {
  .tag-hint,
  .autosave-hint,
  .subject-tag {
    display: none;
  }
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
}
</style>
