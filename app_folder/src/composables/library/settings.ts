// ─────────────────────────────────────────────────────────────────────────────
// Settings — shareable UI settings (settings.json in the vault root), theme
// ("dark" | "light") synced to DOM + Windows 11 native titlebar, and the
// subject color map. Schema v1: `language`/`font` remain reserved keys —
// preserved on import and round-tripped untouched.
// ─────────────────────────────────────────────────────────────────────────────

// ========== 1. IMPORTS ==========
import { computed } from "vue";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";

import { serializeToMns } from "@rakz-app/mns-parser";
import { toDocument } from "@engine/bridge";
import { getAllMemonics } from "@engine/memory-store";

import { colorMap, isTauri, memonics, subjects, theme, totalLinks } from "./state";
import type { ThemeMode } from "./state";
import { openVaultFolder } from "./persistence";

// ========== 2. TYPES ==========
/** Shape of settings.json on disk (schema v1). */
export interface UiSettingsFile {
  app: "RAKZ";
  kind: "ui-settings";
  version: 1;
  theme?: ThemeMode;
  colors: Record<string, string>;
  [reserved: string]: unknown;
}

// ========== 3. CONSTANTS ==========
const COLORS_STORAGE_KEY = "rakaz.colors";
const THEME_STORAGE_KEY = "rakaz.theme";

// ========== 4. STATE ==========
let importedExtras: Record<string, unknown> = {};

// ========== 5. LOGIC ==========

/** Apply theme to <html> data attribute + sync Windows 11 native DWM titlebar. */
export function syncThemeToHost(mode: ThemeMode): void {
  if (typeof document !== "undefined") {
    document.documentElement.dataset.theme = mode;
    document.documentElement.style.colorScheme = mode;
  }
  if (isTauri) {
    try {
      void getCurrentWindow().setTheme(mode);
    } catch {
      /* non-fatal on platforms without dynamic titlebar theme */
    }
  }
}

export function loadColors(): void {
  try {
    colorMap.value = JSON.parse(localStorage.getItem(COLORS_STORAGE_KEY) || "{}") as Record<string, string>;
  } catch {
    colorMap.value = {};
  }
  try {
    const savedTheme = localStorage.getItem(THEME_STORAGE_KEY);
    theme.value = savedTheme === "light" ? "light" : "dark";
  } catch {
    theme.value = "dark";
  }
  syncThemeToHost(theme.value);
}

export function setTheme(mode: ThemeMode): void {
  theme.value = mode;
  syncThemeToHost(mode);
  try {
    localStorage.setItem(THEME_STORAGE_KEY, mode);
  } catch {
    /* ignore */
  }
  void persistSettingsFile();
}

export function toggleTheme(): void {
  setTheme(theme.value === "dark" ? "light" : "dark");
}

export function saveColors(): void {
  try {
    localStorage.setItem(COLORS_STORAGE_KEY, JSON.stringify(colorMap.value));
  } catch {
    /* ignore */
  }
  void persistSettingsFile();
}

export function setSubjectColor(subjectId: string, hex: string): void {
  colorMap.value = { ...colorMap.value, [subjectId]: hex };
  saveColors();
}

function settingsPayload(): UiSettingsFile {
  return {
    app: "RAKZ",
    kind: "ui-settings",
    version: 1,
    ...importedExtras,
    theme: theme.value,
    colors: colorMap.value,
  };
}

async function persistSettingsFile(): Promise<void> {
  if (!isTauri) return;
  try {
    await invoke("write_mns_file", { name: "settings.json", content: JSON.stringify(settingsPayload(), null, 2) });
  } catch (e) {
    console.error("[rakaz] settings save failed:", e);
  }
}

export function applySettings(data: unknown): boolean {
  if (!data || typeof data !== "object") return false;
  const d = data as { kind?: string; colors?: Record<string, string>; theme?: unknown };
  if (d.kind !== "ui-settings" || typeof d.colors !== "object") return false;
  const rest = { ...(d as Record<string, unknown>) };
  delete rest.app;
  delete rest.kind;
  delete rest.version;
  delete rest.colors;
  delete rest.theme;
  importedExtras = rest;

  if (d.theme === "dark" || d.theme === "light") {
    theme.value = d.theme;
    syncThemeToHost(d.theme);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, d.theme);
    } catch {
      /* ignore */
    }
  }
  colorMap.value = { ...colorMap.value, ...d.colors };
  try {
    localStorage.setItem(COLORS_STORAGE_KEY, JSON.stringify(colorMap.value));
  } catch {
    /* ignore */
  }
  return true;
}

export async function exportSettings(): Promise<void> {
  if (isTauri) {
    await persistSettingsFile();
    await openVaultFolder();
    return;
  }
  downloadBlob(new Blob([JSON.stringify(settingsPayload(), null, 2)], { type: "application/json" }), "rakaz-settings.json");
}

export function importSettings(): void {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = ".json,application/json";
  input.onchange = () => {
    const file = input.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        if (applySettings(JSON.parse(String(reader.result)))) void persistSettingsFile();
        else console.warn("[rakaz] not a RAKZ ui-settings file");
      } catch {
        console.warn("[rakaz] invalid settings JSON");
      }
    };
    reader.readAsText(file);
  };
  input.click();
}

export const vaultStats = computed(() => ({
  cards: memonics.value.length,
  links: totalLinks.value,
  subjects: subjects.value.length,
}));

export function estimateVaultBytes(): number {
  try {
    return new TextEncoder().encode(serializeToMns(toDocument(getAllMemonics()))).length;
  } catch {
    return 0;
  }
}

export function downloadBlob(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}
