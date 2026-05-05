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

      <script src="https://cdn.tailwindcss.com" />
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
      <script src="https://unpkg.com/htmx.org@2.0.10/dist/htmx.min.js" />

      <script type="importmap" dangerouslySetInnerHTML={{ __html: JSON.stringify({
        imports: {
          "preact":           "https://esm.sh/preact@10",
          "preact/hooks":     "https://esm.sh/preact@10/hooks",
          "htm/preact":       "https://esm.sh/htm@3.1.1/preact",
          "canvas-confetti":  "https://esm.sh/canvas-confetti@1.6.0",
        }
      })}} />

      <style type="text/tailwindcss" dangerouslySetInnerHTML={{
        __html: `
          .nav-item { @apply flex-1 flex flex-col items-center gap-0.5 py-2.5 px-2 bg-transparent border-none cursor-pointer text-white/35 text-[10px] tracking-wide; }
          .nav-item.active { @apply text-accent; }
          .status-badge { @apply flex items-center gap-2 mb-3 text-[12px]; }
          .status-badge.idle  { @apply text-white/35; }
          .status-badge.ready { @apply text-accent; }
          .status-badge.error { @apply text-red-400; }
          .sdot { @apply w-1.5 h-1.5 rounded-full shrink-0; }
          .status-badge.idle  .sdot { @apply bg-white/25; }
          .status-badge.ready .sdot { @apply bg-accent; }
          .status-badge.error .sdot { @apply bg-red-400; }
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

    <body class="font-sans bg-navy-dark text-white flex flex-col max-w-[480px] mx-auto h-full overflow-hidden">

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
            class="bg-transparent text-white/60 px-3 py-1.5 rounded-full text-[12px] flex items-center gap-1.5 whitespace-nowrap border border-white/10 cursor-pointer active:border-white/20">
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
      <nav id="bottom-nav" class="flex bg-navy shrink-0 border-t border-white/[0.07]" style="padding-bottom:env(safe-area-inset-bottom,0px)">
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
