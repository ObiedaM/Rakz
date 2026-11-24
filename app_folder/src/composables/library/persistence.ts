// ─────────────────────────────────────────────────────────────────────────────
// Persistence — how the vault reaches disk (desktop only).
// The vault is the WHOLE $APPDATA/com.rakz.app/mnemonics TREE. Saves are
// debounced (800ms), grouped by hierarchy (case-insensitively safe for Windows
// NTFS), written atomically by the Rust courier, and files that empty out are
// deleted. Saves and locateCard share ONE serializer + grouping path so line
// numbers match the bytes on disk exactly.
// ─────────────────────────────────────────────────────────────────────────────

// ========== 1. IMPORTS ==========
import { parseMns, serializeToMns } from "@rakz-app/mns-parser";
import type { MnemoDocument as WireDocument } from "@rakz-app/mns-parser";
import { invoke } from "@tauri-apps/api/core";

import type { Memonic } from "@engine/types";
import { toDocument } from "@engine/bridge";
import { getAllMemonics } from "@engine/memory-store";

import { isTauri, isVaultReady, lastSaveError, saveStatus } from "./state";

// ========== 2. TYPES ==========
/** Where a card lives on disk: vault-relative file plus 1-based line of its `mn===` opener. */
export interface CardLocation {
  file: string;
  line: number;
}

/** Loose shape of a mnemonic inside a legacy .rkz JSON export. */
interface RkzMnemonic {
  title?: string;
  context?: string;
  id?: string;
  type?: string;
  importance?: number | string;
  status?: string;
  sid?: number | string;
  hierarchy?: string;
  tags?: string[];
  links?: { title?: string; targetSID?: number | string | null }[];
}

// ========== 3. CONSTANTS ==========
const PERSIST_DEBOUNCE_MS = 800;
// Windows NTFS reserved DOS device names (invalid as filenames with or without extension).
const WIN_RESERVED = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\..*)?$/i;

// ========== 4. STATE ==========
// Vault files we have read or written — a file whose last card moved or died
// is stale and gets deleted on the next save.
const managedFiles = new Set<string>();
let persistTimer: ReturnType<typeof setTimeout> | null = null;
let saveInFlight: Promise<void> | null = null;
let saveQueued = false;

// ========== 5. LOGIC ==========

export function wireFromText(text: string): WireDocument | null {
  const t = String(text);
  if (t.trimStart().startsWith("%RAKZ")) return parseMns(t);
  try {
    const data = JSON.parse(t) as Partial<{ memonics: RkzMnemonic[] }>;
    if (!data || !Array.isArray(data.memonics)) return null;
    return {
      schemaVersion: "0.1", flags: [], hierarchy: [], fileNotes: [], closedImplicitly: false,
      mnemonics: data.memonics.map((m) => ({
        title: m.title ?? "", context: m.context ?? "", id: m.id, type: m.type,
        importance: m.importance != null ? String(m.importance) : undefined,
        status: m.status, sid: m.sid != null ? String(m.sid) : undefined,
        hierarchy: m.hierarchy, tags: m.tags ?? [], keywords: [], notes: [],
        links: (m.links ?? []).map((l) => ({ title: l.title ?? "", targetSID: l.targetSID != null ? String(l.targetSID) : null })),
      })),
    };
  } catch {
    return null;
  }
}

function stripControlChars(s: string): string {
  let out = "";
  for (let i = 0; i < s.length; i++) {
    out += s.charCodeAt(i) < 32 ? "-" : s[i]!;
  }
  return out;
}

/**
 * Sanitize a hierarchy path into a safe cross-platform relative path ('/'-separated).
 * Guards path traversal, illegal Windows NTFS chars, trailing dots/spaces, and reserved device names.
 */
export function sanitizeHir(p: string): string {
  const segs = String(p)
    .replace(/\\/g, "/")
    .split("/")
    .map((raw) => {
      // Strip control chars and illegal Windows/POSIX characters
      const cleaned = stripControlChars(raw.trim())
        .replace(/[:*?"<>|]/g, "-")
        .replace(/[. ]+$/g, "");
      if (!cleaned || cleaned === "." || cleaned === "..") return "";
      return WIN_RESERVED.test(cleaned) ? `_${cleaned}` : cleaned;
    })
    .filter(Boolean);
  return segs.length ? segs.join("/") : "vault";
}

export function fileNameFor(m: Memonic): string {
  return sanitizeHir(m.hierarchy || m.id || "vault") + ".mns";
}

/**
 * Group cards by file using case-insensitive collision keys so Windows NTFS
 * never overwrites/deletes cards whose subjects differ only in casing
 * (e.g. "Biology" vs "biology"). Shared by saveNow() and locateCard().
 */
export function groupCardsByFile(cards: Memonic[]): Map<string, Memonic[]> {
  const canonicalName = new Map<string, string>(); // lower -> first-seen canonical path
  const groups = new Map<string, Memonic[]>();
  for (const m of cards) {
    const raw = fileNameFor(m);
    const key = raw.toLowerCase();
    let name = canonicalName.get(key);
    if (!name) {
      name = raw;
      canonicalName.set(key, name);
      groups.set(name, []);
    }
    groups.get(name)!.push(m);
  }
  return groups;
}

/**
 * Compute which managed files are truly stale (safe on case-insensitive NTFS):
 * a file whose case-folded name still exists in the newly written set is NEVER deleted.
 */
export function findStaleFiles(tracked: Iterable<string>, writtenNames: Iterable<string>): { toDelete: string[]; caseRenamed: string[] } {
  const writtenExact = new Set(writtenNames);
  const writtenLower = new Set([...writtenExact].map((n) => n.toLowerCase()));
  const toDelete: string[] = [];
  const caseRenamed: string[] = [];
  for (const name of tracked) {
    if (writtenExact.has(name)) continue;
    if (writtenLower.has(name.toLowerCase())) caseRenamed.push(name);
    else toDelete.push(name);
  }
  return { toDelete, caseRenamed };
}

async function performSave(): Promise<void> {
  saveStatus.value = "saving";
  lastSaveError.value = "";
  try {
    const groups = groupCardsByFile(getAllMemonics());
    for (const [name, cards] of groups) {
      await invoke("write_mns_file", { name, content: serializeToMns(toDocument(cards)) });
      managedFiles.add(name);
    }
    const { toDelete, caseRenamed } = findStaleFiles(managedFiles, groups.keys());
    // Untrack old-cased aliases without deleting the NTFS file we just wrote
    for (const oldCase of caseRenamed) {
      managedFiles.delete(oldCase);
    }
    for (const name of toDelete) {
      await invoke("delete_mns_file", { name });
      managedFiles.delete(name);
    }
    saveStatus.value = "saved";
  } catch (e) {
    saveStatus.value = "error";
    lastSaveError.value = e instanceof Error ? e.message : String(e);
    console.error("[rakaz] vault save failed:", e);
  }
}

export async function saveNow(): Promise<void> {
  if (!isTauri || !isVaultReady()) return;
  clearTimeout(persistTimer ?? undefined);
  persistTimer = null;
  if (saveInFlight) {
    saveQueued = true;
    await saveInFlight;
    return;
  }
  saveInFlight = (async () => {
    try {
      do {
        saveQueued = false;
        await performSave();
      } while (saveQueued);
    } finally {
      saveInFlight = null;
    }
  })();
  await saveInFlight;
}

export function schedulePersist(): void {
  if (!isTauri || !isVaultReady()) return;
  clearTimeout(persistTimer ?? undefined);
  persistTimer = setTimeout(() => void saveNow(), PERSIST_DEBOUNCE_MS);
}

export async function openVaultFolder(): Promise<void> {
  if (!isTauri) return;
  try {
    await invoke("open_root_folder");
  } catch (e) {
    console.error("[rakaz] open folder failed:", e);
  }
}

export function locateCard(sid: number): CardLocation | null {
  const all = getAllMemonics();
  const m = all.find((x) => x.sid === sid);
  if (!m) return null;
  const groups = groupCardsByFile(all);
  let file = fileNameFor(m);
  let group: Memonic[] = [];
  for (const [name, cards] of groups) {
    if (cards.some((x) => x.sid === sid)) {
      file = name;
      group = cards;
      break;
    }
  }
  const idx = group.findIndex((x) => x.sid === sid);
  const lines = serializeToMns(toDocument(group)).split("\n");
  let count = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i] === "mn===") {
      count++;
      if (count === idx) return { file, line: i + 1 };
    }
  }
  return { file, line: 1 };
}

export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    /* webview may refuse */
  }
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    ta.remove();
    return ok;
  } catch {
    return false;
  }
}

export function trackManagedFile(name: string): void {
  managedFiles.add(name);
}
