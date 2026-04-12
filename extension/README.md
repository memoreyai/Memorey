# Memorey Chrome Extension (Manifest V3)

React sidebar extension powered by memorey-core. Runs fully offline with optional Supabase cloud sync.

## Prerequisites

Build memorey-core first:

```bash
cd memorey-core
npm install
npm run build
```

## Build

```bash
cd extension
npm install
npm run build
```

Bundles the sidebar React app, background service worker, and content script into `dist/`.

### Supabase Sync (Optional)

To enable cloud sync with the Memorey web app backend, set environment variables before building:

```bash
export NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
export NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
npm run build
```

These are injected at build time via esbuild `define`. If not set, the extension works fully offline.

## Load in Chrome

1. Chrome → **Extensions** → **Developer mode** → **Load unpacked**
2. Select the `extension` directory (contains `manifest.json` and `dist/`)
3. Click the Memorey icon to open the sidebar

## Development

```bash
npm run watch
```

Watches for changes and rebuilds automatically.

## Architecture

- **Sidebar** — React 18 app in `sidebar/`, state via Context + useReducer
- **memorey-core** — Imported as a local dependency (`file:../memorey-core`), runs directly in the sidebar
- **Persistence** — `chrome.storage.local` (falls back to `localStorage` in dev)
- **Sync** — Optional bidirectional sync with Supabase via `SyncService`
- **Build** — esbuild bundles TS/TSX → `dist/`

### Key Modules

| Module | Path | Description |
|--------|------|-------------|
| Store | `sidebar/store/memoreyStore.ts` | Global state with Context + useReducer |
| Engine | `sidebar/hooks/useMemoreyEngine.ts` | Pipeline init, persistence, sync orchestration |
| SyncService | `sidebar/services/SyncService.ts` | Offline-first Supabase sync (pull/push/auto-sync) |
| Supabase | `sidebar/utils/supabase.ts` | Client factory with build-time config |
| Settings | `sidebar/views/SettingsView.tsx` | Account connection, sync controls, AI config, data export |

## Connecting to Supabase

1. Open the extension sidebar
2. Click the gear icon → Settings
3. Paste your Supabase access token (from Memorey web app → Settings)
4. Click "Connect"

The extension will pull your cloud data and start auto-syncing every 5 seconds.

## Icons

Replace `icons/icon16.png`, `icons/icon48.png`, `icons/icon128.png` with real assets.
