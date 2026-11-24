// ========== src/agent/ai-provider.ts ==========
// OpenRouter client — reads API key transiently from keychain (or session RAM)
// at request time, never writes to vault or settings.json.

import type { Memonic } from "@/composables/library";
import { readKey } from "./keychain";

export interface ModelInfo {
  id: string;
  name: string;
  free: boolean;
}

export interface AIProviderConfig {
  providerId: "openrouter";
  baseUrl: string;
  models: ModelInfo[];
}

interface OpenRouterMessage {
  role: "system" | "user" | "assistant";
  content: string;
}
interface OpenRouterRequest {
  model: string;
  messages: OpenRouterMessage[];
  temperature?: number;
  max_tokens?: number;
}
interface OpenRouterResponse {
  choices: { message: { content: string } }[];
  error?: { message: string; code: number };
}

const OPENROUTER_TIMEOUT_MS = 30000;
const APP_REFERER = "https://github.com/ObiedaM/Rakz";
const APP_TITLE = "RAKZ";

function sanitizeErrorBody(raw: string): string {
  return raw
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, "Bearer [redacted]")
    .replace(/sk-[A-Za-z0-9._-]+/gi, "[redacted]")
    .slice(0, 240);
}

// Session-only key fallback for headless Linux / browser sessions. RAM only.
let sessionKey = "";
export function setSessionKey(value: string): void {
  sessionKey = value;
}
export function hasSessionKey(): boolean {
  return sessionKey.length > 0;
}

async function getApiKey(): Promise<string> {
  if (sessionKey) return sessionKey;
  return await readKey();
}

export async function queryOpenRouter(
  config: AIProviderConfig,
  model: string,
  systemPrompt: string,
  userMessage: string,
  memonics: Memonic[],
  temperature?: number,
): Promise<string> {
  if (!config.baseUrl.startsWith("https://")) {
    throw new Error("Refusing to send API credentials over an insecure non-HTTPS endpoint.");
  }
  const apiKey = await getApiKey();
  if (!apiKey) {
    throw new Error("OpenRouter API key is not set. Add it in Settings → AI.");
  }

  const memonicContext = memonics
    .map((m) => {
      const tagLine = m.tags.length ? `\nTags: ${m.tags.map((t) => `#${t}`).join(" ")}` : "";
      return `[${m.id} · ${m.type.toUpperCase()} · strength ${m.importance}/5] ${m.title}\n${m.context}${tagLine}`;
    })
    .join("\n\n---\n\n");
  const fullSystemPrompt = memonicContext
    ? `${systemPrompt}\n\nLearner's mnemonic cards:\n${memonicContext}`
    : systemPrompt;

  const requestBody: OpenRouterRequest = {
    model,
    messages: [
      { role: "system", content: fullSystemPrompt },
      { role: "user", content: userMessage },
    ],
    temperature: temperature ?? 0.6,
    max_tokens: 1500,
  };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), OPENROUTER_TIMEOUT_MS);

  try {
    const response = await fetch(`${config.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        "HTTP-Referer": APP_REFERER,
        "X-Title": APP_TITLE,
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal,
    });

    if (!response.ok) {
      let errorBody = "";
      try {
        errorBody = await response.text();
      } catch {
        errorBody = "(unable to read error body)";
      }
      if (response.status === 401 || response.status === 403)
        throw new Error(`API key rejected (${response.status}). Check your OpenRouter key in Settings.`);
      if (response.status === 429)
        throw new Error("Rate limit exceeded. Wait a moment and try again.");
      if (response.status >= 500)
        throw new Error(`OpenRouter server error (${response.status}). Try again later.`);
      throw new Error(`OpenRouter API error (${response.status}): ${sanitizeErrorBody(errorBody)}`);
    }

    let data: OpenRouterResponse;
    try {
      data = await response.json();
    } catch {
      throw new Error("Failed to parse OpenRouter response. The server may be having issues.");
    }

    if (data.error)
      throw new Error(`OpenRouter error: ${data.error.message} (code ${data.error.code})`);

    const content = data.choices?.[0]?.message?.content;
    if (!content && content !== "")
      throw new Error("OpenRouter returned an empty response. Try another model or prompt.");

    return content;
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError")
      throw new Error(`AI request timed out after ${OPENROUTER_TIMEOUT_MS / 1000}s. Try a faster model.`);
    if (err instanceof TypeError && (err.message.includes("fetch") || err.message.includes("Load failed")))
      throw new Error("Network error: unable to reach OpenRouter. Check your connection.");
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function listAvailableModels(config: AIProviderConfig): Promise<ModelInfo[]> {
  try {
    const response = await fetch(`${config.baseUrl}/models`);
    if (!response.ok) return config.models;
    const data = (await response.json()) as {
      data?: { id: string; name?: string; pricing?: { prompt?: string } }[];
    };
    const list: ModelInfo[] = (data.data ?? []).map((m) => ({
      id: m.id,
      name: m.name ?? m.id,
      free: m.pricing?.prompt === "0",
    }));
    if (!list.length) return config.models;
    list.sort((a, b) => Number(b.free) - Number(a.free) || a.id.localeCompare(b.id));
    return list;
  } catch {
    return config.models;
  }
}
