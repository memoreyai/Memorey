# Memorey Chrome Extension (Manifest V3)

React sidebar extension powered by memorey-core. Build before loading in Chrome.

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

This bundles the sidebar React app, background service worker, and content script into `dist/`.

## Load unpacked

1. Chrome → **Extensions** → **Developer mode** → **Load unpacked**
2. Choose the `extension` directory (after `npm run build`)
3. Click the Memorey icon to open the sidebar

## Development

```bash
npm run watch
```

Watches for changes and rebuilds automatically.

## Architecture

- **Sidebar** — React 18 app in `sidebar/`, state via Context + useReducer
- **memorey-core** — imported as a local dependency (`file:../memorey-core`), runs directly in the sidebar
- **Persistence** — chrome.storage.local (falls back to localStorage in dev)
- **Build** — esbuild bundles TS/TSX → `dist/`

## Icons

Replace `icons/icon16.png`, `icons/icon48.png`, `icons/icon128.png` with real assets.
