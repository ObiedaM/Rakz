// ─────────────────────────────────────────────────────────────────────────────
// Study & Sustained Learning Engine (local-first, zero edits to @rakz/engine).
// Grounds RAKZ in peer-reviewed learning science (Roediger & Karpicke 2006
// retrieval practice; Dunlosky 2013 elaborative self-explanation; Cepeda 2006
// & Mawson & Kang 2025 distributed spacing; Bjork 1994 desirable difficulties)
// AND the 3-layer mental-model philosophy (Islands -> Bridges -> Mother
// Paradigm, and L1 Condensed Hook -> L2 Core -> L3 Deep Roots / True Science).
// Persists locally to `.study/reviews.json` (dot-dir skipped by vault scanner
// — Invariant #6) + localStorage fallback.
// ─────────────────────────────────────────────────────────────────────────────

// ========== 1. IMPORTS ==========
import { computed, ref } from "vue";
import { invoke } from "@tauri-apps/api/core";

import type { Memonic } from "@engine/types";
import { isTauri, memonics } from "./state";

// ========== 2. TYPES ==========
export type RecallGrade = "again" | "hard" | "good" | "easy";
export type CardMemoryState = "new" | "learning" | "fragile" | "durable";

export interface ReviewRecord {
  reps: number;
  lapses: number;
  intervalDays: number;
  ease: number;
  dueAt: number;
  lastReviewedAt: number;
  lastGrade: RecallGrade | null;
  streak: number;
}

export interface StudyStats {
  dueCount: number;
  newCount: number;
  masteredCount: number;
  reviewedToday: number;
  totalReviews: number;
  retentionPct: number | null;
}

export interface DayActivity {
  date: string;
  label: string;
  count: number;
  isToday: boolean;
}

export interface SustainedMetrics {
  dailyStreak: number;
  activity14d: DayActivity[];
  tiers: {
    newCount: number;
    learningCount: number;
    fragileCount: number;
    durableCount: number;
  };
  fragileCards: Memonic[];
  bridgedCount: number;
  isolatedIslands: Memonic[];
  rootsCount: number;
  motherParadigmCount: number;
  motherParadigmPct: number;
}

interface PersistedStudyStore {
  version: 1 | 2;
  records: Record<string, ReviewRecord>;
  deepRoots?: Record<string, string>;
  totalReviews: number;
  passedReviews: number;
  dailyCounts: Record<string, number>; // YYYY-MM-DD -> count
}

// ========== 3. CONSTANTS ==========
const STORAGE_KEY = "rakaz.study.v1";
const STUDY_FILE = ".study/reviews.json";
const MINUTE_MS = 60_000;
const DAY_MS = 86_400_000;

// ========== 4. STATE ==========
export const studyRecords = ref<Record<string, ReviewRecord>>({});
export const deepRootsMap = ref<Record<string, string>>({});
const totalReviewsCount = ref(0);
const passedReviewsCount = ref(0);
const dailyCounts = ref<Record<string, number>>({});
let studySaveTimer: ReturnType<typeof setTimeout> | null = null;

// ========== 5. LOGIC ==========

/** Stable card fingerprint that survives .mns reload & SID renumbering. */
export function cardStudyKey(m: Pick<Memonic, "id" | "title">): string {
  return `${m.id.trim().toLowerCase()}::${m.title.trim().toLowerCase()}`;
}

export function dateKeyFor(now = Date.now()): string {
  const d = new Date(now);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function defaultRecord(now = Date.now()): ReviewRecord {
  return {
    reps: 0,
    lapses: 0,
    intervalDays: 0,
    ease: 2.5,
    dueAt: now,
    lastReviewedAt: 0,
    lastGrade: null,
    streak: 0,
  };
}

/**
 * Pure spaced-repetition step (SM-2 / FSRS-inspired spacing curves):
 *  - Again: 10 minutes (relearn in session)
 *  - Hard:  12 hours (first) or 1.2x previous interval
 *  - Good:  1 day -> 4 days -> interval * ease
 *  - Easy:  4 days -> interval * ease * 1.35
 */
export function computeNextReview(
  prev: ReviewRecord | undefined,
  grade: RecallGrade,
  now = Date.now(),
): ReviewRecord {
  const base = prev ?? defaultRecord(now);
  let { reps, lapses, intervalDays, ease, streak } = base;

  if (grade === "again") {
    reps = 0;
    streak = 0;
    lapses += 1;
    ease = Math.max(1.3, Number((ease - 0.2).toFixed(2)));
    intervalDays = 0;
    return {
      reps,
      lapses,
      intervalDays,
      ease,
      dueAt: now + 10 * MINUTE_MS,
      lastReviewedAt: now,
      lastGrade: grade,
      streak,
    };
  }

  if (grade === "hard") {
    ease = Math.max(1.3, Number((ease - 0.15).toFixed(2)));
    intervalDays = reps === 0 ? 0.5 : Math.max(1, Math.round(intervalDays * 1.2));
    reps += 1;
    streak += 1;
  } else if (grade === "good") {
    if (reps === 0) intervalDays = 1;
    else if (reps === 1) intervalDays = 4;
    else intervalDays = Math.max(intervalDays + 1, Math.round(intervalDays * ease));
    reps += 1;
    streak += 1;
  } else {
    // easy
    ease = Math.min(3.0, Number((ease + 0.15).toFixed(2)));
    if (reps === 0) intervalDays = 4;
    else intervalDays = Math.max(intervalDays + 2, Math.round(intervalDays * ease * 1.35));
    reps += 1;
    streak += 1;
  }

  return {
    reps,
    lapses,
    intervalDays,
    ease,
    dueAt: now + Math.round(intervalDays * DAY_MS),
    lastReviewedAt: now,
    lastGrade: grade,
    streak,
  };
}

export function formatInterval(days: number, dueAt?: number, now = Date.now()): string {
  if (days === 0 && dueAt != null) {
    const mins = Math.max(1, Math.round((dueAt - now) / MINUTE_MS));
    return `${mins}m`;
  }
  if (days < 1) {
    return `${Math.max(1, Math.round(days * 24))}h`;
  }
  if (days < 14) return `${Math.round(days)}d`;
  if (days < 60) return `${Math.round(days / 7)}w`;
  return `${Math.round(days / 30)}mo`;
}

export function previewIntervals(m: Memonic, now = Date.now()): Record<RecallGrade, string> {
  const rec = getReviewRecord(m);
  const grades: RecallGrade[] = ["again", "hard", "good", "easy"];
  const out = {} as Record<RecallGrade, string>;
  for (const g of grades) {
    const next = computeNextReview(rec, g, now);
    out[g] = formatInterval(next.intervalDays, next.dueAt, now);
  }
  return out;
}

export function getReviewRecord(m: Memonic): ReviewRecord | undefined {
  return studyRecords.value[cardStudyKey(m)];
}

export function isCardDue(m: Memonic, now = Date.now()): boolean {
  const rec = getReviewRecord(m);
  if (!rec) return true;
  return rec.dueAt <= now;
}

/** Layer 3 — Deep Roots / True Science (first-principles derivations & origins). */
export function getDeepRoots(m: Pick<Memonic, "id" | "title">): string {
  return deepRootsMap.value[cardStudyKey(m)] ?? "";
}

export function setDeepRoots(m: Pick<Memonic, "id" | "title">, text: string): void {
  const key = cardStudyKey(m);
  const copy = { ...deepRootsMap.value };
  if (text.trim().length === 0) {
    delete copy[key];
  } else {
    copy[key] = text;
  }
  deepRootsMap.value = copy;
  scheduleStudySave();
}

/** Seed starter Layer-3 notes ONLY when the study store has no roots yet (first run). */
export function seedDeepRootsIfEmpty(
  entries: { id: string; title: string; deepRoots: string }[],
): void {
  if (Object.keys(deepRootsMap.value).length > 0) return;
  const next: Record<string, string> = {};
  for (const e of entries) {
    if (e.deepRoots.trim()) {
      next[cardStudyKey(e)] = e.deepRoots.trim();
    }
  }
  if (Object.keys(next).length > 0) {
    deepRootsMap.value = next;
    scheduleStudySave();
  }
}

/** Learning depth tier: L1 Hook -> L2 Core Explanation -> L3 Deep Roots. */
export function cardDepthLevel(m: Memonic): 1 | 2 | 3 {
  if (m.context.trim().length > 0 && getDeepRoots(m).trim().length > 0) return 3;
  if (m.context.trim().length > 0) return 2;
  return 1;
}

/** Count distinct cross-subject neighbours linked to or from this card. */
export function cardCrossBridgeCount(m: Memonic, all: Memonic[] = memonics.value): number {
  const bySid = new Map(all.map((c) => [c.sid, c]));
  const crossNeighbours = new Set<number>();
  for (const l of m.links) {
    const target = bySid.get(l.targetSID);
    if (target && target.id !== m.id) crossNeighbours.add(target.sid);
  }
  for (const other of all) {
    if (other.sid === m.sid || other.id === m.id) continue;
    if (other.links.some((l) => l.targetSID === m.sid)) {
      crossNeighbours.add(other.sid);
    }
  }
  return crossNeighbours.size;
}

/** Memory durability tier based on spaced-repetition decay and streak. */
export function getCardMemoryState(m: Memonic, now = Date.now()): CardMemoryState {
  const rec = getReviewRecord(m);
  if (!rec) return "new";
  if (rec.lastGrade === "again" || rec.dueAt <= now) return "fragile";
  if (rec.intervalDays >= 4 && rec.streak >= 2) return "durable";
  return "learning";
}

/** Consecutive days with >= 1 active retrieval review. */
export function computeDailyStreak(counts: Record<string, number>, now = Date.now()): number {
  let streak = 0;
  let cursor = now;
  const todayCount = counts[dateKeyFor(cursor)] ?? 0;
  // If user hasn't reviewed yet today, still honour an active streak ending yesterday.
  if (todayCount === 0) {
    cursor -= DAY_MS;
  }
  while ((counts[dateKeyFor(cursor)] ?? 0) > 0) {
    streak += 1;
    cursor -= DAY_MS;
  }
  return streak;
}

/** 14-day rolling daily retrieval activity strip (oldest -> today). */
export function computeActivity14d(counts: Record<string, number>, now = Date.now()): DayActivity[] {
  const out: DayActivity[] = [];
  const todayStr = dateKeyFor(now);
  for (let i = 13; i >= 0; i--) {
    const ts = now - i * DAY_MS;
    const date = dateKeyFor(ts);
    const d = new Date(ts);
    const label = d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
    out.push({
      date,
      label,
      count: counts[date] ?? 0,
      isToday: date === todayStr,
    });
  }
  return out;
}

export function recordReview(m: Memonic, grade: RecallGrade, now = Date.now()): ReviewRecord {
  const key = cardStudyKey(m);
  const next = computeNextReview(studyRecords.value[key], grade, now);
  studyRecords.value = { ...studyRecords.value, [key]: next };
  totalReviewsCount.value += 1;
  if (grade !== "again") passedReviewsCount.value += 1;
  const day = dateKeyFor(now);
  dailyCounts.value = { ...dailyCounts.value, [day]: (dailyCounts.value[day] ?? 0) + 1 };
  scheduleStudySave();
  return next;
}

/** Migrate review & Deep Roots keys when a card's title or subject changes so history is never lost. */
export function migrateStudyKey(
  prev: Pick<Memonic, "id" | "title">,
  next: Pick<Memonic, "id" | "title">,
): void {
  const oldKey = cardStudyKey(prev);
  const newKey = cardStudyKey(next);
  if (oldKey === newKey) return;
  let changed = false;

  const existingRec = studyRecords.value[oldKey];
  if (existingRec) {
    const copy = { ...studyRecords.value };
    delete copy[oldKey];
    copy[newKey] = existingRec;
    studyRecords.value = copy;
    changed = true;
  }

  const existingRoots = deepRootsMap.value[oldKey];
  if (existingRoots != null) {
    const copy = { ...deepRootsMap.value };
    delete copy[oldKey];
    copy[newKey] = existingRoots;
    deepRootsMap.value = copy;
    changed = true;
  }

  if (changed) scheduleStudySave();
}

export const dueCards = computed<Memonic[]>(() => {
  const now = Date.now();
  return [...memonics.value]
    .filter((m) => isCardDue(m, now))
    .sort((a, b) => {
      const ra = getReviewRecord(a);
      const rb = getReviewRecord(b);
      // Lapsed / overdue cards first, then high-importance new cards
      const aDue = ra ? ra.dueAt : now + 1;
      const bDue = rb ? rb.dueAt : now + 1;
      if (ra && !rb) return -1;
      if (!ra && rb) return 1;
      if (ra && rb && aDue !== bDue) return aDue - bDue;
      return (b.importance || 0) - (a.importance || 0);
    });
});

export const studyStats = computed<StudyStats>(() => {
  const now = Date.now();
  let dueCount = 0;
  let newCount = 0;
  let masteredCount = 0;
  for (const m of memonics.value) {
    const rec = getReviewRecord(m);
    if (!rec) {
      newCount++;
      dueCount++;
    } else {
      if (rec.dueAt <= now) dueCount++;
      if (rec.intervalDays >= 4 && rec.streak >= 2) masteredCount++;
    }
  }
  const reviewedToday = dailyCounts.value[dateKeyFor(now)] ?? 0;
  const retentionPct = totalReviewsCount.value > 0
    ? Math.round((passedReviewsCount.value / totalReviewsCount.value) * 100)
    : null;
  return {
    dueCount,
    newCount,
    masteredCount,
    reviewedToday,
    totalReviews: totalReviewsCount.value,
    retentionPct,
  };
});

/** Sustained Learning Compass: Consistency, Forgetting-Curve Health, Islands -> Bridges -> Mother Paradigm. */
export const sustainedMetrics = computed<SustainedMetrics>(() => {
  const now = Date.now();
  const all = memonics.value;
  let newCount = 0;
  let learningCount = 0;
  let fragileCount = 0;
  let durableCount = 0;
  let bridgedCount = 0;
  let rootsCount = 0;
  let motherParadigmCount = 0;
  const fragileCards: Memonic[] = [];
  const isolatedIslands: Memonic[] = [];

  for (const m of all) {
    const state = getCardMemoryState(m, now);
    if (state === "new") newCount++;
    else if (state === "learning") learningCount++;
    else if (state === "fragile") {
      fragileCount++;
      fragileCards.push(m);
    } else {
      durableCount++;
    }

    const bridges = cardCrossBridgeCount(m, all);
    if (bridges > 0) bridgedCount++;
    else isolatedIslands.push(m);

    if (getDeepRoots(m).trim().length > 0) rootsCount++;

    // Mother Paradigm / Sustained Mastery = Self-authored core + Cross-subject bridge + Durable spaced retrieval
    if (m.context.trim().length >= 24 && bridges > 0 && state === "durable") {
      motherParadigmCount++;
    }
  }

  fragileCards.sort((a, b) => {
    const ra = getReviewRecord(a);
    const rb = getReviewRecord(b);
    return (ra?.dueAt ?? 0) - (rb?.dueAt ?? 0);
  });

  const motherParadigmPct = all.length > 0 ? Math.round((motherParadigmCount / all.length) * 100) : 0;

  return {
    dailyStreak: computeDailyStreak(dailyCounts.value, now),
    activity14d: computeActivity14d(dailyCounts.value, now),
    tiers: { newCount, learningCount, fragileCount, durableCount },
    fragileCards,
    bridgedCount,
    isolatedIslands,
    rootsCount,
    motherParadigmCount,
    motherParadigmPct,
  };
});

function buildPayload(): PersistedStudyStore {
  return {
    version: 2,
    records: studyRecords.value,
    deepRoots: deepRootsMap.value,
    totalReviews: totalReviewsCount.value,
    passedReviews: passedReviewsCount.value,
    dailyCounts: dailyCounts.value,
  };
}

function hydrate(raw: unknown): void {
  if (!raw || typeof raw !== "object") return;
  const d = raw as Partial<PersistedStudyStore>;
  if (d.records && typeof d.records === "object") studyRecords.value = d.records;
  if (d.deepRoots && typeof d.deepRoots === "object") deepRootsMap.value = d.deepRoots;
  if (typeof d.totalReviews === "number") totalReviewsCount.value = d.totalReviews;
  if (typeof d.passedReviews === "number") passedReviewsCount.value = d.passedReviews;
  if (d.dailyCounts && typeof d.dailyCounts === "object") dailyCounts.value = d.dailyCounts;
}

export async function loadStudyStore(): Promise<void> {
  // 1. localStorage first (instant, browser-safe)
  try {
    const cached = localStorage.getItem(STORAGE_KEY);
    if (cached) hydrate(JSON.parse(cached));
  } catch {
    /* ignore */
  }
  // 2. desktop vault `.study/reviews.json` overrides if present
  if (!isTauri) return;
  try {
    const text = await invoke<string | null>("read_mns_file", { name: STUDY_FILE });
    if (text) hydrate(JSON.parse(text));
  } catch {
    /* first run or unreadable — fine */
  }
}

export async function persistStudyStore(): Promise<void> {
  const json = JSON.stringify(buildPayload(), null, 2);
  try {
    localStorage.setItem(STORAGE_KEY, json);
  } catch {
    /* ignore */
  }
  if (!isTauri) return;
  try {
    await invoke("write_mns_file", { name: STUDY_FILE, content: json });
  } catch (e) {
    console.error("[rakaz] study save failed:", e);
  }
}

function scheduleStudySave(): void {
  clearTimeout(studySaveTimer ?? undefined);
  studySaveTimer = setTimeout(() => void persistStudyStore(), 400);
}
