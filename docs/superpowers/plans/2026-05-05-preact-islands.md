# Preact Islands + HTMX CDN Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace template-string list/history rendering with Preact islands, switch HTMX to CDN, namespace all onclick handlers under `window.App`.

**Architecture:** `public/app.js` becomes an ES module that imports Preact + HTM + canvas-confetti from esm.sh via an importmap in `layout.tsx`. Two Preact islands (`ShoppingList`, `HistoryList`) mount into `#categories-container` / `#history-container` on `htmx:afterSwap`. All Mistral, IndexedDB, and routing logic remains client-side in `app.js`.

**Tech Stack:** Preact 10, HTM 3.1.1 (htm/preact), canvas-confetti 1.6.0 — all via esm.sh CDN importmap. HTMX 2.0.10 via unpkg CDN. Hono JSX for server-rendered shells. No build step.

---

## File Map

| File | Action | What changes |
|---|---|---|
| `src/layout.tsx` | Modify | HTMX → CDN; add importmap; `app.js` → `type="module"`; `onclick` → `App.*` |
| `src/views/list.tsx` | Modify | Remove progress card + save bar; leave only `<div id="categories-container" />` |
| `src/views/history.tsx` | Modify | Remove heading + clear button; leave only `<div id="history-container" />` |
| `src/components/modal.tsx` | Modify | All `onclick="fn()"` → `onclick="App.fn()"` |
| `src/views/input.tsx` | Modify | `onclick="processWithMistral()"` → `onclick="App.processWithMistral()"` |
| `src/views/setup.tsx` | Modify | All `onclick="fn()"` → `onclick="App.fn()"` |
| `public/app.js` | Rewrite | ES module; `ShoppingList` + `HistoryList` islands; `window.App` namespace |
| `public/htmx.min.js` | Delete | Replaced by CDN |
| `public/sw.js` | Modify | Remove `/htmx.min.js` from `ASSETS` cache list |

---

## Task 1: Update `src/layout.tsx`

Switch HTMX to CDN, add the importmap for Preact/HTM/confetti, change `app.js` to a module, update inline `onclick` attrs.

**Files:**
- Modify: `src/layout.tsx`

- [ ] **Step 1: Replace the three script/onclick lines**

Replace the current script block and the two onclick attrs. The new `<head>` script section (after the Tailwind config block) becomes:

```tsx
      <script src="/tailwind.cdn.js" />
      <script src="https://unpkg.com/htmx.org@2.0.10/dist/htmx.min.js" />

      <script type="importmap" dangerouslySetInnerHTML={{ __html: JSON.stringify({
        imports: {
          "preact":           "https://esm.sh/preact@10",
          "preact/hooks":     "https://esm.sh/preact@10/hooks",
          "htm/preact":       "https://esm.sh/htm@3.1.1?preact",
          "canvas-confetti":  "https://esm.sh/canvas-confetti@1.6.0",
        }
      })}} />
```

Change the API key button onclick (currently line 84):
```tsx
          <button id="api-key-btn" onclick="App.openModal()"
```

Change all three nav button onclicks (currently lines 103, 110, 116):
```tsx
          onclick="App.handleNavClick(this)">
```

Change the `app.js` script tag (currently line 118):
```tsx
      <script type="module" src="/app.js" />
```

The final complete `src/layout.tsx` looks like:

```tsx
import type { FC, PropsWithChildren } from 'hono/jsx'
import { Modal } from './components/modal'

export const Layout: FC<PropsWithChildren> = ({ children }) => (
  <html lang="pl" class="h-full">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
      <title>Zakupy AI</title>
      <link rel="manifest" href="/manifest.json" />
      <link rel="icon" href="/icon.svg" />
      <meta name="theme-color" content="#1a1a2e" />
      <meta name="apple-mobile-web-app-capable" content="yes" />
      <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
      <meta name="apple-mobile-web-app-title" content="Zakupy AI" />

      <script dangerouslySetInnerHTML={{
        __html: `tailwind.config = {
          theme: { extend: { colors: {
            navy: '#1a1a2e',
            'navy-dark': '#0f0f1a',
            accent: '#a8edea',
            'accent-pink': '#fed6e3',
          }}}
        }`
      }} />
      <script src="/tailwind.cdn.js" />
      <script src="https://unpkg.com/htmx.org@2.0.10/dist/htmx.min.js" />

      <script type="importmap" dangerouslySetInnerHTML={{ __html: JSON.stringify({
        imports: {
          "preact":           "https://esm.sh/preact@10",
          "preact/hooks":     "https://esm.sh/preact@10/hooks",
          "htm/preact":       "https://esm.sh/htm@3.1.1?preact",
          "canvas-confetti":  "https://esm.sh/canvas-confetti@1.6.0",
        }
      })}} />

      <style type="text/tailwindcss" dangerouslySetInnerHTML={{
        __html: `
          .nav-item { @apply flex-1 flex flex-col items-center gap-0.5 py-2.5 px-2 bg-transparent border-none cursor-pointer text-white/35 text-[10px] tracking-wide; }
          .nav-item.active { @apply text-accent; }
          .status-badge { @apply flex items-center gap-2 py-2.5 px-3.5 rounded-xl mb-3 text-[13px]; }
          .status-badge.idle  { @apply bg-gray-100 text-gray-600; }
          .status-badge.ready { @apply bg-green-50 text-green-800; }
          .status-badge.error { @apply bg-red-50 text-red-800; }
          .sdot { @apply w-2 h-2 rounded-full shrink-0; }
          .status-badge.idle  .sdot { @apply bg-gray-400; }
          .status-badge.ready .sdot { @apply bg-green-700; }
          .status-badge.error .sdot { @apply bg-red-700; }
        `
      }} />
      <style dangerouslySetInnerHTML={{
        __html: `
          * { -webkit-tap-highlight-color: transparent; }
          .hidden { display: none !important; }
          .cat-grid { display:grid; grid-template-rows:1fr; transition:grid-template-rows .3s ease, opacity .25s ease; opacity:1; }
          .cat-grid.collapsed { grid-template-rows:0fr; opacity:0; }
          .cat-grid-inner { overflow:hidden; min-height:0; }
          .cat-chevron { transition:transform .3s ease; }
          .cat-chevron.up { transform:rotate(-90deg); }
          .progress-fill { background:linear-gradient(90deg,#a8edea,#fed6e3); transition:width .4s ease; }
          #toast { opacity:0; transform:translateX(-50%) translateY(8px); }
          #toast.show { opacity:1; transform:translateX(-50%) translateY(0); }
        `
      }} />
    </head>

    <body class="font-sans bg-navy-dark text-gray-900 flex flex-col max-w-[480px] mx-auto h-full overflow-hidden">

      {/* Loading overlay */}
      <div id="loading-overlay" class="hidden fixed inset-0 bg-black/75 flex flex-col items-center justify-center z-50">
        <div class="w-10 h-10 rounded-full border-[3px] border-white/15 border-t-accent animate-spin" />
        <div id="loading-text" class="text-white/70 mt-4 text-sm">Przetwarzam…</div>
      </div>

      {/* Toast */}
      <div id="toast"
        class="fixed left-1/2 bg-navy text-white px-5 py-3 rounded-full text-[13px] whitespace-nowrap transition-all duration-300 z-40 pointer-events-none"
        style="bottom:calc(74px + env(safe-area-inset-bottom,0px) + 10px)"
      />

      <Modal />

      {/* Header */}
      <header class="bg-navy shrink-0 px-5 text-white"
        style="padding-top:calc(14px + env(safe-area-inset-top,0px));padding-bottom:14px">
        <div class="flex items-center justify-between">
          <div>
            <div id="header-title" class="text-[19px] font-bold tracking-tight">🛒 Zakupy AI</div>
            <div id="header-sub" class="text-[12px] opacity-40 mt-0.5">Nowa lista</div>
          </div>
          <button id="api-key-btn" onclick="App.openModal()"
            class="bg-white/10 text-white px-3 py-1.5 rounded-full text-[12px] flex items-center gap-1.5 whitespace-nowrap active:bg-white/20 border-none cursor-pointer">
            <div id="key-dot" class="w-2 h-2 rounded-full bg-amber-400" />
            <span id="key-btn-label">Klucz API</span>
          </button>
        </div>
      </header>

      {/* HTMX swap target */}
      <main id="main-content" class="flex-1 overflow-y-auto overflow-x-hidden"
        style="-webkit-overflow-scrolling:touch">
        {children}
      </main>

      {/* Bottom nav */}
      <nav id="bottom-nav" class="flex bg-navy border-t border-white/[0.07] shrink-0"
        style="padding-bottom:env(safe-area-inset-bottom,0px)">
        <button class="nav-item active" data-view="input"
          hx-get="/views/input" hx-target="#main-content" hx-swap="innerHTML"
          onclick="App.handleNavClick(this)">
          <span class="text-xl">✏️</span>Nowa
        </button>
        <button class="nav-item" data-view="list"
          hx-get="/views/list" hx-target="#main-content" hx-swap="innerHTML"
          onclick="App.handleNavClick(this)">
          <span class="text-xl">📋</span>Lista
        </button>
        <button class="nav-item" data-view="history"
          hx-get="/views/history" hx-target="#main-content" hx-swap="innerHTML"
          onclick="App.handleNavClick(this)">
          <span class="text-xl">📚</span>Historia
        </button>
      </nav>

      <script type="module" src="/app.js" />
    </body>
  </html>
)
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx wrangler dev`

Expected: worker starts with no TypeScript errors. No need to open browser yet.

- [ ] **Step 3: Stop wrangler dev (Ctrl+C)**

---

## Task 2: Simplify view shells

The progress card, save bar, heading, and clear button all move into the Preact islands. The server-rendered shells become bare mount-point divs.

**Files:**
- Modify: `src/views/list.tsx`
- Modify: `src/views/history.tsx`

- [ ] **Step 1: Replace list.tsx content**

```tsx
import type { FC } from 'hono/jsx'

export const ListView: FC = () => (
  <div class="p-4" style="padding-bottom:calc(80px + env(safe-area-inset-bottom,0px))">
    <div id="categories-container" />
  </div>
)
```

- [ ] **Step 2: Replace history.tsx content**

```tsx
import type { FC } from 'hono/jsx'

export const HistoryView: FC = () => (
  <div class="p-4" style="padding-bottom:calc(80px + env(safe-area-inset-bottom,0px))">
    <div id="history-container" />
  </div>
)
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npx wrangler dev`

Expected: worker starts cleanly.

- [ ] **Step 4: Stop wrangler dev (Ctrl+C)**

---

## Task 3: Update onclick attrs in remaining view files

All bare `fn()` inline onclick handlers become `App.fn()`.

**Files:**
- Modify: `src/components/modal.tsx`
- Modify: `src/views/input.tsx`
- Modify: `src/views/setup.tsx`

- [ ] **Step 1: Update modal.tsx**

Replace the full file content:

```tsx
import type { FC } from 'hono/jsx'

export const Modal: FC = () => (
  <div id="modal-overlay" class="hidden fixed inset-0 bg-black/60 z-[300] flex items-end"
    onclick="App.handleOverlayClick(event)">
    <div class="w-full bg-white rounded-t-3xl max-w-[480px] mx-auto max-h-[92vh] overflow-y-auto"
      style="padding:28px 20px calc(24px + env(safe-area-inset-bottom,0px))">

      <div class="w-9 h-1 bg-gray-200 rounded-full mx-auto mb-6" />
      <div class="text-[18px] font-bold mb-1.5">⚙️ Konfiguracja API</div>
      <div class="text-[13px] text-gray-400 mb-4 leading-relaxed">
        Klucz zapisywany w localStorage — nie trafia nigdzie poza Mistral API.
      </div>

      <div class="bg-yellow-50 border border-yellow-200 rounded-xl py-3 px-3.5 text-[12px] text-yellow-900 mb-4 leading-relaxed">
        🔒 localStorage dostępny tylko przez JS z tej samej domeny. Dla osobistej PWA wystarczające — użyj uprawnień <strong>Inference</strong>.
      </div>

      <div class="text-[12px] text-gray-400 uppercase tracking-wider mb-1.5">Klucz API Mistral</div>
      <div class="relative mb-5">
        <input type="password" id="key-input"
          class="w-full py-3 px-4 border-2 border-gray-200 rounded-xl text-[15px] outline-none text-gray-900 focus:border-indigo-400"
          placeholder="••••••••••••••••••••••••"
          style="padding-right:72px" />
        <button class="absolute right-2.5 top-1/2 -translate-y-1/2 bg-transparent border-none text-gray-400 text-[12px] cursor-pointer px-2 py-1"
          onclick="App.toggleReveal('key-input',this)">Pokaż</button>
      </div>

      <button class="block w-full bg-navy text-white py-4 rounded-[14px] text-[15px] font-semibold cursor-pointer mt-3 border-none active:opacity-85"
        onclick="App.saveSettings()">💾 Zapisz ustawienia</button>
      <button class="block w-full bg-transparent text-red-500 text-[13px] cursor-pointer mt-2 border-none py-2.5"
        onclick="App.clearApiKey()">🗑 Usuń klucz API</button>
    </div>
  </div>
)
```

- [ ] **Step 2: Update input.tsx**

Replace the full file content:

```tsx
import type { FC } from 'hono/jsx'

export const InputView: FC = () => (
  <div class="p-4" style="padding-bottom:calc(80px + env(safe-area-inset-bottom,0px))">
    <div id="status-badge" class="status-badge idle">
      <div class="sdot" />
      <span id="status-text">Gotowy — wpisz listę zakupów</span>
    </div>

    <textarea id="shopping-input"
      class="w-full h-[190px] resize-none border-2 border-gray-200 rounded-2xl p-3.5 text-[15px] outline-none bg-white text-gray-900 focus:border-indigo-400"
      placeholder={'Wklej lub wpisz listę zakupów…\n\nNp:\nMleko\nJogurt grecki\nChleb\nFilet z kurczaka\nPomidory 600g'}
    />

    <button id="process-btn"
      class="block w-full bg-navy text-white py-4 rounded-[14px] text-[15px] font-semibold cursor-pointer mt-3 border-none active:scale-[0.98] active:opacity-85"
      onclick="App.processWithMistral()">
      ✨ Zrób listę z AI
    </button>
  </div>
)
```

- [ ] **Step 3: Update setup.tsx**

Replace the full file content:

```tsx
import type { FC } from 'hono/jsx'

export const SetupView: FC = () => (
  <div class="flex flex-col items-center justify-center min-h-[80vh] p-6 text-center">
    <div class="text-[60px] mb-5">🔑</div>
    <div class="text-[22px] font-bold text-white mb-2">Potrzebny klucz API</div>
    <div class="text-[14px] text-white/45 leading-7 mb-7">
      Podaj klucz Mistral API — AI skategoryzuje Twoje listy zakupów lokalnie, bez serwera pośredniego.
    </div>

    <div class="bg-white rounded-[20px] p-6 w-full text-left">
      <div class="text-[12px] text-gray-400 uppercase tracking-wider mb-1.5">Klucz API Mistral</div>
      <div class="relative mb-4">
        <input type="password" id="setup-key-input"
          class="w-full py-3 px-4 border-2 border-gray-200 rounded-xl text-[15px] outline-none text-gray-900 focus:border-indigo-400"
          placeholder="••••••••••••••••••••••••"
          style="padding-right:72px" />
        <button class="absolute right-2.5 top-1/2 -translate-y-1/2 bg-transparent border-none text-gray-400 text-[12px] cursor-pointer px-2 py-1"
          onclick="App.toggleReveal('setup-key-input',this)">Pokaż</button>
      </div>
      <div class="bg-yellow-50 border border-yellow-200 rounded-xl py-3 px-3.5 text-[12px] text-yellow-900 leading-relaxed">
        Klucz wygenerujesz na <strong>console.mistral.ai</strong> → API Keys.<br />
        Użyj tylko uprawnień <em>Inference</em>.
      </div>
      <button class="block w-full bg-navy text-white py-4 rounded-[14px] text-[15px] font-semibold cursor-pointer mt-3 border-none active:scale-[0.98]"
        onclick="App.saveFromSetup()">Zapisz i zacznij →</button>
    </div>
  </div>
)
```

- [ ] **Step 4: Verify TypeScript compiles**

Run: `npx wrangler dev`

Expected: worker starts cleanly.

- [ ] **Step 5: Stop wrangler dev (Ctrl+C)**

---

## Task 4: Rewrite `public/app.js` as ES module

This is the core task. The file becomes an ES module with Preact islands. Removed: `renderList()`, `renderHistory()`, `toggleItem()`, `toggleCat()` (now inside `ShoppingList`), `escHtml()` (Preact escapes automatically). Added: `ShoppingList`, `HistoryList`, `mountListIsland()`, `mountHistoryIsland()`, `window.App`.

**Files:**
- Modify: `public/app.js`

- [ ] **Step 1: Replace the entire file with the ES module**

```js
import { render } from 'preact'
import { useState, useEffect, useRef } from 'preact/hooks'
import { html } from 'htm/preact'
import confetti from 'canvas-confetti'

// CONFIG
const LS_KEY = 'zakupy_api_key'
const MODEL  = 'mistral-small-latest'

const getKey = () => localStorage.getItem(LS_KEY) || ''

// ── IndexedDB ──────────────────────────────────────────────────────────────────
const DB = (() => {
  let db
  const open = () => new Promise((res, rej) => {
    const r = indexedDB.open('ZakupyAI', 1)
    r.onupgradeneeded = e => e.target.result.createObjectStore('lists', { keyPath: 'id' })
    r.onsuccess = e => { db = e.target.result; res() }
    r.onerror   = () => rej(r.error)
  })
  const tx   = m => db.transaction('lists', m).objectStore('lists')
  const wrap = r => new Promise((res, rej) => {
    r.onsuccess = () => res(r.result)
    r.onerror   = () => rej(r.error)
  })
  return {
    init:   open,
    save:   l  => wrap(tx('readwrite').put(l)),
    getAll: () => wrap(tx('readonly').getAll()).then(a => a.sort((a, b) => b.date - a.date)),
    del:    id => wrap(tx('readwrite').delete(id)),
    clear:  () => wrap(tx('readwrite').clear()),
  }
})()

// ── State ─────────────────────────────────────────────────────────────────────
let currentList = null
let currentView = 'input'

// ── Modal ─────────────────────────────────────────────────────────────────────
function openModal() {
  document.getElementById('key-input').value = getKey()
  document.getElementById('modal-overlay').classList.remove('hidden')
}
function closeModal() {
  document.getElementById('modal-overlay').classList.add('hidden')
}
function handleOverlayClick(e) {
  if (e.target.id === 'modal-overlay') closeModal()
}
function toggleReveal(inputId, btn) {
  const inp = document.getElementById(inputId)
  inp.type = inp.type === 'password' ? 'text' : 'password'
  btn.textContent = inp.type === 'password' ? 'Pokaż' : 'Ukryj'
}
function saveSettings() {
  const key = document.getElementById('key-input').value.trim()
  if (!key) { toast('Wpisz klucz API'); return }
  localStorage.setItem(LS_KEY, key)
  updateKeyIndicator()
  closeModal()
  toast('Ustawienia zapisane ✓')
  showMainApp()
}
function saveFromSetup() {
  const key = document.getElementById('setup-key-input').value.trim()
  if (!key) { toast('Wpisz klucz API'); return }
  localStorage.setItem(LS_KEY, key)
  updateKeyIndicator()
  showMainApp()
  toast('Klucz zapisany ✓')
}
function clearApiKey() {
  if (!confirm('Usunąć zapisany klucz API?')) return
  localStorage.removeItem(LS_KEY)
  updateKeyIndicator()
  closeModal()
  checkKeyAndRoute()
  toast('Klucz usunięty')
}
function updateKeyIndicator() {
  const has = !!getKey()
  const dot = document.getElementById('key-dot')
  if (dot) dot.className = `w-2 h-2 rounded-full ${has ? 'bg-[#10b981]' : 'bg-amber-400'}`
  const label = document.getElementById('key-btn-label')
  if (label) label.textContent = has ? 'Mistral' : 'Klucz API'
}

// ── Routing ───────────────────────────────────────────────────────────────────
function checkKeyAndRoute() {
  if (getKey()) {
    showMainApp()
  } else {
    document.getElementById('bottom-nav').style.display = 'none'
    currentView = 'setup'
    htmx.ajax('GET', '/views/setup', { target: '#main-content', swap: 'innerHTML' })
  }
}
function showMainApp() {
  document.getElementById('bottom-nav').style.display = ''
  if (currentView !== 'input') {
    navigateTo('input')
  } else {
    const btn = document.querySelector('[data-view="input"]')
    if (btn) setActiveNav(btn)
    updateHeader('input')
  }
}

// ── Navigation ────────────────────────────────────────────────────────────────
const META = {
  input:   { title: '🛒 Zakupy AI', sub: 'Nowa lista' },
  list:    { title: '📋 Lista',     sub: '' },
  history: { title: '📚 Historia',  sub: 'Poprzednie listy' },
}

function navigateTo(name) {
  currentView = name
  const btn = document.querySelector(`[data-view="${name}"]`)
  setActiveNav(btn)
  updateHeader(name)
  htmx.ajax('GET', `/views/${name}`, { target: '#main-content', swap: 'innerHTML' })
}

function handleNavClick(el) {
  const name = el.dataset.view
  currentView = name
  setActiveNav(el)
  updateHeader(name)
}

function setActiveNav(el) {
  document.querySelectorAll('[data-view]').forEach(b => b.classList.remove('active'))
  if (el) el.classList.add('active')
}

function updateHeader(name) {
  const m = META[name]
  if (!m) return
  const titleEl = document.getElementById('header-title')
  const subEl   = document.getElementById('header-sub')
  if (titleEl) titleEl.textContent = m.title
  if (subEl)   subEl.textContent   = (name === 'list' && currentList) ? currentList.title : m.sub
}

// ── Mistral API ───────────────────────────────────────────────────────────────
const SYSTEM = `Jesteś asystentem do kategoryzowania list zakupów po polsku.
Dostajesz surową listę produktów (po jednym na linię, mogą być notatki w nawiasach).
Przypisz każdy produkt do odpowiedniej kategorii. Zachowaj ORYGINALNE nazwy produktów razem z uwagami w nawiasach.

Dostępne kategorie (użyj tylko tych, które mają produkty):
- nabiał 🥛 : mleko, jogurty, sery, twarogi, jajka, śmietana, masło, skyr, serek, actimel
- mięso i wędliny 🥩 : mięso surowe, kurczak, wędlina, parówki, kiełbasa, szynka
- warzywa 🥦 : wszystkie warzywa świeże, włoszczyzna, cukinia, papryka
- owoce 🍎 : wszystkie owoce świeże
- pieczywo 🍞 : chleb, bułki, bagietki, tortille
- napoje 🥤 : soki, woda, napoje gazowane
- suche produkty 🌾 : płatki, ryż, makaron, kasza, mąka, orzechy
- przyprawy i sosy 🧂 : oleje, oliwy, sosy, octy, musztarda
- gotowe dania 🍱 : gotowe sałatki, dania gotowe, mrożonki
- chemia i higiena 🧴 : środki czystości, kosmetyki, artykuły higieny
- inne 🛒 : wszystko co nie pasuje do powyższych

Zwróć WYŁĄCZNIE poprawny JSON bez żadnego markdown ani komentarzy:
{"categories":[{"name":"nabiał","emoji":"🥛","items":["Jogurt grecki","Skyr"]}]}`

async function processWithMistral() {
  const raw = document.getElementById('shopping-input').value.trim()
  if (!raw)     { toast('Wpisz listę zakupów 📝'); return }
  if (!getKey()) { openModal(); return }

  setStatus('idle', 'Wysyłam do Mistral…')
  showLoading('Mistral AI kategoryzuje listę…')

  try {
    const res = await fetch('https://api.mistral.ai/v1/chat/completions', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getKey()}` },
      body: JSON.stringify({
        model: MODEL, max_tokens: 1000, temperature: 0.1,
        messages: [
          { role: 'system', content: SYSTEM },
          { role: 'user',   content: `Skategoryzuj tę listę zakupów:\n${raw}` },
        ],
      }),
    })

    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      if (res.status === 401) throw new Error('Nieprawidłowy klucz API. Sprawdź ustawienia.')
      if (res.status === 429) throw new Error('Limit zapytań przekroczony. Spróbuj za chwilę.')
      throw new Error(err?.message || `Błąd API (${res.status})`)
    }

    const data    = await res.json()
    const content = data.choices?.[0]?.message?.content || ''
    const clean   = content.replace(/^```(?:json)?\n?/m, '').replace(/\n?```$/m, '').trim()

    let parsed
    try { parsed = JSON.parse(clean) }
    catch { throw new Error('AI zwróciło niepoprawny JSON. Spróbuj ponownie.') }
    if (!Array.isArray(parsed?.categories)) throw new Error('Brak kategorii w odpowiedzi AI.')

    currentList = {
      id: Date.now(), title: 'Zakupy ' + fmtDate(Date.now()),
      date: Date.now(), saved: false, model: MODEL,
      categories: parsed.categories
        .filter(c => c.items?.length)
        .map(c => ({
          name: c.name || 'inne', emoji: c.emoji || '📦',
          collapsed: false, manualExpand: false,
          items: c.items.map(n => ({ name: n, checked: false })),
        })),
    }

    hideLoading()
    setStatus('ready', 'Gotowe — Mistral Small')
    navigateTo('list')
  } catch (e) {
    hideLoading()
    setStatus('error', e.message)
    toast(e.message, 4000)
  }
}

// ── List actions ──────────────────────────────────────────────────────────────
async function saveCurrentList() {
  currentList.saved = true
  await DB.save(currentList)
  toast('Lista zapisana 💾')
}

function discardCurrentList() {
  if (!confirm('Odrzucić bieżącą listę?')) return
  currentList = null
  navigateTo('input')
}

// ── History actions ───────────────────────────────────────────────────────────
async function loadHistory(id) {
  const lists = await DB.getAll()
  const l = lists.find(l => l.id === id)
  if (!l) return
  l.categories.forEach(c => { c.collapsed ??= false; c.manualExpand ??= false })
  currentList = l
  navigateTo('list')
}

async function delHistory(id) {
  if (!confirm('Usunąć tę listę?')) return
  await DB.del(id)
  if (currentList?.id === id) currentList = null
  await mountHistoryIsland()
  toast('Lista usunięta')
}

async function clearAllHistory() {
  if (!confirm('Usunąć WSZYSTKIE zapisane listy?')) return
  await DB.clear()
  if (currentList?.saved) currentList = null
  await mountHistoryIsland()
  toast('Historia wyczyszczona 🗑')
}

// ── ShoppingList island ───────────────────────────────────────────────────────
function ShoppingList({ list, onSave, onDiscard }) {
  const [cats, setCats] = useState(list ? list.categories : [])
  const [isSaved, setIsSaved] = useState(list ? list.saved : false)
  const collapseRef = useRef(null)

  const allItems = cats.flatMap(c => c.items)
  const done = allItems.filter(i => i.checked).length
  const allDone = allItems.length > 0 && allItems.every(i => i.checked)

  useEffect(() => {
    if (allDone) confetti({ particleCount: 120, spread: 70, origin: { y: 0.6 } })
  }, [allDone])

  if (!list) return html`
    <div class="text-center py-16 px-6 text-white/30">
      <div class="text-[48px] mb-3">📝</div>
      <p class="text-[14px] leading-7">Brak aktywnej listy.<br>Stwórz nową w zakładce "Nowa".</p>
    </div>`

  function toggleItem(ci, ii) {
    let willCollapse = false
    const next = cats.map((c, catIdx) => {
      if (catIdx !== ci) return c
      const newItems = c.items.map((item, itemIdx) =>
        itemIdx !== ii ? item : { ...item, checked: !item.checked }
      )
      const nowChecked = newItems[ii].checked
      if (!nowChecked) return { ...c, items: newItems, collapsed: false, manualExpand: false }
      if (newItems.every(i => i.checked) && !c.manualExpand) willCollapse = true
      return { ...c, items: newItems }
    })
    setCats(next)
    if (willCollapse) {
      clearTimeout(collapseRef.current)
      collapseRef.current = setTimeout(() => {
        setCats(p => p.map((c, i) => i === ci ? { ...c, collapsed: true } : c))
      }, 450)
    }
    if (isSaved) {
      currentList.categories = next
      DB.save(currentList).catch(e => console.error('Auto-save failed', e))
    }
  }

  function toggleCat(ci) {
    setCats(p => p.map((c, i) =>
      i !== ci ? c : { ...c, collapsed: !c.collapsed, manualExpand: c.collapsed }
    ))
  }

  async function handleSave() {
    currentList.categories = cats
    await onSave()
    setIsSaved(true)
  }

  return html`
    <div>
      <div class="bg-navy text-white rounded-[18px] p-5 mb-4">
        <div class="text-[17px] font-bold mb-3 truncate">${list.title}</div>
        <div class="h-[5px] bg-white/15 rounded-full overflow-hidden">
          <div class="progress-fill h-full rounded-full"
            style=${{ width: allItems.length ? `${done / allItems.length * 100}%` : '0%' }} />
        </div>
        <div class="text-[12px] opacity-50 mt-2">${done} / ${allItems.length}</div>
      </div>

      ${!isSaved && html`
        <div class="flex gap-2 mb-4">
          <button class="flex-1 bg-navy text-white py-4 rounded-[14px] text-[15px] font-semibold cursor-pointer border-none active:scale-[0.98] active:opacity-85"
            onClick=${handleSave}>💾 Zapisz listę</button>
          <button class="bg-gray-100 text-gray-600 py-4 px-5 rounded-[14px] text-[15px] font-semibold cursor-pointer border-none active:scale-[0.98]"
            onClick=${onDiscard}>✕</button>
        </div>
      `}

      ${cats.map((cat, ci) => {
        const catDone = cat.items.filter(i => i.checked).length
        const catAllDone = catDone === cat.items.length && cat.items.length > 0
        return html`
          <div class="mb-3" key=${cat.name + ci}>
            <div class="flex items-center justify-between py-2 px-1 cursor-pointer select-none"
              onClick=${() => toggleCat(ci)}>
              <div class="flex items-center gap-2 text-[11px] tracking-widest uppercase text-white/45">
                <span>${cat.emoji}</span>
                <span>${cat.name}</span>
                <span class="opacity-60">(${catDone}/${cat.items.length})</span>
                ${catAllDone && html`<span class="bg-accent/20 text-accent text-[10px] px-2 py-0.5 rounded-full">✓ gotowe</span>`}
              </div>
              <span class="cat-chevron text-white/30 text-[11px] ${cat.collapsed ? 'up' : ''}">▼</span>
            </div>
            <div class="cat-grid ${cat.collapsed ? 'collapsed' : ''}">
              <div class="cat-grid-inner">
                <div class="bg-white rounded-2xl overflow-hidden shadow-sm">
                  ${cat.items.map((item, ii) => html`
                    <div class="flex items-center px-4 py-[13px] border-b border-gray-100 last:border-0 cursor-pointer active:bg-gray-50 ${item.checked ? 'opacity-60' : ''}"
                      onClick=${() => toggleItem(ci, ii)} key=${ii}>
                      <div class="w-6 h-6 rounded-[7px] border-2 shrink-0 mr-3 flex items-center justify-center transition-all ${item.checked ? 'bg-navy border-navy' : 'border-gray-300'}">
                        ${item.checked && html`<svg width="13" height="10" viewBox="0 0 13 10" fill="none">
                          <path d="M1 5L5 9L12 1" stroke="white" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
                        </svg>`}
                      </div>
                      <span class="text-[15px] ${item.checked ? 'text-gray-300 line-through' : ''}">${item.name}</span>
                    </div>
                  `)}
                </div>
              </div>
            </div>
          </div>`
      })}
    </div>`
}

// ── HistoryList island ────────────────────────────────────────────────────────
function HistoryList({ lists, onLoad, onDelete, onClear }) {
  const header = html`
    <div class="flex justify-between items-center mb-4">
      <h2 class="text-white text-lg font-bold">Historia list</h2>
      <button class="bg-red-50 text-red-700 py-2 px-3.5 rounded-xl text-[13px] font-semibold cursor-pointer border-none"
        onClick=${onClear}>🗑 Wyczyść</button>
    </div>`

  if (!lists.length) return html`
    <div>
      ${header}
      <div class="text-center py-16 px-6 text-white/30">
        <div class="text-[48px] mb-3">📭</div>
        <p class="text-[14px] leading-7">Brak zapisanych list.<br>Stwórz pierwszą w zakładce "Nowa".</p>
      </div>
    </div>`

  return html`
    <div>
      ${header}
      ${lists.map(l => {
        const items = l.categories.flatMap(c => c.items)
        const done  = items.filter(i => i.checked).length
        return html`
          <div class="bg-white rounded-2xl p-4 mb-2.5 shadow-sm cursor-pointer relative active:scale-[0.99] transition-transform"
            onClick=${() => onLoad(l.id)} key=${l.id}>
            <button class="absolute top-3 right-3 bg-transparent border-none text-gray-300 text-[17px] cursor-pointer p-1 hover:text-red-500 transition-colors"
              onClick=${e => { e.stopPropagation(); onDelete(l.id) }}>🗑</button>
            <div class="text-[11px] text-gray-400 mb-0.5">${fmtDateFull(l.date)}</div>
            <div class="text-[15px] font-bold mb-2.5">${l.title}</div>
            <div class="flex flex-wrap gap-1.5">
              <span class="text-[11px] px-2.5 py-1 bg-gray-100 rounded-full text-gray-500">📦 ${items.length} produktów</span>
              <span class="text-[11px] px-2.5 py-1 bg-gray-100 rounded-full text-gray-500">✓ ${done} kupionych</span>
              ${l.categories.map(c => html`
                <span class="text-[11px] px-2.5 py-1 bg-gray-100 rounded-full text-gray-500">${c.emoji} ${c.name}</span>
              `)}
            </div>
          </div>`
      })}
    </div>`
}

// ── Island mount lifecycle ────────────────────────────────────────────────────
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
  render(
    html`<${HistoryList} lists=${lists} onLoad=${loadHistory} onDelete=${delHistory} onClear=${clearAllHistory} />`,
    el
  )
}

document.addEventListener('htmx:afterSwap', async (e) => {
  if (e.detail.target.id !== 'main-content') return
  if (currentView === 'list')    mountListIsland()
  if (currentView === 'history') await mountHistoryIsland()
})

// ── Utils ─────────────────────────────────────────────────────────────────────
function setStatus(type, text) {
  const badge = document.getElementById('status-badge')
  if (!badge) return
  badge.className = `status-badge ${type}`
  const textEl = document.getElementById('status-text')
  if (textEl) textEl.textContent = text
}
function showLoading(t) {
  const el = document.getElementById('loading-overlay')
  if (!el) return
  el.classList.remove('hidden')
  document.getElementById('loading-text').textContent = t || 'Ładuję…'
}
function hideLoading() {
  document.getElementById('loading-overlay')?.classList.add('hidden')
}

let _toastTimer
function toast(msg, dur = 2500) {
  const el = document.getElementById('toast')
  el.textContent = msg
  el.classList.add('show')
  clearTimeout(_toastTimer)
  _toastTimer = setTimeout(() => el.classList.remove('show'), dur)
}
function fmtDate(ts) {
  return new Date(ts).toLocaleDateString('pl-PL', { day: 'numeric', month: 'short' })
}
function fmtDateFull(ts) {
  return new Date(ts).toLocaleString('pl-PL', {
    day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

// ── window.App namespace ──────────────────────────────────────────────────────
window.App = {
  openModal, closeModal, handleOverlayClick, toggleReveal,
  saveSettings, saveFromSetup, clearApiKey,
  processWithMistral, handleNavClick,
  saveCurrentList, discardCurrentList, clearAllHistory,
}

// ── Boot ──────────────────────────────────────────────────────────────────────
if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {})

DB.init().then(() => { updateKeyIndicator(); checkKeyAndRoute() })
```

- [ ] **Step 2: Verify the app boots and renders the input view**

Run: `npx wrangler dev`

Open browser at `http://localhost:8787`. Expected:
- Page loads without console errors
- Input view visible with textarea and "✨ Zrób listę z AI" button
- API key button in header is visible
- Bottom nav shows three tabs with first tab active

- [ ] **Step 3: Verify list island mounts**

In the browser:
1. Navigate to the Lista tab
2. Expected: empty state — "📝 Brak aktywnej listy" message inside `#categories-container`
3. No JS errors in console

- [ ] **Step 4: Verify history island mounts**

In the browser:
1. Navigate to the Historia tab
2. Expected: "Historia list" heading + empty state — "📭 Brak zapisanych list"
3. No JS errors in console

- [ ] **Step 5: Stop wrangler dev (Ctrl+C)**

---

## Task 5: Delete `public/htmx.min.js` and update `public/sw.js`

`htmx.min.js` is now served from CDN. Remove the local file and remove it from the service worker cache list so the PWA doesn't try to precache a file that no longer exists.

**Files:**
- Delete: `public/htmx.min.js`
- Modify: `public/sw.js`

- [ ] **Step 1: Delete the local HTMX file**

```bash
rm public/htmx.min.js
```

- [ ] **Step 2: Update sw.js to remove htmx.min.js from ASSETS**

Replace the full `public/sw.js`:

```js
const CACHE = 'zakupy-ai-v2';
const ASSETS = ['/', '/manifest.json', '/icon.svg', '/app.js'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => clients.claim())
  );
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(res => {
        if (res.ok) {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return res;
      }).catch(() => caches.match('/'));
    })
  );
});
```

- [ ] **Step 3: Full smoke test — run wrangler dev and verify all flows**

Run: `npx wrangler dev`

Open browser at `http://localhost:8787`. Test the following flows:

**Setup flow (no API key saved):**
- Clear localStorage before testing: open DevTools → Application → Local Storage → clear all
- Reload page
- Expected: setup screen appears, bottom nav hidden
- Type a key in the input, click "Zapisz i zacznij →"
- Expected: navigates to input view, bottom nav visible, key dot turns green

**API key modal:**
- Click the key button in the header
- Expected: modal slides up
- Click outside the modal
- Expected: modal closes

**List island with items (requires Mistral API key):**
- If you have a real key: type a shopping list, click "✨ Zrób listę z AI"
- Expected: loading overlay shows → list view loads → ShoppingList island renders with categories
- Check a few items — progress bar updates
- Check all items in a category — category auto-collapses after 450ms, "✓ gotowe" badge appears
- Check all items in all categories — confetti fires

**Save flow:**
- While on list view with unsaved list: click "💾 Zapisz listę"
- Expected: save/discard bar disappears, toast "Lista zapisana 💾"
- Navigate to Historia tab
- Expected: HistoryList island shows the saved list card

**History flow:**
- On Historia: click a list card
- Expected: navigates to Lista, loads that list
- Return to Historia: click the trash icon on a card
- Expected: confirm dialog → card removed, toast "Lista usunięta"
- Click "🗑 Wyczyść"
- Expected: confirm dialog → all cards removed, empty state shown

- [ ] **Step 4: Stop wrangler dev (Ctrl+C)**
