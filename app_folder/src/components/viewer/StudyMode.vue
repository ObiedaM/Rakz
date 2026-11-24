<script setup lang="ts">
// Sustained Active Recall & Spaced Repetition Studio.
// Grounds RAKZ in peer-reviewed memory science (Roediger & Karpicke 2006
// retrieval practice; Dunlosky 2013 elaborative self-explanation; Cepeda 2006
// & Mawson & Kang 2025 distributed spacing; Bjork 1994 desirable difficulties)
// and the 3-layer mental-model philosophy (Islands -> Bridges -> Mother
// Paradigm, and L1 Condensed Hook -> L2 Core -> L3 Deep Roots).

import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useLibrary } from "@/composables/library";
import type { Memonic, RecallGrade } from "@/composables/library";
import { useAgent } from "@/composables/useAgent";
import Icon from "@/components/ui/Icon.vue";
import SelectMenu from "@/components/ui/SelectMenu.vue";

type QueueMode = "due" | "fragile" | "all";
type RecallCueId = "mechanism" | "why" | "transfer";

const RECALL_CUES: { id: RecallCueId; label: string; prompt: string; placeholder: string }[] = [
  {
    id: "mechanism",
    label: "Mechanism",
    prompt: "Recall the core rule & explain how it works",
    placeholder: "Explain the concept from memory in your own words before revealing…",
  },
  {
    id: "why",
    label: "Ask Why",
    prompt: "Elaborative interrogation — why does this hold from first principles?",
    placeholder: "Why is this true? What breaks if one variable or assumption changes?",
  },
  {
    id: "transfer",
    label: "Transfer",
    prompt: "Connect this pattern to another subject or real-world case",
    placeholder: "Where else does this underlying mechanism appear across disciplines?",
  },
];

const emit = defineEmits<{ "open-stack": [] }>();

const {
  memonics,
  subjects,
  dueCards,
  studyStats,
  sustainedMetrics,
  recordReview,
  previewIntervals,
  select,
  getReviewRecord,
  getDeepRoots,
} = useLibrary();

const { openAsk } = useAgent();

const subjectFilter = ref<string>("all");
const subjectOptions = computed(() => [
  { id: "all", label: "All subjects" },
  ...subjects.value.map((s) => ({ id: s.id, label: s.name })),
]);

const queueMode = ref<QueueMode>("due");
const healthOpen = ref(false);
const recallCue = ref<RecallCueId>("mechanism");
const hintShown = ref(false);
const revealed = ref(false);
const recallDraft = ref("");
const sessionReviewed = ref(0);
const practiceIndex = ref(0);

const activeCue = computed(
  () => RECALL_CUES.find((c) => c.id === recallCue.value) ?? RECALL_CUES[0]!,
);

const queue = computed<Memonic[]>(() => {
  let pool: Memonic[];
  if (queueMode.value === "all") pool = memonics.value;
  else if (queueMode.value === "fragile") pool = sustainedMetrics.value.fragileCards;
  else pool = dueCards.value;
  if (subjectFilter.value === "all") return pool;
  return pool.filter((m) => m.id === subjectFilter.value);
});

const currentCard = computed<Memonic | null>(() => {
  const list = queue.value;
  if (!list.length) return null;
  if (queueMode.value === "all") return list[practiceIndex.value % list.length] ?? null;
  return list[0] ?? null;
});

watch(
  currentCard,
  (card) => {
    hintShown.value = false;
    revealed.value = false;
    recallDraft.value = "";
    if (card) select(card.sid);
  },
  { immediate: true },
);

const cardSubject = computed(() =>
  currentCard.value ? subjects.value.find((s) => s.id === currentCard.value!.id) : null,
);

const intervals = computed(() =>
  currentCard.value ? previewIntervals(currentCard.value) : null,
);

const cardRecord = computed(() =>
  currentCard.value ? getReviewRecord(currentCard.value) : undefined,
);

const currentRoots = computed(() =>
  currentCard.value ? getDeepRoots(currentCard.value).trim() : "",
);

const bridgesForCurrent = computed(() => {
  const c = currentCard.value;
  if (!c) return [];
  const out: { card: Memonic; title: string; cross: boolean; dir: "out" | "in" }[] = [];
  for (const l of c.links) {
    const t = memonics.value.find((m) => m.sid === l.targetSID);
    if (t) out.push({ card: t, title: l.title, cross: t.id !== c.id, dir: "out" });
  }
  for (const o of memonics.value) {
    if (o.sid === c.sid) continue;
    for (const l of o.links) {
      if (l.targetSID === c.sid) {
        out.push({ card: o, title: l.title, cross: o.id !== c.id, dir: "in" });
      }
    }
  }
  return out;
});

const crossSubjectHintNames = computed(() => {
  const names = new Set<string>();
  for (const b of bridgesForCurrent.value) {
    if (b.cross) names.add(b.card.id);
  }
  return [...names];
});

const hasHintMaterial = computed(() => {
  if (!currentCard.value) return false;
  return currentCard.value.tags.length > 0 || bridgesForCurrent.value.length > 0;
});

const tierPcts = computed(() => {
  const total = Math.max(1, memonics.value.length);
  const t = sustainedMetrics.value.tiers;
  return {
    durable: (t.durableCount / total) * 100,
    learning: (t.learningCount / total) * 100,
    fragile: (t.fragileCount / total) * 100,
    newPct: (t.newCount / total) * 100,
  };
});

function cycleQueueMode(): void {
  if (queueMode.value === "due") {
    queueMode.value = sustainedMetrics.value.fragileCards.length > 0 ? "fragile" : "all";
  } else if (queueMode.value === "fragile") {
    queueMode.value = "all";
  } else {
    queueMode.value = "due";
  }
  practiceIndex.value = 0;
}

const queueModeLabel = computed(() => {
  if (queueMode.value === "fragile") return "Mode: Fragile decay";
  if (queueMode.value === "all") return "Mode: Practice all";
  return "Mode: Due queue";
});

function grade(g: RecallGrade): void {
  if (!currentCard.value) return;
  recordReview(currentCard.value, g);
  sessionReviewed.value += 1;
  hintShown.value = false;
  revealed.value = false;
  recallDraft.value = "";
  if (queueMode.value === "all") {
    practiceIndex.value += 1;
  }
}

function jumpToCard(sid: number): void {
  select(sid);
  emit("open-stack");
}

function openFirstIsland(): void {
  const island = sustainedMetrics.value.isolatedIslands[0];
  if (!island) return;
  jumpToCard(island.sid);
}

function startFragileReview(): void {
  subjectFilter.value = "all";
  queueMode.value = "fragile";
  practiceIndex.value = 0;
}

function activityLevel(count: number): number {
  if (count <= 0) return 0;
  if (count <= 2) return 1;
  if (count <= 5) return 2;
  return 3;
}

function onKey(e: KeyboardEvent): void {
  const tag = (e.target as HTMLElement | null)?.tagName;
  if (tag === "TEXTAREA" || tag === "INPUT" || tag === "SELECT") return;
  if (!currentCard.value) return;

  if ((e.key === "h" || e.key === "H") && !revealed.value && hasHintMaterial.value) {
    e.preventDefault();
    hintShown.value = !hintShown.value;
    return;
  }
  if (e.code === "Space" && !revealed.value) {
    e.preventDefault();
    revealed.value = true;
    return;
  }
  if (!revealed.value) return;
  if (e.key === "1") {
    e.preventDefault();
    grade("again");
  } else if (e.key === "2") {
    e.preventDefault();
    grade("hard");
  } else if (e.key === "3") {
    e.preventDefault();
    grade("good");
  } else if (e.key === "4") {
    e.preventDefault();
    grade("easy");
  }
}

onMounted(() => window.addEventListener("keydown", onKey));
onBeforeUnmount(() => window.removeEventListener("keydown", onKey));
</script>

<template>
  <section class="study-wrap rkz-scroll">
    <!-- Session Strip -->
    <div class="study-bar select-none">
      <div class="bar-left">
        <SelectMenu
          v-model="subjectFilter"
          :options="subjectOptions"
          align="left"
          aria-label="Filter study subject"
        />

        <button
          type="button"
          class="rkz-btn mini"
          :class="{ 'rkz-btn-accent-soft': queueMode !== 'due' }"
          @click="cycleQueueMode"
        >
          {{ queueModeLabel }}
        </button>

        <button
          type="button"
          class="rkz-btn mini"
          :class="{ 'rkz-btn-accent-soft': healthOpen }"
          title="Toggle sustained learning health & Islands vs. Bridges diagnostics"
          @click="healthOpen = !healthOpen"
        >
          <Icon name="target" :size="12" />
          <span>Health</span>
        </button>
      </div>

      <div class="bar-stats tabular">
        <span class="stat-item">
          <strong class="stat-num">{{ queue.length }}</strong>
          {{ queueMode === "all" ? "in deck" : queueMode === "fragile" ? "fragile" : "due" }}
        </span>
        <template v-if="sustainedMetrics.dailyStreak > 0">
          <span class="stat-sep">·</span>
          <span class="stat-item">
            <strong class="stat-num">{{ sustainedMetrics.dailyStreak }}d</strong>
            streak
          </span>
        </template>
        <span class="stat-sep">·</span>
        <span class="stat-item">
          <strong class="stat-num">{{ studyStats.reviewedToday }}</strong>
          today
        </span>
        <span class="stat-sep">·</span>
        <span class="stat-item">
          <strong class="stat-num">{{ sustainedMetrics.tiers.durableCount }}</strong>
          durable
        </span>
        <template v-if="studyStats.retentionPct != null">
          <span class="stat-sep">·</span>
          <span class="stat-item">
            <strong class="stat-num">{{ studyStats.retentionPct }}%</strong>
            recall
          </span>
        </template>
      </div>
    </div>

    <!-- Sustained Learning Health Instrument Panel (collapsible, or always visible on Caught Up) -->
    <div v-if="(healthOpen || !currentCard) && memonics.length > 0" class="health-strip select-none">
      <div class="health-grid">
        <!-- 1. Consistency & 14-day spacing cadence -->
        <div class="health-cell">
          <div class="cell-head">
            <span class="rkz-label">14-Day Spacing Cadence</span>
            <span class="cell-metric tabular font-mono-meta">
              {{ sustainedMetrics.dailyStreak }}d streak
            </span>
          </div>
          <div class="cadence-row" role="list" aria-label="14 day study activity">
            <span
              v-for="day in sustainedMetrics.activity14d"
              :key="day.date"
              role="listitem"
              class="cadence-cell"
              :class="[`lvl-${activityLevel(day.count)}`, { 'is-today': day.isToday }]"
              :title="`${day.label}: ${day.count} ${day.count === 1 ? 'review' : 'reviews'}`"
            />
          </div>
          <span class="cell-note">
            Consistent short retrieval beats cramming (Cepeda, 2006)
          </span>
        </div>

        <!-- 2. Forgetting-Curve Memory Tiers -->
        <div class="health-cell">
          <div class="cell-head">
            <span class="rkz-label">Memory Durability</span>
            <button
              v-if="sustainedMetrics.fragileCards.length > 0 && queueMode !== 'fragile'"
              type="button"
              class="inline-action"
              @click="startFragileReview"
            >
              Review {{ sustainedMetrics.fragileCards.length }} fragile
            </button>
            <span v-else class="cell-metric tabular font-mono-meta">
              {{ sustainedMetrics.tiers.durableCount }}/{{ memonics.length }} durable
            </span>
          </div>
          <div class="tier-bar" aria-hidden="true">
            <span class="tier-seg is-durable" :style="{ width: `${tierPcts.durable}%` }" />
            <span class="tier-seg is-learning" :style="{ width: `${tierPcts.learning}%` }" />
            <span class="tier-seg is-fragile" :style="{ width: `${tierPcts.fragile}%` }" />
            <span class="tier-seg is-new" :style="{ width: `${tierPcts.newPct}%` }" />
          </div>
          <div class="tier-legend tabular">
            <span><i class="leg-dot is-durable" />{{ sustainedMetrics.tiers.durableCount }} durable</span>
            <span><i class="leg-dot is-learning" />{{ sustainedMetrics.tiers.learningCount }} learning</span>
            <span><i class="leg-dot is-fragile" />{{ sustainedMetrics.tiers.fragileCount }} fragile</span>
            <span><i class="leg-dot is-new" />{{ sustainedMetrics.tiers.newCount }} new</span>
          </div>
        </div>

        <!-- 3. Islands -> Bridges -> Mother Paradigm Integrity -->
        <div class="health-cell">
          <div class="cell-head">
            <span class="rkz-label">Islands → Bridges</span>
            <button
              v-if="sustainedMetrics.isolatedIslands.length > 0"
              type="button"
              class="inline-action"
              @click="openFirstIsland"
            >
              Bridge an island
            </button>
            <span v-else class="cell-metric is-ok font-mono-meta">All bridged</span>
          </div>
          <div class="integrity-row tabular">
            <div class="integrity-stat">
              <strong>{{ sustainedMetrics.bridgedCount }}</strong>
              <span>bridged</span>
            </div>
            <div class="integrity-stat">
              <strong :class="{ 'is-warn': sustainedMetrics.isolatedIslands.length > 0 }">
                {{ sustainedMetrics.isolatedIslands.length }}
              </strong>
              <span>islands</span>
            </div>
            <div class="integrity-stat">
              <strong>{{ sustainedMetrics.rootsCount }}</strong>
              <span>L3 roots</span>
            </div>
            <div class="integrity-stat" title="Cards with L2 explanation + cross-subject bridge + durable spaced retention">
              <strong>{{ sustainedMetrics.motherParadigmPct }}%</strong>
              <span>sustained</span>
            </div>
          </div>
          <span class="cell-note">
            Sustained mastery = Core (L2) + Cross-Subject Bridge + Durable Recall
          </span>
        </div>
      </div>
    </div>

    <!-- Active Recall Stage -->
    <div v-if="currentCard" class="study-stage">
      <div class="recall-card">
        <div class="recall-head select-none">
          <div class="head-meta">
            <span v-if="cardSubject" class="subj-pill">
              <span class="subj-dot" :style="{ backgroundColor: cardSubject.color }" />
              {{ cardSubject.name }}
            </span>
            <span class="type-pill">{{ currentCard.type }}</span>
            <span v-if="cardRecord" class="rep-pill tabular font-mono-meta">
              {{ cardRecord.reps }} {{ cardRecord.reps === 1 ? "rep" : "reps" }} · streak {{ cardRecord.streak }}
            </span>
            <span v-else class="rep-pill font-mono-meta">First retrieval</span>
          </div>

          <button
            type="button"
            class="rkz-btn mini"
            title="Ask Co-Pilot for a retrieval question"
            @click="openAsk('quiz')"
          >
            <Icon name="sparkles" :size="12" />
            <span>Quiz Me</span>
          </button>
        </div>

        <!-- Stage 0: Mnemonic Hook (L1 — no tag spoilers before hint/reveal) -->
        <div class="prompt-zone select-text">
          <span class="rkz-label select-none">{{ activeCue.prompt }}</span>
          <h1 dir="auto" class="hook-title">{{ currentCard.title || "Untitled mnemonic" }}</h1>

          <!-- Stage 1: Graduated Hint (revealed only on request or after full reveal) -->
          <div v-if="(hintShown || revealed) && hasHintMaterial" class="hint-tray">
            <div v-if="currentCard.tags.length" class="cue-tags">
              <span v-for="t in currentCard.tags" :key="t" class="cue-tag font-mono-meta">#{{ t }}</span>
            </div>
            <span v-if="!revealed && crossSubjectHintNames.length" class="hint-bridge-cue select-none">
              <Icon name="bridge" :size="12" />
              Bridged to {{ crossSubjectHintNames.join(", ") }}
            </span>
          </div>
        </div>

        <!-- Elaborative Self-Explanation Scratchpad (before reveal) -->
        <div v-if="!revealed" class="attempt-zone">
          <div class="cue-switcher select-none" role="tablist" aria-label="Metacognitive recall prompt">
            <button
              v-for="c in RECALL_CUES"
              :key="c.id"
              type="button"
              role="tab"
              :aria-selected="recallCue === c.id"
              class="cue-btn"
              :class="{ 'is-active': recallCue === c.id }"
              @click="recallCue = c.id"
            >
              {{ c.label }}
            </button>
          </div>

          <textarea
            id="rkz-recall-attempt"
            v-model="recallDraft"
            dir="auto"
            :placeholder="activeCue.placeholder"
            class="rkz-input attempt-input"
          />

          <div class="reveal-row select-none">
            <div class="reveal-left">
              <button
                v-if="hasHintMaterial"
                type="button"
                class="rkz-btn mini"
                :class="{ 'rkz-btn-accent-soft': hintShown }"
                @click="hintShown = !hintShown"
              >
                <Icon name="info" :size="12" />
                <span>{{ hintShown ? "Hide hint" : "Hint (tags)" }}</span>
                <kbd class="rkz-kbd">H</kbd>
              </button>
              <span v-else class="bridge-teaser">
                Retrieval practice beats re-reading (Roediger &amp; Karpicke, 2006)
              </span>
            </div>

            <button
              type="button"
              class="rkz-btn rkz-btn-primary reveal-btn"
              @click="revealed = true"
            >
              <Icon name="eye" :size="14" />
              <span>Reveal Explanation</span>
              <kbd class="rkz-kbd on-primary">Space</kbd>
            </button>
          </div>
        </div>

        <!-- Stage 2: Revealed Core Explanation + Deep Roots (L3) + Bridges + Spaced Grading -->
        <div v-else class="answer-zone">
          <div class="compare-grid" :class="{ 'has-attempt': !!recallDraft.trim() }">
            <div v-if="recallDraft.trim()" class="compare-box">
              <span class="rkz-label select-none">Your Attempt</span>
              <p dir="auto" class="compare-text">{{ recallDraft }}</p>
            </div>

            <div class="explanation-box select-text">
              <span class="rkz-label select-none">Canonical Explanation (L2)</span>
              <p dir="auto" class="explanation-text">
                {{ currentCard.context || "No explanation written yet — open this card in Stack view to add one." }}
              </p>
            </div>
          </div>

          <!-- Layer 3 Deep Roots / True Science -->
          <div v-if="currentRoots" class="roots-reveal-box select-text">
            <div class="roots-reveal-head select-none">
              <span class="rkz-label">Deep Roots &amp; First Principles (L3)</span>
              <button
                type="button"
                class="inline-action"
                @click="openAsk('why')"
              >
                Deepen with Co-Pilot
              </button>
            </div>
            <p dir="auto" class="roots-reveal-text">{{ currentRoots }}</p>
          </div>

          <!-- Contextual Cross-Subject Retrieval Bridges -->
          <div v-if="bridgesForCurrent.length" class="bridges-box">
            <span class="rkz-label select-none">Connected Mental Model</span>
            <div class="bridge-chips">
              <button
                v-for="b in bridgesForCurrent"
                :key="`${b.dir}-${b.card.sid}-${b.title}`"
                type="button"
                class="bridge-chip"
                :class="{ 'is-cross': b.cross }"
                @click="jumpToCard(b.card.sid)"
              >
                <span class="chip-subj">{{ b.card.id }}</span>
                <span dir="auto" class="chip-title">{{ b.card.title }}</span>
                <span class="chip-edge font-mono-meta">#{{ b.title }}</span>
              </button>
            </div>
          </div>
          <div v-else class="island-callout select-none">
            <Icon name="bridge" :size="13" />
            <span>Isolated island — connect this card to another subject in Stack view to strengthen recall.</span>
            <button type="button" class="inline-action" @click="jumpToCard(currentCard.sid)">
              Edit card
            </button>
          </div>

          <!-- 4 Spaced Repetition Grade Buttons -->
          <div v-if="intervals" class="grade-bar select-none">
            <div class="grade-head">
              <span class="rkz-label">How well did you recall &amp; explain it?</span>
              <button
                v-if="!currentRoots"
                type="button"
                class="inline-action"
                @click="openAsk('why')"
              >
                Ask "Why?" (Co-Pilot)
              </button>
            </div>
            <div class="grade-grid">
              <button type="button" class="grade-btn is-again" @click="grade('again')">
                <span class="grade-top">
                  <kbd class="rkz-kbd">1</kbd>
                  <span class="grade-name">Again</span>
                </span>
                <span class="grade-int tabular font-mono-meta">{{ intervals.again }}</span>
              </button>

              <button type="button" class="grade-btn is-hard" @click="grade('hard')">
                <span class="grade-top">
                  <kbd class="rkz-kbd">2</kbd>
                  <span class="grade-name">Hard</span>
                </span>
                <span class="grade-int tabular font-mono-meta">{{ intervals.hard }}</span>
              </button>

              <button type="button" class="grade-btn is-good" @click="grade('good')">
                <span class="grade-top">
                  <kbd class="rkz-kbd">3</kbd>
                  <span class="grade-name">Good</span>
                </span>
                <span class="grade-int tabular font-mono-meta">{{ intervals.good }}</span>
              </button>

              <button type="button" class="grade-btn is-easy" @click="grade('easy')">
                <span class="grade-top">
                  <kbd class="rkz-kbd">4</kbd>
                  <span class="grade-name">Easy</span>
                </span>
                <span class="grade-int tabular font-mono-meta">{{ intervals.easy }}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- All Caught Up / Empty Queue -->
    <div v-else class="caught-up select-none">
      <div class="caught-icon">
        <Icon name="check" :size="22" />
      </div>
      <h2 class="caught-title">
        {{
          memonics.length === 0
            ? "Your vault is empty"
            : queueMode === "fragile"
              ? "No fragile cards right now"
              : "All due cards reviewed"
        }}
      </h2>
      <p class="caught-sub">
        <template v-if="memonics.length === 0">
          Create your first mnemonic card to start building your knowledge graph.
        </template>
        <template v-else-if="queueMode === 'fragile'">
          Every reviewed card is currently holding above its decay threshold. Switch back to Due queue or Practice all.
        </template>
        <template v-else>
          You completed <strong class="tabular">{{ studyStats.reviewedToday }}</strong>
          {{ studyStats.reviewedToday === 1 ? "review" : "reviews" }} today.
          Spacing lets your memory consolidate before the next retrieval check.
        </template>
      </p>
      <div class="caught-actions">
        <button
          v-if="memonics.length > 0"
          type="button"
          class="rkz-btn rkz-btn-primary"
          @click="queueMode = 'all'; practiceIndex = 0"
        >
          <Icon name="refresh" :size="13" />
          <span>Practice all cards anyway</span>
        </button>
        <button
          v-if="sustainedMetrics.isolatedIslands.length > 0"
          type="button"
          class="rkz-btn"
          @click="openFirstIsland"
        >
          <Icon name="bridge" :size="13" />
          <span>Bridge an Island ({{ sustainedMetrics.isolatedIslands.length }})</span>
        </button>
        <button type="button" class="rkz-btn" @click="emit('open-stack')">
          <Icon name="stack" :size="13" />
          <span>Return to Stack</span>
        </button>
      </div>
    </div>
  </section>
</template>

<style scoped>
.study-wrap {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  background-color: var(--bg-root);
}

.study-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
  padding: 10px 20px;
  border-bottom: 1px solid var(--border-subtle);
  background-color: var(--bg-sidebar);
}

.bar-left {
  display: flex;
  align-items: center;
  gap: 8px;
}

.mini {
  height: 28px;
  padding: 0 9px;
  font-size: 11.5px;
}

.bar-stats {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: var(--text-muted);
}

.stat-num {
  color: var(--text-primary);
  font-weight: 600;
}

.stat-sep {
  opacity: 0.4;
}

/* Sustained Learning Health Instrument Panel */
.health-strip {
  padding: 12px 20px;
  border-bottom: 1px solid var(--border-subtle);
  background-color: var(--bg-panel);
}

.health-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
  max-width: 980px;
  margin: 0 auto;
}

@media (max-width: 820px) {
  .health-grid {
    grid-template-columns: 1fr;
  }
}

.health-cell {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 10px 12px;
  border-radius: var(--radius-md);
  border: 1px solid var(--border-subtle);
  background-color: var(--bg-surface);
}

.cell-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.cell-metric {
  font-size: 11px;
  font-weight: 600;
  color: var(--text-secondary);
}

.cell-metric.is-ok {
  color: var(--ok);
}

.cell-note {
  font-size: 11px;
  color: var(--text-muted);
  line-height: 1.35;
}

.inline-action {
  border: none;
  background: transparent;
  padding: 0;
  color: var(--accent);
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
}

.inline-action:hover {
  text-decoration: underline;
}

.cadence-row {
  display: flex;
  align-items: center;
  gap: 4px;
}

.cadence-cell {
  width: 12px;
  height: 12px;
  border-radius: 2.5px;
  border: 1px solid var(--border-subtle);
  background-color: var(--bg-input);
}

.cadence-cell.lvl-1 {
  background-color: var(--accent-subtle);
  border-color: var(--accent-border);
}

.cadence-cell.lvl-2 {
  background-color: var(--accent);
  border-color: var(--accent);
  opacity: 0.72;
}

.cadence-cell.lvl-3 {
  background-color: var(--accent);
  border-color: var(--accent);
}

.cadence-cell.is-today {
  outline: 1.5px solid var(--text-secondary);
  outline-offset: 1px;
}

.tier-bar {
  display: flex;
  height: 6px;
  width: 100%;
  border-radius: 999px;
  overflow: hidden;
  background-color: var(--bg-input);
}

.tier-seg {
  height: 100%;
  transition: width var(--ease-normal);
}

.tier-seg.is-durable,
.leg-dot.is-durable {
  background-color: var(--ok);
}

.tier-seg.is-learning,
.leg-dot.is-learning {
  background-color: var(--accent);
}

.tier-seg.is-fragile,
.leg-dot.is-fragile {
  background-color: var(--bridge);
}

.tier-seg.is-new,
.leg-dot.is-new {
  background-color: var(--border-strong);
}

.tier-legend {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  font-size: 11px;
  color: var(--text-secondary);
}

.tier-legend span {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.leg-dot {
  display: inline-block;
  width: 6px;
  height: 6px;
  border-radius: 999px;
}

.integrity-row {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 6px;
}

.integrity-stat {
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.integrity-stat strong {
  font-size: 14px;
  font-weight: 650;
  color: var(--text-primary);
  line-height: 1.15;
}

.integrity-stat strong.is-warn {
  color: var(--bridge);
}

.integrity-stat span {
  font-size: 10.5px;
  color: var(--text-muted);
}

/* Recall Stage */
.study-stage {
  display: flex;
  flex: 1;
  align-items: flex-start;
  justify-content: center;
  padding: 24px 24px 36px;
}

.recall-card {
  container-type: inline-size;
  width: 100%;
  max-width: 760px;
  background-color: var(--bg-surface);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-sm);
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.recall-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 12px 20px;
  border-bottom: 1px solid var(--border-subtle);
}

.head-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.subj-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  font-weight: 600;
  color: var(--text-primary);
}

.subj-dot {
  width: 7px;
  height: 7px;
  border-radius: 999px;
}

.type-pill {
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  padding: 2px 7px;
  border-radius: var(--radius-xs);
  border: 1px solid var(--border-subtle);
  background-color: var(--bg-input);
  color: var(--text-muted);
}

.rep-pill {
  font-size: 11px;
  color: var(--text-muted);
}

.prompt-zone {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 24px 24px 18px;
}

.hook-title {
  margin: 0;
  font-size: 26px;
  font-weight: 650;
  letter-spacing: -0.02em;
  line-height: 1.25;
}

.hint-tray {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding-top: 2px;
}

.cue-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.cue-tag {
  font-size: 11.5px;
  padding: 2px 8px;
  border-radius: var(--radius-xs);
  border: 1px solid var(--border-subtle);
  background-color: var(--bg-input);
  color: var(--text-muted);
}

.hint-bridge-cue {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 11.5px;
  color: var(--bridge);
  font-weight: 500;
}

.attempt-zone {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 0 24px 22px;
}

.cue-switcher {
  display: inline-flex;
  align-self: flex-start;
  gap: 2px;
  padding: 2px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border-subtle);
  background-color: var(--bg-input);
}

.cue-btn {
  height: 24px;
  padding: 0 9px;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: var(--text-muted);
  font-size: 11px;
  font-weight: 500;
  cursor: pointer;
  transition: background-color var(--ease-fast), color var(--ease-fast);
}

.cue-btn:hover:not(.is-active) {
  color: var(--text-primary);
}

.cue-btn.is-active {
  background-color: var(--bg-surface);
  color: var(--text-primary);
  font-weight: 600;
}

.attempt-input {
  min-height: 92px;
  padding: 12px 14px;
  font-size: 13.5px;
  line-height: 1.6;
  resize: vertical;
  font-family: var(--font-sans);
}

.reveal-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
  padding-top: 4px;
}

.reveal-left {
  display: flex;
  align-items: center;
  gap: 8px;
}

.bridge-teaser {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 11.5px;
  color: var(--text-muted);
}

.reveal-btn {
  height: 36px;
  padding: 0 14px;
  font-size: 13px;
}

.on-primary {
  background-color: rgba(255, 255, 255, 0.16);
  border-color: rgba(255, 255, 255, 0.25);
  color: #ffffff;
}

.answer-zone {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 18px 24px 24px;
  border-top: 1px solid var(--border-subtle);
  background-color: var(--bg-sidebar);
}

.compare-box,
.explanation-box {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 14px 16px;
  border-radius: var(--radius-md);
  border: 1px solid var(--border-subtle);
  background-color: var(--bg-surface);
}

.compare-box {
  border-style: dashed;
}

.compare-text {
  margin: 0;
  font-size: 13px;
  line-height: 1.6;
  color: var(--text-secondary);
  white-space: pre-wrap;
}

.explanation-text {
  margin: 0;
  font-size: 14.5px;
  line-height: 1.65;
  color: var(--text-primary);
  white-space: pre-wrap;
}

.roots-reveal-box {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 12px 14px;
  border-radius: var(--radius-md);
  border: 1px solid var(--border-subtle);
  border-left: 2.5px solid var(--accent);
  background-color: var(--bg-surface);
}

.roots-reveal-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.roots-reveal-text {
  margin: 0;
  font-size: 13px;
  line-height: 1.6;
  color: var(--text-secondary);
  white-space: pre-wrap;
}

.bridges-box {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.bridge-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.bridge-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 5px 10px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border-default);
  background-color: var(--bg-surface);
  color: var(--text-primary);
  font-size: 12px;
  cursor: pointer;
  transition: border-color var(--ease-fast), background-color var(--ease-fast);
}

.bridge-chip.is-cross {
  border-color: var(--bridge-border);
  background-color: var(--bridge-subtle);
}

.bridge-chip:hover {
  border-color: var(--accent-border);
}

.chip-subj {
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  color: var(--text-muted);
}

.bridge-chip.is-cross .chip-subj {
  color: var(--bridge);
}

.chip-title {
  font-weight: 500;
}

.chip-edge {
  font-size: 11px;
  color: var(--text-muted);
}

.island-callout {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 9px 12px;
  border-radius: var(--radius-sm);
  border: 1px dashed var(--border-default);
  background-color: var(--bg-surface);
  color: var(--text-muted);
  font-size: 11.5px;
}

.island-callout .inline-action {
  margin-left: auto;
  flex-shrink: 0;
}

.compare-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 12px;
}

@container (min-width: 540px) {
  .compare-grid.has-attempt {
    grid-template-columns: 1fr 1fr;
  }
}

.grade-bar {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding-top: 4px;
}

.grade-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.grade-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 8px;
}

@container (max-width: 480px) {
  .grade-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

.grade-btn {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;
  padding: 10px 12px;
  border-radius: var(--radius-md);
  border: 1px solid var(--border-default);
  background-color: var(--bg-surface);
  color: var(--text-primary);
  cursor: pointer;
  transition: background-color var(--ease-fast), border-color var(--ease-fast), transform var(--ease-fast);
}

.grade-btn:hover {
  transform: translateY(-1px);
}

.grade-btn.is-again:hover {
  border-color: var(--danger-border);
  background-color: var(--danger-subtle);
}

.grade-btn.is-hard:hover {
  border-color: var(--warn-border);
  background-color: var(--warn-subtle);
}

.grade-btn.is-good:hover {
  border-color: var(--accent-border);
  background-color: var(--accent-subtle);
}

.grade-btn.is-easy:hover {
  border-color: var(--ok-border);
  background-color: var(--ok-subtle);
}

.grade-top {
  display: flex;
  align-items: center;
  gap: 6px;
}

.grade-name {
  font-size: 12.5px;
  font-weight: 600;
}

.grade-int {
  font-size: 11px;
  color: var(--text-muted);
}

.caught-up {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  flex: 1;
  padding: 32px 24px;
  text-align: center;
}

.caught-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  border-radius: 999px;
  border: 1px solid var(--ok-border);
  background-color: var(--ok-subtle);
  color: var(--ok);
}

.caught-title {
  margin: 0;
  font-size: 18px;
}

.caught-sub {
  margin: 0;
  max-width: 440px;
  font-size: 13px;
  color: var(--text-secondary);
  line-height: 1.55;
}

.caught-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 8px;
  padding-top: 6px;
}
</style>
