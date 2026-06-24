import type { FC, PropsWithChildren } from 'hono/jsx'

type LayoutProps = PropsWithChildren<{ turnstileSiteKey: string }>

export const Layout: FC<LayoutProps> = ({ children, turnstileSiteKey }) => (
  <html lang="pl" class="h-full">
    <head>
      <meta charset="UTF-8" />
      <meta
        name="viewport"
        content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no"
      />
      <title>Lazy List</title>
      <link rel="manifest" href="/manifest.json" />
      <link rel="icon" href="/icon.svg" />
      <meta name="theme-color" content="#1a1a2e" />
      <meta name="robots" content="noindex, nofollow, noarchive, nosnippet" />
      <meta name="apple-mobile-web-app-capable" content="yes" />
      <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
      <meta name="apple-mobile-web-app-title" content="Lazy List" />

      <script src="https://cdn.tailwindcss.com" />
      <script
        dangerouslySetInnerHTML={{
          __html: `tailwind.config = {
          theme: { extend: { colors: {
            navy: '#1a1a2e',
            'navy-dark': '#0f0f1a',
            accent: '#a8edea',
            'accent-pink': '#fed6e3',
          }}}
        }`,
        }}
      />
      <script src="https://unpkg.com/htmx.org@2.0.10/dist/htmx.min.js" />
      <script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer />
      <script
        dangerouslySetInnerHTML={{
          __html: `window.__TURNSTILE_SITE_KEY__ = ${JSON.stringify(turnstileSiteKey)};`,
        }}
      />

      <script
        type="importmap"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            imports: {
              preact: 'https://esm.sh/preact@10.29.2',
              'preact/hooks': 'https://esm.sh/preact@10.29.2/hooks',
              '@preact/signals': 'https://esm.sh/@preact/signals@1.3.4',
              htm: 'https://esm.sh/htm@3.1.1',
              'canvas-confetti': 'https://esm.sh/canvas-confetti@1.6.0',
            },
          }),
        }}
      />

      <style
        {...({ type: 'text/tailwindcss' } as Record<string, string>)}
        dangerouslySetInnerHTML={{
          __html: `
          .nav-item { @apply flex-1 flex flex-col items-center gap-0.5 py-2.5 px-2 bg-transparent border-none cursor-pointer text-white/50 text-[10px] tracking-wide md:flex-none md:flex-row md:items-center md:justify-start md:gap-3 md:py-3 md:px-4 md:mx-2 md:rounded-lg md:text-[14px] md:hover:bg-white/5; }
          .nav-item.active { @apply text-accent; }
          .status-badge { @apply flex items-center gap-2 mb-3 text-[12px]; }
          .status-badge.idle  { @apply text-white/50; }
          .status-badge.ready { @apply text-accent; }
          .status-badge.error { @apply text-red-400; }
          .sdot { @apply w-1.5 h-1.5 rounded-full shrink-0; }
          .status-badge.idle  .sdot { @apply bg-white/35; }
          .status-badge.ready .sdot { @apply bg-accent; }
          .status-badge.error .sdot { @apply bg-red-400; }
        `,
        }}
      />
      <style
        dangerouslySetInnerHTML={{
          __html: `
          * { -webkit-tap-highlight-color: transparent; }
          .hidden { display: none !important; }
          .sidebar-logo { display:none; }
          .sidebar-link { display:none; }
          .cat-grid { display:grid; grid-template-rows:1fr; transition:grid-template-rows .3s ease, opacity .25s ease; opacity:1; }
          .cat-grid.collapsed { grid-template-rows:0fr; opacity:0; }
          .cat-grid-inner { overflow:hidden; min-height:0; }
          .cat-chevron { transition:transform .3s ease; }
          .cat-chevron.up { transform:rotate(-90deg); }
          .progress-fill { background:linear-gradient(90deg,#a8edea,#fed6e3); transition:width .4s ease; }
          #toast { opacity:0; bottom:calc(74px + env(safe-area-inset-bottom,0px) + 10px); transform:translateX(-50%) translateY(8px); }
          #toast.show { opacity:1; transform:translateX(-50%) translateY(0); }
          #toast.error { bottom:auto; top:calc(env(safe-area-inset-top,0px) + 16px); background:#dc2626; box-shadow:0 6px 20px rgba(220,38,38,.45); }
          #toast.error { transform:translateX(-50%) translateY(-8px); }
          #toast.error.show { transform:translateX(-50%) translateY(0); }

          /* Desktop: left sidebar + capped, centered content column.
             Mobile keeps the default flex-col / max-w-[480px] shell. */
          @media (min-width: 768px) {
            body.app-shell {
              display: grid;
              grid-template-columns: 200px minmax(0, 1100px);
              grid-template-rows: auto 1fr;
              grid-template-areas: "nav header" "nav main";
              max-width: none;
              justify-content: center;
            }
            body.app-shell > header  { grid-area: header; }
            body.app-shell > #main-content { grid-area: main; }
            body.app-shell > #bottom-nav {
              grid-area: nav;
              flex-direction: column;
              align-items: stretch;
              gap: 4px;
              border-top: none;
              border-right: 1px solid rgba(255,255,255,0.07);
              padding-top: 12px;
              padding-bottom: 0;
            }
            .sidebar-logo { display: flex; }
            .sidebar-link { display: block; }
          }
        `,
        }}
      />
    </head>

    <body class="app-shell font-sans bg-navy-dark text-white flex flex-col max-w-[480px] mx-auto h-full overflow-hidden">
      {/* Boot loader — covers the first paint until the client picks the right view,
          preventing the "Nowa lista" → "Lista" flash when today's list is restored. */}
      <div
        id="boot-loader"
        class="fixed inset-0 bg-navy-dark flex items-center justify-center z-50"
      >
        <div class="text-[44px] opacity-50 animate-pulse">🛒</div>
      </div>

      {/* Loading overlay */}
      <div
        id="loading-overlay"
        class="hidden fixed inset-0 bg-black/75 flex flex-col items-center justify-center z-[70]"
      >
        <div class="w-10 h-10 rounded-full border-[3px] border-white/15 border-t-accent animate-spin" />
        <div id="loading-text" class="text-white/70 mt-4 text-sm">
          Przetwarzam…
        </div>
      </div>

      {/* Toast */}
      <div
        id="toast"
        class="fixed left-1/2 bg-navy text-white px-5 py-3 rounded-full text-[13px] whitespace-nowrap transition-all duration-300 z-40 pointer-events-none"
      />

      {/* Amend list modal */}
      <div
        id="amend-modal-overlay"
        class="hidden fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-4"
        onclick="App.handleAmendOverlayClick(event)"
      >
        <div class="w-full max-w-md bg-navy border border-white/10 rounded-2xl p-5 shadow-2xl">
          <div class="flex items-center justify-between mb-3">
            <h2 class="text-white/90 text-[16px] font-semibold">Dodaj do listy</h2>
            <button
              class="text-white/45 bg-transparent border-none cursor-pointer text-[18px] p-1 active:text-white/80"
              onclick="App.closeAmendModal()"
              aria-label="Zamknij"
            >
              ✕
            </button>
          </div>

          <textarea
            id="amend-input"
            class="w-full h-40 resize-none border border-white/10 rounded-xl p-3 text-[15px] outline-none bg-black/30 text-white/90 placeholder:text-white/30 focus:border-accent/40"
            placeholder={
              'Wklej dodatkowe produkty…\n\nNp:\nMasło\nPapryka czerwona\nMakaron spaghetti'
            }
          />

          <div class="flex gap-2 mt-3">
            <button
              class="flex-1 bg-transparent text-white/60 py-3 rounded-xl text-[14px] font-medium cursor-pointer border border-white/10 active:opacity-70"
              onclick="App.closeAmendModal()"
            >
              Anuluj
            </button>
            <button
              class="flex-1 bg-navy text-accent py-3 rounded-xl text-[14px] font-semibold cursor-pointer border border-accent/20 active:scale-[0.98] active:opacity-85"
              onclick="App.amendCurrentList()"
            >
              ✨ Dodaj
            </button>
          </div>
        </div>
      </div>

      {/* Header */}
      <header
        class="bg-navy shrink-0 px-5 text-white"
        style="padding-top:calc(14px + env(safe-area-inset-top,0px));padding-bottom:14px"
      >
        <div class="flex items-center justify-between">
          <div>
            <div id="header-title" class="text-[19px] font-bold tracking-tight">
              🛒 Lazy List
            </div>
            <div id="header-sub" class="text-[12px] opacity-55 mt-0.5 min-h-[1rem]">
              Nowa lista
            </div>
          </div>
        </div>
      </header>

      {/* HTMX swap target */}
      <main
        id="main-content"
        class="flex-1 overflow-y-auto overflow-x-hidden"
        style="-webkit-overflow-scrolling:touch"
      >
        {children}
      </main>

      {/* Bottom nav */}
      <nav
        id="bottom-nav"
        class="flex bg-navy shrink-0 border-t border-white/[0.07]"
        style="padding-bottom:calc(12px + env(safe-area-inset-bottom,0px))"
      >
        <div class="sidebar-logo flex-col px-4 pb-3 mb-1 border-b border-white/[0.07]">
          <span class="text-[16px] font-bold tracking-tight">🛒 Lazy List</span>
        </div>
        <button
          class="nav-item active"
          data-view="input"
          hx-get="/views/input"
          hx-target="#main-content"
          hx-swap="innerHTML"
          onclick="App.handleNavClick(this)"
        >
          <span class="text-xl">✏️</span>Nowa
        </button>
        <button
          class="nav-item"
          data-view="list"
          hx-get="/views/list"
          hx-target="#main-content"
          hx-swap="innerHTML"
          onclick="App.handleNavClick(this)"
        >
          <span class="text-xl">📋</span>Lista
        </button>
        <button
          class="nav-item"
          data-view="history"
          hx-get="/views/history"
          hx-target="#main-content"
          hx-swap="innerHTML"
          onclick="App.handleNavClick(this)"
        >
          <span class="text-xl">📚</span>Historia
        </button>
        <a
          href="/privacy"
          class="sidebar-link mt-auto mx-4 mb-1 text-[12px] text-white/35 hover:text-white/60"
        >
          Polityka prywatności
        </a>
      </nav>

      <div
        id="turnstile-widget"
        style="position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);z-index:80"
      />
      <script type="module" src="/app.js" />
    </body>
  </html>
)
