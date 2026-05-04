# Design: Preact Islands + HTMX CDN refactor

Date: 2026-05-05
Status: approved

## Goal

Reduce client-side JS by replacing template-string HTML rendering with Preact islands. Switch HTMX from a copied local file to a CDN import. Keep all data logic (Mistral API call, IndexedDB) client-side. No client build step.

## Architecture

```
Browser                             Cloudflare Worker (Hono)
──────────────────────────          ──────────────────────────
Import map → esm.sh CDN             GET /       → full page (layout + InputView)
  preact@10                         GET /views/input    → HTML shell
  preact/hooks                      GET /views/list     → HTML shell
  htm/preact                        GET /views/history  → HTML shell
  canvas-confetti@1.6.0             GET /views/setup    → HTML shell

HTMX (unpkg CDN, pinned @2.0.10)   Static assets (Wrangler public/)
  tab navigation only                 app.js (ES module)
  swaps #main-content                 manifest.json, sw.js, icons

Preact islands (inside app.js)
  ShoppingList  →  #categories-container
  HistoryList   →  #history-container
  mount on htmx:afterSwap, receive props from app.js
```

## Changes

### 1. `src/layout.tsx` — script loading

Replace `/htmx.min.js` with CDN. Add import map before `app.js`. Change `app.js` to `type="module"`.

```html
<script src="https://unpkg.com/htmx.org@2.0.10/dist/htmx.min.js" />

<script type="importmap">{
  "imports": {
    "preact":           "https://esm.sh/preact@10",
    "preact/hooks":     "https://esm.sh/preact@10/hooks",
    "htm/preact":       "https://esm.sh/htm@3.1.1?preact",
    "canvas-confetti":  "https://esm.sh/canvas-confetti@1.6.0"
  }
}</script>

<script type="module" src="/app.js" />
```

### 2. `public/app.js` — ES module refactor

**Imports at top:**
```js
import { render } from 'preact'
import { useState, useEffect } from 'preact/hooks'
import { html } from 'htm/preact'
import confetti from 'canvas-confetti'
```

**Remove:** `renderList()`, `renderHistory()` — replaced by Preact components.

**Add:** `ShoppingList` component, `HistoryList` component (see §3, §4).

**Keep:** all Mistral API logic, IndexedDB (DB object), modal functions, navigation, utils.

**Global namespace** — one object on window for all functions called from inline HTML `onclick` attrs:
```js
window.App = {
  openModal, closeModal, handleOverlayClick, toggleReveal,
  saveSettings, saveFromSetup, clearApiKey,
  processWithMistral, handleNavClick,
  saveCurrentList, discardCurrentList, clearAllHistory,
}
```

All `onclick="..."` attrs in Hono JSX views and HTMX fragments updated to `onclick="App.fnName()"`.

### 3. `ShoppingList` Preact island

Mounts in `#categories-container` after `htmx:afterSwap` for the list view.

- Receives `list` (currentList object) and `onSave`, `onDiscard` callbacks as props
- Manages `cats` state (copy of `list.categories`) internally
- Handles `toggleItem`, `toggleCat` as internal handlers — not on `window.App`
- Renders progress bar, category headers with collapse, item checkboxes
- Fires confetti when all items across all categories are checked:

```js
const allDone = allItems.length > 0 && allItems.every(i => i.checked)
useEffect(() => {
  if (allDone) confetti({ particleCount: 120, spread: 70, origin: { y: 0.6 } })
}, [allDone])
```

Confetti fires once per completion — `allDone` stays `true` until a new list is loaded.

### 4. `HistoryList` Preact island

Mounts in `#history-container` after `htmx:afterSwap` for the history view.

- Receives `lists` (array from IndexedDB) and `onLoad`, `onDelete`, `onClear` callbacks
- Renders history cards
- `onDelete` / `onClear` call DB ops in app.js then re-fetch and re-render

### 5. Island mount lifecycle

```js
document.addEventListener('htmx:afterSwap', async (e) => {
  if (e.detail.target.id !== 'main-content') return
  if (currentView === 'list')    mountListIsland()
  if (currentView === 'history') mountHistoryIsland()
})

function mountListIsland() {
  const el = document.getElementById('categories-container')
  if (el) render(
    html`<${ShoppingList} list=${currentList} onSave=${saveCurrentList} onDiscard=${discardCurrentList} />`,
    el
  )
}

async function mountHistoryIsland() {
  const el = document.getElementById('history-container')
  if (!el) return
  const lists = await DB.getAll()
  render(html`<${HistoryList} lists=${lists} onLoad=${loadHistory} onDelete=${delHistory} onClear=${clearAllHistory} />`, el)
}
```

### 6. Files removed from `public/`

- `public/htmx.min.js` — replaced by CDN
- `public/tailwind.cdn.js` — already a workaround; keep or replace with CDN separately

## What does NOT change

- Server routes (`src/index.tsx`) — unchanged
- Hono JSX view shells (`src/views/*.tsx`) — `onclick` attrs updated to `App.*`, structure unchanged
- IndexedDB schema and operations — unchanged
- Mistral API call — unchanged, stays client-side
- Service worker — unchanged
- PWA manifest — unchanged

### 7. Language separation

Rule: **user-visible = Polish, developer-only = English.**

| Strings | Language | Examples |
|---|---|---|
| JSX templates (`src/views/*.tsx`) | Polish | headings, labels, placeholders, button text |
| Preact components (in `app.js`) | Polish | empty state messages, category display |
| Toasts, `confirm()`, status text, error messages shown in UI | Polish | `toast('Ustawienia zapisane ✓')` |
| `console.error`, internal throw messages not surfaced to UI, code comments | **English** | `console.error('IndexedDB init failed', e)` |

In this app almost all strings are user-visible, so the practical change is small: `console.*` calls and any developer-only error strings use English. Everything the user reads stays Polish.

## Out of scope

- Moving Mistral call to server
- Preact Signals (useState is sufficient)
- Client build step (Vite/esbuild for client code)
- Event delegation replacing `window.App` (can revisit later)
