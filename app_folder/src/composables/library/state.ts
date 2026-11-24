// ─────────────────────────────────────────────────────────────────────────────
// Library state — module-level singletons shared by every component.
// One vault per process: components call useLibrary() and all get the same refs.
// The engine is plain (non-reactive) module state; `memonics` is a reactive
// MIRROR refreshed from the engine after every mutation (deep snapshot — the
// engine mutates in place, invisible to Vue proxies).
// ─────────────────────────────────────────────────────────────────────────────

// ========== 1. IMPORTS ==========
import { computed, ref } from "vue";

import type { Memonic } from "@engine/types";
import type { Suggestion } from "@engine/link-engine";

import { deleteMemonicSafely, findSuggestionsForMemonic } from "@engine/link-engine";
import { getAllMemonics } from "@engine/memory-store";

// ========== 2. TYPES ==========
/** Subject projection shown in the sidebar (UI-only — the engine has no subject concept). */
export interface Subject {
  id: string;
  name: string;
  color: string;
}

/** An engine suggestion resolved against a full card (for the right panel). */
export interface ResolvedSuggestion {
  memonic: Memonic;
  score: number;
  cross: boolean;
  sharedTags: string[];
}

/** An outgoing or incoming link edge resolved against its neighbour card. */
export interface ResolvedLink {
  memonic: Memonic;
  title: string;
  cross: boolean;
  direction: "out" | "in";
}

export type ThemeMode = "dark" | "light";
export type SaveStatus = "idle" | "saving" | "saved" | "error";

// ========== 3. CONSTANTS ==========
// True when running inside the Tauri webview (desktop) vs a plain browser.
export const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

// Balanced, high-contrast subject palette tuned for both Precision Dark and Warm Paper Light.
const PALETTE = [
  "#2F9E68",
  "#D97736",
  "#7C6AF5",
  "#D6455D",
  "#2B8CBE",
  "#1E9E89",
  "#C85A8E",
  "#C7922E",
];

/** Set by boot.ts once load() finished — gates autosave (see persistence.isVaultReady). */
let ready = false;

// ========== 4. STATE ==========
// (module-level singletons — one shared vault for every component)
export const memonics = ref<Memonic[]>([]);        // reactive mirror of engine RAM
export const selectedSids = ref<number[]>([]);     // bulk-selection (Ctrl+click in the tree)
export const activeSid = ref<number | null>(null);
export const suggestions = ref<Suggestion[]>([]);  // Suggestion[] for the active card
export const colorMap = ref<Record<string, string>>({}); // subjectId -> hex (UI only)
export const theme = ref<ThemeMode>("dark");       // active UI theme ("dark" | "light")
export const vaultPath = ref<string>(isTauri ? "…" : "Browser session — vault lives in memory only");
export const saveStatus = ref<SaveStatus>("idle");
export const lastSaveError = ref<string>("");
/** Last file-import failure — rendered inline by the settings window (alert() is inert in the webview). */
export const lastImportFailed = ref(false);

// ========== 5. LOGIC ==========

export function isVaultReady(): boolean {
  return ready;
}

export function markVaultReady(): void {
  ready = true;
}

function snapshot(m: Memonic): Memonic {
  return { ...m, tags: [...m.tags], links: m.links.map((l) => ({ ...l })) };
}

export function refresh(): void {
  memonics.value = getAllMemonics().map(snapshot);
}

export function refreshSuggestions(): void {
  suggestions.value = activeSid.value != null ? findSuggestionsForMemonic(activeSid.value) : [];
}

export function dedupeExactClones(): number {
  const seen = new Set<string>();
  const clones: number[] = [];
  for (const m of getAllMemonics()) {
    if (m.links.length) continue;
    const sig = JSON.stringify([m.id, m.type, m.title, m.context, m.importance, m.status, m.hierarchy || "", [...m.tags].sort()]);
    if (seen.has(sig)) clones.push(m.sid);
    else seen.add(sig);
  }
  for (const sid of clones) deleteMemonicSafely(sid);
  return clones.length;
}

export const active = computed<Memonic | null>(() =>
  memonics.value.find((m) => m.sid === activeSid.value) ?? memonics.value[0] ?? null,
);

export const subjects = computed<Subject[]>(() => {
  const seen: string[] = [];
  for (const m of memonics.value) if (!seen.includes(m.id)) seen.push(m.id);
  return seen.map((id, i) => ({ id, name: id, color: colorMap.value[id] ?? PALETTE[i % PALETTE.length]! }));
});

export const activeSubject = computed<Subject | null>(() =>
  subjects.value.find((s) => s.id === active.value?.id) ?? subjects.value[0] ?? null,
);

export function memonicsBySubject(subjectId: string): Memonic[] {
  return memonics.value.filter((m) => m.id === subjectId);
}

export const deck = computed<Memonic[]>(() => {
  const a = active.value;
  return a ? memonics.value.filter((m) => m.id === a.id) : [];
});

export const totalLinks = computed<number>(() =>
  memonics.value.reduce((n, m) => n + m.links.length, 0),
);

export const crossSubjectLinkCount = computed<number>(() => {
  const bySid = new Map(memonics.value.map((m) => [m.sid, m]));
  let count = 0;
  for (const m of memonics.value) {
    for (const l of m.links) {
      const target = bySid.get(l.targetSID);
      if (target && target.id !== m.id) count++;
    }
  }
  return count;
});

export function linkCount(m: Memonic | null): number {
  if (!m) return 0;
  const backlinks = memonics.value.filter((o) => o.sid !== m.sid && o.links.some((l) => l.targetSID === m.sid)).length;
  return m.links.length + backlinks;
}

export const activeSuggestions = computed<ResolvedSuggestion[]>(() => {
  const a = active.value;
  const aTagsLower = new Set((a?.tags ?? []).map((t) => t.toLowerCase()));
  return suggestions.value
    .map((s) => {
      const target = memonics.value.find((m) => m.sid === s.targetSid);
      if (!target) return null;
      const sharedTags = target.tags.filter((t) => aTagsLower.has(t.toLowerCase()));
      return {
        memonic: target,
        score: s.score,
        cross: target.id !== a?.id,
        sharedTags,
      };
    })
    .filter((s): s is ResolvedSuggestion => s !== null);
});

/** Outgoing links authored on the active card. */
export const activeLinks = computed<ResolvedLink[]>(() => {
  const a = active.value;
  if (!a) return [];
  return a.links
    .map((l): ResolvedLink | null => {
      const target = memonics.value.find((m) => m.sid === l.targetSID);
      return target ? { memonic: target, title: l.title, cross: target.id !== a.id, direction: "out" } : null;
    })
    .filter((l): l is ResolvedLink => l !== null);
});

/** Incoming backlinks — cards elsewhere in the vault that point TO the active card. */
export const activeBacklinks = computed<ResolvedLink[]>(() => {
  const a = active.value;
  if (!a) return [];
  const out: ResolvedLink[] = [];
  for (const other of memonics.value) {
    if (other.sid === a.sid) continue;
    for (const l of other.links) {
      if (l.targetSID === a.sid) {
        out.push({
          memonic: other,
          title: l.title,
          cross: other.id !== a.id,
          direction: "in",
        });
      }
    }
  }
  return out;
});
