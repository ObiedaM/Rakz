// ─────────────────────────────────────────────────────────────────────────────
// useAgent() — THE AI-feature composable. Mirrors useLibrary's module-singleton
// pattern so every component shares one agent state.
//
// SECURITY CONTRACT (non-negotiable):
//   • the API key exists ONLY in the OS keychain and transient call frames
//     (plus optional session-only RAM fallback). NEVER settings.json, never
//     localStorage, never a Vue ref, never echoed to the DOM after saving.
//   • the model id is NOT a secret — it may persist (localStorage).
// ─────────────────────────────────────────────────────────────────────────────

// ========== 1. IMPORTS ==========
import { computed, ref } from "vue";

import { useLibrary } from "@/composables/library";
import type { Memonic } from "@/composables/library";
import {
  hasSessionKey,
  listAvailableModels,
  queryOpenRouter,
  setSessionKey,
} from "@/agent/ai-provider";
import type { AIProviderConfig, ModelInfo } from "@/agent/ai-provider";
import { clearKey, readKey, saveKey } from "@/agent/keychain";
import { fillPromptTemplate, getCopilotMode } from "@/agent/prompt-templates";
import type { CopilotModeId } from "@/agent/prompt-templates";

// ========== 2. TYPES ==========
export type KeyStatus = "stored" | "unset" | "unavailable";

// ========== 3. CONSTANTS ==========
const MODEL_STORAGE_KEY = "rakaz.ai.model";

const OPENROUTER: AIProviderConfig = {
  providerId: "openrouter",
  baseUrl: "https://openrouter.ai/api/v1",
  models: [
    { id: "openrouter/free", name: "Free Models Router", free: true },
    { id: "openai/gpt-oss-20b:free", name: "OpenAI: gpt-oss-20b (free)", free: true },
    { id: "z-ai/glm-5.2:free", name: "Z.ai: GLM 5.2 (free)", free: true },
    { id: "google/gemma-4-31b-it:free", name: "Google: Gemma 4 31B (free)", free: true },
    { id: "nvidia/nemotron-3.5-lightning:free", name: "NVIDIA: Nemotron 3.5 Lightning (free)", free: true },
    { id: "openai/gpt-4o-mini", name: "OpenAI: GPT-4o mini", free: false },
    { id: "anthropic/claude-3.5-haiku", name: "Anthropic: Claude 3.5 Haiku", free: false },
    { id: "google/gemini-2.0-flash-001", name: "Google: Gemini 2.0 Flash", free: false },
  ],
};

const BASE_SYSTEM_PROMPT =
  "You are RAKZ's restrained study co-pilot. You help the learner understand, recall, and connect " +
  "their mnemonic cards across subjects without doing the cognitive encoding work for them. " +
  "Answer concisely, referencing card titles when useful, and match the language of the learner's cards or question (Arabic or English).";

// ========== 4. STATE ==========
const open = ref(false);
const busy = ref(false);
const answer = ref("");
const error = ref("");
const mode = ref<CopilotModeId>("quiz");
const keyStatus = ref<KeyStatus>("unset");
const keychainError = ref("");
const models = ref<ModelInfo[]>(OPENROUTER.models);
const model = ref<string>(localStorage.getItem(MODEL_STORAGE_KEY) || OPENROUTER.models[0]!.id);

// ========== 5. LOGIC ==========

function contextCards(): Memonic[] {
  const { memonics, selectedSids, active } = useLibrary();
  if (selectedSids.value.length) {
    const set = new Set(selectedSids.value);
    return memonics.value.filter((m) => set.has(m.sid));
  }
  return active.value ? [active.value] : [];
}

export const contextCount = computed(() => contextCards().length);

export async function refreshKeyStatus(): Promise<KeyStatus> {
  if (hasSessionKey()) {
    keyStatus.value = "stored";
    keychainError.value = "";
    return keyStatus.value;
  }
  try {
    const key = await readKey();
    keyStatus.value = key ? "stored" : "unset";
    keychainError.value = "";
  } catch (e) {
    keyStatus.value = "unavailable";
    keychainError.value = e instanceof Error ? e.message : String(e);
  }
  return keyStatus.value;
}

export async function storeKey(value: string): Promise<KeyStatus> {
  const v = value.trim();
  if (!v) return refreshKeyStatus();
  if (keyStatus.value === "unavailable") {
    setSessionKey(v);
    keyStatus.value = "stored";
    keychainError.value = "";
    return keyStatus.value;
  }
  await saveKey(v);
  return refreshKeyStatus();
}

export async function removeKey(): Promise<KeyStatus> {
  setSessionKey("");
  try {
    await clearKey();
  } catch {
    /* ignore in browser mode */
  }
  return refreshKeyStatus();
}

export function setModel(id: string): void {
  model.value = id;
  try {
    localStorage.setItem(MODEL_STORAGE_KEY, id);
  } catch {
    /* ignore */
  }
}

export async function refreshModels(): Promise<void> {
  models.value = await listAvailableModels(OPENROUTER);
  if (!models.value.some((m) => m.id === model.value)) setModel(models.value[0]?.id ?? model.value);
}

export async function ask(question: string, activeMode: CopilotModeId = mode.value): Promise<boolean> {
  const cfg = getCopilotMode(activeMode);
  const cards = contextCards();
  const primary = cards[0];
  let q = question.trim();
  if (!q && cfg.defaultPrompt && primary) {
    q = fillPromptTemplate(cfg.defaultPrompt, primary, "");
  }
  if (!q || busy.value) return false;

  await refreshKeyStatus();
  if (keyStatus.value === "unset") {
    error.value = "No OpenRouter API key configured. Add one in Settings → AI.";
    return false;
  }
  if (keyStatus.value === "unavailable") {
    error.value = keychainError.value || "Keychain unavailable. Add a session key in Settings → AI.";
    return false;
  }

  busy.value = true;
  error.value = "";
  answer.value = "";
  try {
    const sys = `${BASE_SYSTEM_PROMPT}\n\n${cfg.systemAddendum}`;
    answer.value = await queryOpenRouter(OPENROUTER, model.value, sys, q, cards);
    return true;
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e);
    return false;
  } finally {
    busy.value = false;
  }
}

export async function testConnection(): Promise<boolean> {
  return ask("Reply with the single word OK.", "ask");
}

export function openAsk(initialMode?: CopilotModeId): void {
  if (initialMode) mode.value = initialMode;
  answer.value = "";
  error.value = "";
  open.value = true;
}

export function closeAsk(): void {
  open.value = false;
}

export function useAgent() {
  return {
    open,
    busy,
    answer,
    error,
    mode,
    keyStatus,
    keychainError,
    models,
    model,
    contextCount,
    ask,
    testConnection,
    openAsk,
    closeAsk,
    storeKey,
    removeKey,
    refreshKeyStatus,
    setModel,
    refreshModels,
  };
}
