import type { FC, PropsWithChildren } from 'hono/jsx'
import { Icon } from './icon'
import { FONT_SIZE_ANTIFLASH, FONT_SIZE_CSS, THEME_ANTIFLASH, THEME_CONFIG } from './theme'

type LayoutProps = PropsWithChildren<{ turnstileSiteKey: string; posthogKey?: string }>

export const Layout: FC<LayoutProps> = ({ children, turnstileSiteKey, posthogKey }) => (
  <html lang="pl" class="lazy-theme h-full" data-lazy-theme="dark">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>Lazy List</title>
      <link rel="manifest" href="/manifest.json" />
      <link rel="icon" href="/icon.svg" />
      <meta name="theme-color" content="#222722" />
      <meta name="robots" content="noindex, nofollow, noarchive, nosnippet" />
      <meta name="apple-mobile-web-app-capable" content="yes" />
      <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
      <meta name="apple-mobile-web-app-title" content="Lazy List" />

      <link rel="stylesheet" href="/vendor/lazy-theme/theme.css" />
      <script dangerouslySetInnerHTML={{ __html: THEME_ANTIFLASH }} />
      <script dangerouslySetInnerHTML={{ __html: FONT_SIZE_ANTIFLASH }} />

      <script src="https://cdn.tailwindcss.com" />
      <script dangerouslySetInnerHTML={{ __html: THEME_CONFIG }} />
      <script src="https://unpkg.com/htmx.org@2.0.10/dist/htmx.min.js" />
      <script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer />
      <script
        dangerouslySetInnerHTML={{
          __html: `window.__TURNSTILE_SITE_KEY__ = ${JSON.stringify(turnstileSiteKey)};`,
        }}
      />

      {/* Firefox requires the import map before the first module script. */}
      <script
        type="importmap"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            // Served from public/vendor, built by `pnpm vendor` (esbuild) out of
            // node_modules — see scripts/vendor-entries/. Versions come from
            // pnpm-lock.yaml, so nothing resolves over the network at runtime.
            //
            // Transitive deps (@preact/signals-core) are bundled into their
            // importer and deliberately absent here — nothing requests them by
            // bare name. esbuild's --splitting hoists preact into one shared
            // chunk, so signals cannot end up on a second preact instance
            // patching an `options` object the app never renders through.
            imports: {
              preact: '/vendor/preact.js',
              'preact/hooks': '/vendor/hooks.js',
              '@preact/signals': '/vendor/signals.js',
              htm: '/vendor/htm.js',
              'canvas-confetti': '/vendor/confetti.js',
            },
          }),
        }}
      />

      {posthogKey ? (
        <>
          <script
            dangerouslySetInnerHTML={{
              __html: `window.__POSTHOG_KEY__ = ${JSON.stringify(posthogKey)};`,
            }}
          />
          <script type="module" src="/analytics.js" />
        </>
      ) : null}

      <link rel="stylesheet" href="/app.css" />
      <style dangerouslySetInnerHTML={{ __html: FONT_SIZE_CSS }} />
    </head>

    <body class="app-shell font-sans bg-bg text-fg">
      {/* Boot loader — covers the first paint until the client picks the right view,
          preventing the "Nowa lista" → "Lista" flash when today's list is restored. */}
      <div id="boot-loader" class="fixed inset-0 bg-bg flex items-center justify-center z-50">
        <Icon name="bag" class="boot-icon" />
      </div>

      {/* Loading overlay */}
      <div
        id="loading-overlay"
        class="hidden fixed inset-0 bg-black/75 flex flex-col items-center justify-center z-[70]"
      >
        <div class="w-10 h-10 rounded-full border-[3px] border-fg/15 border-t-accent animate-spin" />
        <div id="loading-text" class="text-fg/70 mt-4 text-sm">
          Przetwarzam…
        </div>
      </div>

      {/* Toast */}
      <div
        id="toast"
        role="status"
        class="fixed left-1/2 bg-surface text-fg px-5 py-3 rounded-full text-[13px] whitespace-nowrap transition-all duration-300 z-40 pointer-events-none"
      />

      {/* Amend list modal */}
      <div
        id="amend-modal-overlay"
        class="hidden fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-4 overflow-y-auto"
        onclick="App.handleAmendOverlayClick(event)"
      >
        <div class="w-full max-w-md bg-surface border border-fg/10 rounded-2xl p-5 shadow-2xl max-h-full overflow-y-auto">
          <div class="flex items-center justify-between mb-3">
            <h2 class="text-fg/90 text-[16px] font-semibold">Dodaj do listy</h2>
            <button
              class="lazy-button lazy-button--icon"
              onclick="App.closeAmendModal()"
              aria-label="Zamknij"
            >
              <Icon name="close" />
            </button>
          </div>

          <textarea
            id="amend-input"
            aria-label="Dodatkowe produkty"
            class="lazy-field h-40"
            placeholder={
              'Wklej dodatkowe produkty…\n\nNp:\nMasło\nPapryka czerwona\nMakaron spaghetti'
            }
          />

          <div class="flex gap-2 mt-3">
            <button class="lazy-button flex-1" onclick="App.closeAmendModal()">
              Anuluj
            </button>
            <button
              class="lazy-button lazy-button--primary flex-1 py-3 active:opacity-85"
              onclick="App.amendCurrentList()"
            >
              Dodaj
            </button>
          </div>
        </div>
      </div>

      {/* Rename list modal */}
      <div
        id="rename-modal-overlay"
        class="hidden fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-4"
        onclick="App.handleRenameOverlayClick(event)"
      >
        <div class="w-full max-w-md bg-surface border border-fg/10 rounded-2xl p-5 shadow-2xl">
          <div class="flex items-center justify-between mb-3">
            <h2 class="text-fg/90 text-[16px] font-semibold">Zmień nazwę listy</h2>
            <button
              class="lazy-button lazy-button--icon"
              onclick="App.closeRenameModal()"
              aria-label="Zamknij"
            >
              <Icon name="close" />
            </button>
          </div>

          <input
            id="rename-input"
            aria-label="Nazwa listy"
            class="lazy-field"
            maxlength={60}
            autocomplete="off"
          />
          <div id="rename-suggestion" class="min-h-[1.25rem] mt-2 text-[12px] text-muted" />

          <div class="flex gap-2 mt-3">
            <button class="lazy-button flex-1" onclick="App.closeRenameModal()">
              Anuluj
            </button>
            <button
              class="lazy-button lazy-button--primary flex-1 py-3 active:opacity-85"
              onclick="App.renameCurrentList()"
            >
              Zapisz
            </button>
          </div>
        </div>
      </div>

      {/* Header */}
      <header class="workspace-header">
        <div class="flex items-center justify-between">
          <div>
            <h1 id="header-title" class="lazy-wordmark">
              lazy-list<span aria-hidden="true">.</span>
            </h1>
            <div id="header-sub" class="header-description">
              Nowa lista
            </div>
          </div>
          <div class="flex items-center gap-1 -mr-1">
            <button
              id="font-size-toggle"
              type="button"
              class="lazy-button lazy-button--icon"
              aria-label="Przełącz rozmiar tekstu"
              onclick="App.toggleFontSize()"
            >
              A⁺
            </button>
            <button
              id="theme-toggle"
              type="button"
              class="lazy-button lazy-button--icon"
              aria-label="Przełącz motyw"
              onclick="App.toggleTheme()"
            >
              <Icon name="moon" />
            </button>
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
      <nav id="bottom-nav" class="workspace-nav" aria-label="Główna nawigacja">
        <div class="sidebar-logo">
          <span class="lazy-wordmark">
            lazy-list<span aria-hidden="true">.</span>
          </span>
        </div>
        <button
          class="lazy-button nav-item active"
          data-view="input"
          aria-label="Nowa"
          title="Nowa"
          hx-get="/views/input"
          hx-target="#main-content"
          hx-swap="innerHTML"
          onclick="App.handleNavClick(this)"
        >
          <Icon name="edit" />
          <span class="nav-label">Nowa</span>
        </button>
        <button
          class="lazy-button nav-item"
          data-view="list"
          aria-label="Lista"
          title="Lista"
          hx-get="/views/list"
          hx-target="#main-content"
          hx-swap="innerHTML"
          onclick="App.handleNavClick(this)"
        >
          <Icon name="list" />
          <span class="nav-label">Lista</span>
        </button>
        <button
          class="lazy-button nav-item"
          data-view="history"
          aria-label="Historia"
          title="Historia"
          hx-get="/views/history"
          hx-target="#main-content"
          hx-swap="innerHTML"
          onclick="App.handleNavClick(this)"
        >
          <Icon name="history" />
          <span class="nav-label">Historia</span>
        </button>
        <a href="/privacy" class="sidebar-link lazy-note mt-auto mx-4 mb-1">
          Polityka prywatności
        </a>
      </nav>

      <div
        id="turnstile-widget"
        style="position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);z-index:80"
      />

      {/* Shown only when the silent Turnstile attempt cannot produce a token. */}
      <div
        id="turnstile-challenge-overlay"
        class="hidden fixed inset-0 z-[90] bg-black/75 backdrop-blur-sm flex items-end sm:items-center justify-center p-4"
      >
        <div class="w-full max-w-md bg-surface border border-fg/10 rounded-2xl p-5 shadow-2xl">
          <h2 class="text-fg/90 text-[16px] font-semibold">Potwierdź, że nie jesteś robotem</h2>
          <p class="text-muted text-[13px] mt-1">Zweryfikuj się, aby wygenerować listę.</p>

          <div id="turnstile-challenge-widget" class="flex justify-center min-h-[65px] my-4" />

          <p
            id="turnstile-challenge-error"
            role="alert"
            class="hidden lazy-error text-[13px] text-center mb-3"
          >
            Nie udało się załadować weryfikacji.
          </p>

          <button
            id="turnstile-challenge-retry"
            class="hidden lazy-button lazy-button--primary w-full mb-2"
          >
            Spróbuj ponownie
          </button>

          <button id="turnstile-challenge-cancel" class="lazy-button w-full">
            Anuluj
          </button>
        </div>
      </div>
      <script type="module" src="/app.js" />
    </body>
  </html>
)
