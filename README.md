# RAKZ

**Full mnemonic lifecycle management — local-first, offline-ready, and grounded in memory science.**

RAKZ transforms isolated memory aids into an interconnected, user-owned knowledge graph stored as human-readable `.mns` files on your computer. Create structured mnemonics, connect concepts across subjects with named structural bridges, reinforce long-term recall with built-in active retrieval & spaced repetition, and optionally bring your own OpenRouter API key for a restrained Socratic co-pilot that scaffolds thinking without doing the cognitive work for you.

## Key Capabilities

- **4 Integrated Modes:** Focused **Stack** studio (L1 Condensed Hook, L2 Core Explanation, L3 Deep Roots & First Principles), **Study** mode (3-stage graduated recall, metacognitive cues, local spaced-repetition scheduler, 14-day spacing cadence, and Islands → Bridges diagnostics), subject-grouped **Grid**, and interactive force-directed **Graph** with cross-subject bridge highlighting.
- **Bidirectional Connections & Bilingual RTL:** Suggested cross-subject bridges, outgoing links, and incoming backlinks update live as you tag and connect concepts, with native `dir="auto"` Arabic (RTL) and English (LTR) support.
- **Restrained AI Co-Pilot (BYOK):** Read-only Socratic scaffolds (*Quiz Me*, *Find Bridges*, *Critique Hook*, *Ask Why*) backed by your OS keychain via OpenRouter over HTTPS — never writes directly to your vault.
- **Dual Native Themes:** **Precision Dark** and **Warm Paper & Ink Light**, synced to native Windows 11 titlebars and persisted in shareable `settings.json`.
- **Windows 11 Ready & Security-First:** Native `rakz.exe` binary with Windows 10/11 PerMonitorV2 + LongPathAware + UTF-8 manifest, strict Content Security Policy, sandboxed IO with extension allowlist and Defender/Indexer atomic-write retry, per-user NSIS and MSI installers, and `.mns` file association.

## Prebuilt Windows 11 Binaries

Ready-to-run Windows 11 (x64) packages are published in [`releases/windows/`](releases/windows/):
- `RAKZ_0.1.0_x64-setup.exe` — Per-user NSIS installer (recommended, no admin required)
- `RAKZ_0.1.0_x64_en-US.msi` — Windows MSI installer
- `rakz.exe` — Standalone portable executable

## Architecture

| Folder | Role | Guardrails |
|---|---|---|
| `engine_folder/` | `@rakz/engine` — pure TypeScript domain store, actions, link scoring, and bridge. Zero DOM/Vue/Tauri imports. | Untouched by UI shell; mirrors upstream `rakz-app/rakz` |
| `io_folder/` | `rakz-io` Rust crate — 9 sandboxed async Tauri commands (`safe_join`, Windows-safe atomic writes, OS keyring) | No parsing, no business logic, no network |
| `app_folder/` | Vite + Vue 3 + TypeScript frontend + thin Tauri 2 shell consuming `rakz-io` | UI components import only `@/composables/library` |

## Commands (run inside `app_folder/`)

```bash
npm install          # installs deps (uses .npmrc install-links=true for Windows without Developer Mode)
npm run dev          # Vite dev server (browser mode)
npm run tauri dev    # Desktop app (Tauri 2)
npm run tauri build  # Production Windows 11 / Linux / macOS bundle
npm run build        # vue-tsc strict typecheck + Vite production build
npm run lint         # ESLint flat config
npm test             # Vitest test suite
```

Rust IO unit tests (cross-platform Windows & Unix):

```bash
cd io_folder && cargo test
```

## Non-Negotiable Invariants

1. Only `composables/library/*` imports `@engine/*` and `@tauri-apps/*` (exception: `agent/keychain.ts`, secrets only).
2. Every engine mutation is followed by `refresh()` — deep snapshots, never shared references.
3. Zero native `confirm()` / `alert()` / `prompt()` — accessible two-step arm→confirm UI with timeout reset and `Esc` cancel.
4. Saves and `locateCard` share one serializer and NTFS-safe file grouping path (`persistence.ts`).
5. Boot guards: HMR skip-reimport, single-instance plugin FIRST, `dedupeExactClones()` healer, saves gated on ready.
6. Dot-directories are invisible to the vault scanner (`.exports/`, `.study/`, and `settings.json` stay safely separated).
