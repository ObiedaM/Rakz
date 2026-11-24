// ========== src/agent/keychain.ts ==========
// The SECOND Tauri seam — SECRETS ONLY. useLibrary remains the only module
// touching vault data + the engine; this file talks exclusively to the three
// keychain commands. Browser mode gracefully reports keychain unavailable
// instead of throwing an uncaught TypeError on window.__TAURI_INTERNALS__.

import { invoke } from "@tauri-apps/api/core";

const isTauri = () => typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

export async function saveKey(value: string): Promise<void> {
  if (!isTauri()) throw new Error("Browser session — OS keychain is available only in the desktop app.");
  return invoke<void>("save_secret", { value });
}

export async function readKey(): Promise<string> {
  if (!isTauri()) throw new Error("Browser session — OS keychain is available only in the desktop app.");
  return invoke<string>("get_secret");
}

export async function clearKey(): Promise<void> {
  if (!isTauri()) return;
  return invoke<void>("delete_secret");
}
