<script setup lang="ts">
// Central viewport switching cleanly between Stack, Study (Active Recall), Grid, and Graph.

import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useLibrary } from "@/composables/library";
import type { Memonic } from "@/composables/library";
import MnemonicCard from "@/components/viewer/MnemonicCard.vue";
import StudyMode from "@/components/viewer/StudyMode.vue";
import GraphView from "@/components/graph/GraphView.vue";
import Dialog from "@/components/ui/Dialog.vue";
import StarRating from "@/components/ui/StarRating.vue";
import Icon from "@/components/ui/Icon.vue";

const props = withDefaults(
  defineProps<{
    view?: "stack" | "study" | "grid" | "graph";
    sort?: string;
    filterTag?: string;
  }>(),
  { view: "stack", sort: "recent", filterTag: "" },
);

const emit = defineEmits<{ "open-stack": [] }>();

const { deck, subjects, memonics, activeSid, select, create, linkCount, isCardDue } = useLibrary();

const modalId = ref<number | null>(null);
const modalMemonic = computed<Memonic | undefined>(() =>
  memonics.value.find((m) => m.sid === modalId.value),
);

function processList(list: Memonic[]): Memonic[] {
  let arr = [...list];
  if (props.filterTag) {
    const f = props.filterTag.toLowerCase().replace(/^#/, "");
    arr = arr.filter((m) => m.tags && m.tags.some((t) => t.toLowerCase().includes(f)));
  }
  if (props.sort === "recent") arr.sort((a, b) => b.sid - a.sid);
  else if (props.sort === "importance") arr.sort((a, b) => (b.importance || 0) - (a.importance || 0));
  else if (props.sort === "linked") arr.sort((a, b) => linkCount(b) - linkCount(a));
  return arr;
}

const visibleDeck = computed(() => processList(deck.value));

const activeCardInStack = computed<Memonic | null>(() => {
  const arr = visibleDeck.value;
  if (!arr.length) return null;
  return arr.find((m) => m.sid === activeSid.value) ?? arr[0] ?? null;
});

watch(visibleDeck, () => {
  if (props.view !== "stack") return;
  const arr = visibleDeck.value;
  if (arr.length && !arr.some((m) => m.sid === activeSid.value)) {
    select(arr[0]!.sid);
  }
});

const groupedGrid = computed(() => {
  const allProcessed = processList(memonics.value);
  return subjects.value
    .map((s) => ({ subject: s, cards: allProcessed.filter((m) => m.id === s.id) }))
    .filter((g) => g.cards.length > 0);
});

watch(modalMemonic, (m) => {
  if (modalId.value != null && !m) modalId.value = null;
});

watch(activeSid, (sid) => {
  if (modalId.value != null && sid != null && sid !== modalId.value) modalId.value = sid;
});

function onKey(e: KeyboardEvent): void {
  if (props.view !== "stack" || !e.altKey) return;
  if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
  const list = visibleDeck.value;
  if (list.length < 2 || activeSid.value == null) return;
  e.preventDefault();
  const i = list.findIndex((m) => m.sid === activeSid.value);
  const dir = e.key === "ArrowRight" ? 1 : -1;
  select(list[(i + dir + list.length) % list.length]!.sid);
}

onMounted(() => window.addEventListener("keydown", onKey));
onBeforeUnmount(() => window.removeEventListener("keydown", onKey));
</script>

<template>
  <div class="viewer-root">
    <!-- STUDY VIEW (Active Recall + Spaced Repetition) -->
    <StudyMode v-if="view === 'study'" @open-stack="emit('open-stack')" />

    <!-- GRID VIEW -->
    <div v-else-if="view === 'grid'" class="grid-scroll rkz-scroll">
      <div v-if="groupedGrid.length" class="grid-inner">
        <section v-for="group in groupedGrid" :key="group.subject.id" class="grid-group">
          <div class="group-head select-none">
            <span class="group-dot" :style="{ backgroundColor: group.subject.color }" />
            <h2 class="group-title">{{ group.subject.name }}</h2>
            <span class="group-count tabular">{{ group.cards.length }}</span>
          </div>

          <div class="card-grid">
            <button
              v-for="card in group.cards"
              :key="card.sid"
              type="button"
              class="grid-card"
              :class="{ 'is-active': card.sid === activeSid }"
              @click="
                modalId = card.sid;
                select(card.sid);
              "
            >
              <div class="grid-accent" :style="{ backgroundColor: group.subject.color }" />

              <div class="grid-card-top">
                <span class="grid-type">{{ card.type }}</span>
                <div class="grid-badges tabular">
                  <span v-if="linkCount(card) > 0" class="grid-meta-pill">
                    <Icon name="link" :size="11" />
                    {{ linkCount(card) }}
                  </span>
                  <span v-if="isCardDue(card)" class="grid-due-pill">Due</span>
                </div>
              </div>

              <h3 dir="auto" class="grid-card-title">{{ card.title || "Untitled mnemonic" }}</h3>

              <p dir="auto" class="grid-card-ctx">
                {{ card.context || "No explanation yet." }}
              </p>

              <div v-if="card.tags.length" class="grid-tags">
                <span v-for="t in card.tags.slice(0, 3)" :key="t" class="grid-tag font-mono-meta">#{{ t }}</span>
                <span v-if="card.tags.length > 3" class="grid-tag-more tabular">+{{ card.tags.length - 3 }}</span>
              </div>

              <div class="grid-card-foot">
                <StarRating :model-value="card.importance" :size="13" :readonly="true" />
                <span class="grid-status">{{ card.status || "active" }}</span>
              </div>
            </button>
          </div>
        </section>
      </div>

      <!-- Grid Empty State -->
      <div v-else class="empty-stage select-none">
        <Icon name="grid" :size="24" />
        <p class="empty-title">No mnemonics match this filter.</p>
        <button type="button" class="rkz-btn rkz-btn-primary" @click="create()">
          <Icon name="plus" :size="13" />
          <span>New Mnemonic</span>
        </button>
      </div>

      <!-- Grid Card Inspector Modal -->
      <Dialog :open="!!modalId" width="740px" @close="modalId = null">
        <div class="grid-modal-box">
          <MnemonicCard v-if="modalMemonic" :memonic="modalMemonic" :editable="true" />
        </div>
      </Dialog>
    </div>

    <!-- GRAPH VIEW -->
    <GraphView v-else-if="view === 'graph'" :filter-tag="filterTag" @open-stack="emit('open-stack')" />

    <!-- STACK STUDIO VIEW -->
    <div v-else class="stack-stage">
      <div v-if="activeCardInStack" class="stack-frame">
        <div v-if="visibleDeck.length > 1" class="stack-paper-back" aria-hidden="true" />
        <MnemonicCard :memonic="activeCardInStack" :editable="true" />
      </div>

      <div v-else class="empty-stage select-none">
        <Icon name="stack" :size="24" />
        <p class="empty-title">
          {{ filterTag ? `No cards tagged "${filterTag}" in this subject.` : "No mnemonic cards yet." }}
        </p>
        <button type="button" class="rkz-btn rkz-btn-primary" @click="create()">
          <Icon name="plus" :size="13" />
          <span>Create Mnemonic</span>
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.viewer-root {
  position: relative;
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  overflow: hidden;
  background-color: var(--bg-root);
}

/* Stack Studio */
.stack-stage {
  display: flex;
  flex: 1;
  min-height: 0;
  align-items: center;
  justify-content: center;
  padding: 20px 24px;
}

.stack-frame {
  position: relative;
  width: 100%;
  max-width: 780px;
  height: 100%;
  max-height: 760px;
  z-index: 1;
}

.stack-paper-back {
  position: absolute;
  inset: 8px -6px -6px 8px;
  border-radius: var(--radius-lg);
  border: 1px solid var(--border-subtle);
  background-color: var(--bg-sidebar);
  z-index: -1;
  pointer-events: none;
}

/* Grid View */
.grid-scroll {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 24px 28px 36px;
}

.grid-inner {
  max-width: 1200px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 28px;
}

.grid-group {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.group-head {
  display: flex;
  align-items: center;
  gap: 8px;
}

.group-dot {
  width: 8px;
  height: 8px;
  border-radius: 999px;
}

.group-title {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
}

.group-count {
  font-size: 11.5px;
  color: var(--text-muted);
}

.card-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 14px;
}

.grid-card {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-height: 184px;
  padding: 16px 16px 12px;
  border-radius: var(--radius-md);
  border: 1px solid var(--border-subtle);
  background-color: var(--bg-surface);
  text-align: left;
  cursor: pointer;
  overflow: hidden;
  transition: border-color var(--ease-fast), transform var(--ease-fast), box-shadow var(--ease-fast);
}

.grid-card:hover {
  border-color: var(--border-strong);
  transform: translateY(-2px);
  box-shadow: var(--shadow-md);
}

.grid-card.is-active {
  border-color: var(--accent-border);
}

.grid-accent {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 2.5px;
}

.grid-card-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.grid-type {
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--text-muted);
}

.grid-badges {
  display: flex;
  align-items: center;
  gap: 6px;
}

.grid-meta-pill {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  font-size: 10.5px;
  color: var(--text-secondary);
}

.grid-due-pill {
  font-size: 10px;
  font-weight: 600;
  padding: 1px 6px;
  border-radius: 999px;
  background-color: var(--bridge-subtle);
  color: var(--bridge);
}

.grid-card-title {
  margin: 0;
  font-size: 14.5px;
  font-weight: 600;
  line-height: 1.35;
  color: var(--text-primary);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.grid-card-ctx {
  margin: 0;
  font-size: 12.5px;
  line-height: 1.5;
  color: var(--text-secondary);
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.grid-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-top: auto;
  padding-top: 4px;
}

.grid-tag {
  font-size: 10.5px;
  padding: 1px 6px;
  border-radius: 3px;
  background-color: var(--bg-input);
  border: 1px solid var(--border-subtle);
  color: var(--text-muted);
}

.grid-tag-more {
  font-size: 10.5px;
  color: var(--text-muted);
}

.grid-card-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-top: 8px;
  border-top: 1px solid var(--border-subtle);
}

.grid-status {
  font-size: 10.5px;
  text-transform: capitalize;
  color: var(--text-muted);
}

.grid-modal-box {
  height: 620px;
}

.empty-stage {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  flex: 1;
  min-height: 260px;
  color: var(--text-muted);
  text-align: center;
}

.empty-title {
  margin: 0;
  font-size: 13.5px;
  color: var(--text-secondary);
}
</style>
