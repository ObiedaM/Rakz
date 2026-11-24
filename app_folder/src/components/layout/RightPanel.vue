<script setup lang="ts">
// Right Connections Panel — Surfaces Suggested Bridges, Outgoing Links, AND
// Incoming Backlinks (fixing the asymmetric "0 linked" bug on linked targets).

import { computed } from "vue";
import { useLibrary } from "@/composables/library";
import type { Memonic } from "@/composables/library";
import { useAgent } from "@/composables/useAgent";
import Icon from "@/components/ui/Icon.vue";

const emit = defineEmits<{ "jump-card": [] }>();

const {
  active,
  subjects,
  activeLinks,
  activeBacklinks,
  activeSuggestions,
  link,
  unlink,
  select,
} = useLibrary();

const { openAsk } = useAgent();

function subjectOf(id: string) {
  return subjects.value.find((s) => s.id === id);
}

function linkTitleFor(a: Memonic, b: Memonic): string {
  const bt = new Set(b.tags.map((t) => t.toLowerCase()));
  return a.tags.find((t) => bt.has(t.toLowerCase())) ?? "related";
}

function jump(sid: number): void {
  select(sid);
  emit("jump-card");
}

const activeCard = computed(() => active.value);
const totalConnected = computed(() => activeLinks.value.length + activeBacklinks.value.length);
const hasNothing = computed(
  () =>
    activeSuggestions.value.length === 0 &&
    activeLinks.value.length === 0 &&
    activeBacklinks.value.length === 0,
);
</script>

<template>
  <aside class="right-panel select-none">
    <!-- Header (compact, never overflows even at 240px width) -->
    <div class="panel-head">
      <div class="head-title-wrap">
        <span class="rkz-label panel-heading">Connections</span>
        <span class="count-pill tabular">{{ totalConnected }}</span>
      </div>

      <button
        v-if="activeCard"
        type="button"
        class="rkz-btn rkz-btn-accent-soft copilot-btn"
        title="Open Restrained AI Co-Pilot (Ctrl+J)"
        @click="openAsk()"
      >
        <Icon name="sparkles" :size="12" />
        <span>Co-Pilot</span>
      </button>
    </div>

    <!-- Scrollable Connections Body -->
    <div class="panel-body rkz-scroll">
      <!-- SUGGESTED BRIDGES -->
      <section v-if="activeSuggestions.length > 0" class="conn-section">
        <div class="section-head">
          <span class="rkz-label">Suggested Bridges</span>
          <span class="sec-count tabular">{{ activeSuggestions.length }}</span>
        </div>

        <div class="card-stack">
          <div
            v-for="s in activeSuggestions"
            :key="s.memonic.sid"
            class="conn-card"
            :class="{ 'is-cross': s.cross }"
          >
            <div class="conn-meta">
              <span class="meta-subj">
                <span class="subj-dot" :style="{ backgroundColor: subjectOf(s.memonic.id)?.color || 'var(--text-muted)' }" />
                <span class="truncate">{{ subjectOf(s.memonic.id)?.name || s.memonic.id }}</span>
              </span>
              <span class="score-pill tabular font-mono-meta">score {{ s.score }}</span>
            </div>

            <button type="button" dir="auto" class="conn-title" @click="jump(s.memonic.sid)">
              {{ s.memonic.title }}
            </button>

            <div v-if="s.sharedTags.length" class="shared-row">
              <span v-for="t in s.sharedTags.slice(0, 3)" :key="t" class="shared-tag font-mono-meta">
                #{{ t }}
              </span>
            </div>

            <button
              v-if="activeCard"
              type="button"
              class="rkz-btn rkz-btn-primary link-cta"
              @click.prevent="link(activeCard.sid, s.memonic.sid, linkTitleFor(activeCard, s.memonic))"
            >
              <Icon :name="s.cross ? 'bridge' : 'link'" :size="13" />
              <span>{{ s.cross ? "Build Cross-Subject Bridge" : "Link Concept" }}</span>
            </button>
          </div>
        </div>
      </section>

      <!-- OUTGOING LINKS -->
      <section v-if="activeLinks.length > 0" class="conn-section">
        <div class="section-head">
          <span class="rkz-label">Linked From This Card</span>
          <span class="sec-count tabular">{{ activeLinks.length }}</span>
        </div>

        <div class="card-stack">
          <div
            v-for="l in activeLinks"
            :key="`out-${l.memonic.sid}-${l.title}`"
            class="conn-card"
            :class="{ 'is-cross': l.cross }"
          >
            <div class="conn-meta">
              <span class="meta-subj">
                <span class="subj-dot" :style="{ backgroundColor: subjectOf(l.memonic.id)?.color || 'var(--text-muted)' }" />
                <span class="truncate">{{ subjectOf(l.memonic.id)?.name || l.memonic.id }}</span>
              </span>
              <span v-if="l.cross" class="bridge-badge">Bridge</span>
            </div>

            <button type="button" dir="auto" class="conn-title" @click="jump(l.memonic.sid)">
              {{ l.memonic.title }}
            </button>

            <div class="conn-foot">
              <span class="edge-pill font-mono-meta" :class="{ 'is-cross': l.cross }" :title="`#${l.title || 'related'}`">
                #{{ l.title || "related" }}
              </span>
              <button
                v-if="activeCard"
                type="button"
                class="unlink-btn"
                title="Remove link"
                aria-label="Remove link"
                @click.prevent="unlink(activeCard.sid, l.memonic.sid)"
              >
                <Icon name="unlink" :size="12" />
              </button>
            </div>
          </div>
        </div>
      </section>

      <!-- INCOMING BACKLINKS -->
      <section v-if="activeBacklinks.length > 0" class="conn-section">
        <div class="section-head">
          <span class="rkz-label">Referenced By (Backlinks)</span>
          <span class="sec-count tabular">{{ activeBacklinks.length }}</span>
        </div>

        <div class="card-stack">
          <div
            v-for="b in activeBacklinks"
            :key="`in-${b.memonic.sid}-${b.title}`"
            class="conn-card"
            :class="{ 'is-cross': b.cross }"
          >
            <div class="conn-meta">
              <span class="meta-subj">
                <span class="subj-dot" :style="{ backgroundColor: subjectOf(b.memonic.id)?.color || 'var(--text-muted)' }" />
                <span class="truncate">{{ subjectOf(b.memonic.id)?.name || b.memonic.id }}</span>
              </span>
              <span v-if="b.cross" class="bridge-badge">Bridge</span>
            </div>

            <button type="button" dir="auto" class="conn-title" @click="jump(b.memonic.sid)">
              {{ b.memonic.title }}
            </button>

            <div class="conn-foot">
              <span class="edge-pill font-mono-meta" :class="{ 'is-cross': b.cross }" :title="`← #${b.title || 'related'}`">
                ← #{{ b.title || "related" }}
              </span>
              <button
                v-if="activeCard"
                type="button"
                class="unlink-btn"
                title="Remove incoming link"
                aria-label="Remove incoming link"
                @click.prevent="unlink(b.memonic.sid, activeCard.sid)"
              >
                <Icon name="unlink" :size="12" />
              </button>
            </div>
          </div>
        </div>
      </section>

      <!-- EMPTY STATE -->
      <div v-if="hasNothing" class="empty-conn">
        <Icon name="bridge" :size="20" />
        <p class="empty-heading">Isolated island</p>
        <p class="empty-desc">
          Add shared <code class="font-mono-meta">#concept</code> tags across subjects to turn isolated facts into cross-discipline bridges.
        </p>
      </div>
    </div>

    <!-- Restrained Co-Pilot Quick Scaffolds -->
    <div v-if="activeCard" class="panel-foot">
      <button type="button" class="quick-btn" @click="openAsk('quiz')">
        <Icon name="study" :size="12" />
        <span>Quiz Me</span>
      </button>
      <button type="button" class="quick-btn" @click="openAsk('bridges')">
        <Icon name="bridge" :size="12" />
        <span>Find Bridges</span>
      </button>
    </div>
  </aside>
</template>

<style scoped>
.right-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  background-color: var(--bg-panel);
}

.panel-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  height: 46px;
  padding: 0 14px;
  border-bottom: 1px solid var(--border-subtle);
  flex-shrink: 0;
}

.head-title-wrap {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}

.panel-heading {
  color: var(--text-secondary);
}

.count-pill {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 19px;
  height: 18px;
  padding: 0 6px;
  border-radius: 999px;
  background-color: var(--bg-hover);
  color: var(--text-primary);
  font-size: 10.5px;
  font-weight: 600;
}

.copilot-btn {
  height: 26px;
  padding: 0 9px;
  font-size: 11.5px;
  flex-shrink: 0;
}

.panel-body {
  display: flex;
  flex-direction: column;
  gap: 18px;
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 14px;
}

.conn-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 2px;
}

.sec-count {
  font-size: 11px;
  color: var(--text-muted);
}

.card-stack {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.conn-card {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px;
  border-radius: var(--radius-md);
  border: 1px solid var(--border-subtle);
  background-color: var(--bg-surface);
  transition: border-color var(--ease-fast);
}

.conn-card:hover {
  border-color: var(--border-strong);
}

.conn-card.is-cross {
  border-left: 2.5px solid var(--bridge);
}

.conn-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.meta-subj {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  font-size: 10.5px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--text-muted);
}

.subj-dot {
  width: 6px;
  height: 6px;
  border-radius: 999px;
  flex-shrink: 0;
}

.score-pill {
  font-size: 10.5px;
  color: var(--accent);
  font-weight: 600;
  flex-shrink: 0;
}

.bridge-badge {
  font-size: 9.5px;
  font-weight: 700;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  padding: 2px 6px;
  border-radius: var(--radius-xs);
  background-color: var(--bridge-subtle);
  color: var(--bridge);
  flex-shrink: 0;
}

.conn-title {
  border: none;
  background: transparent;
  padding: 0;
  text-align: left;
  font-size: 13px;
  font-weight: 600;
  line-height: 1.35;
  color: var(--text-primary);
  cursor: pointer;
}

.conn-title:hover {
  color: var(--accent);
}

.shared-row {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.shared-tag {
  font-size: 10.5px;
  padding: 1px 6px;
  border-radius: 3px;
  background-color: var(--bridge-subtle);
  color: var(--bridge);
}

.link-cta {
  width: 100%;
  height: 28px;
  font-size: 11.5px;
}

.conn-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding-top: 2px;
}

.edge-pill {
  font-size: 11px;
  padding: 2px 7px;
  border-radius: var(--radius-xs);
  border: 1px solid var(--border-subtle);
  background-color: var(--bg-input);
  color: var(--text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.edge-pill.is-cross {
  border-color: var(--bridge-border);
  background-color: var(--bridge-subtle);
  color: var(--bridge);
}

.unlink-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border: none;
  border-radius: var(--radius-xs);
  background: transparent;
  padding: 0;
  color: var(--text-muted);
  cursor: pointer;
  flex-shrink: 0;
  opacity: 0;
  transition: opacity var(--ease-fast), background-color var(--ease-fast), color var(--ease-fast);
}

.conn-card:hover .unlink-btn,
.unlink-btn:focus-visible {
  opacity: 1;
}

.unlink-btn:hover {
  background-color: var(--danger-subtle);
  color: var(--danger);
}

.empty-conn {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 32px 12px;
  text-align: center;
  color: var(--text-muted);
}

.empty-heading {
  margin: 0;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-secondary);
}

.empty-desc {
  margin: 0;
  font-size: 12px;
  line-height: 1.55;
  color: var(--text-muted);
}

.panel-foot {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px;
  padding: 10px 12px;
  border-top: 1px solid var(--border-subtle);
  flex-shrink: 0;
}

.quick-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  height: 28px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border-default);
  background-color: var(--bg-surface);
  color: var(--text-secondary);
  font-size: 11.5px;
  font-weight: 500;
  cursor: pointer;
  transition: background-color var(--ease-fast), color var(--ease-fast), border-color var(--ease-fast);
}

.quick-btn:hover {
  background-color: var(--bg-hover);
  border-color: var(--border-strong);
  color: var(--text-primary);
}
</style>
