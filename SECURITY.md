# Security Policy

## Security Model

RAKZ is designed as a **local-first, zero-telemetry desktop application**:

- **Plain-Text Local Ownership:** All mnemonic cards live in human-readable `.mns` files inside your OS app-data directory. No cloud sync or external telemetry is collected.
- **Sandboxed Rust IO (`io_folder/`):** Every file command validates relative paths through a strict whitelist (`safe_join` rejects `..`, absolute roots, backslashes, NUL bytes, and Windows Alternate Data Streams `:`), verifies canonical paths stay inside the vault root, and restricts `open_mns_file` to text formats (`.mns`, `.rkz`, `.txt`, `.json`) so executables can never be launched from the vault.
- **Strict Content Security Policy:** Production desktop builds enforce a strict CSP (`script-src 'self'`, `object-src 'none'`, `frame-ancestors 'none'`, `connect-src` limited to local IPC and `https://openrouter.ai`).
- **OS Keychain Secret Isolation:** Optional BYOK OpenRouter API keys are stored exclusively in the OS keychain (Windows Credential Manager / macOS Keychain / Linux Secret Service) via `rakz-io`. Keys are never written to `.mns` files, `settings.json`, or `localStorage`, are transmitted only over HTTPS, and are redacted from error surfaces.

## Supported Versions

| Version | Supported |
| --- | --- |
| `0.2.x` | Yes |
| `< 0.2.0` | No |

## Reporting a Vulnerability

If you discover a security issue in RAKZ, please open a private security advisory under the **Security** tab of this repository rather than posting exploit details in a public issue. Include steps to reproduce, affected OS/version, and impact so it can be patched promptly.
