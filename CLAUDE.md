# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
pnpm dev        # local dev server via wrangler
pnpm deploy     # deploy to Cloudflare Workers (minified)
pnpm cf-typegen # regenerate Cloudflare bindings types → worker-configuration.d.ts
```

No test or lint scripts exist.

## Architecture

**Stack:** Hono (edge framework) + Cloudflare Workers runtime. UI uses HTMX for partial HTML swaps plus Preact islands for interactive components. PWA with service worker.

**Rendering split:**
- `src/` — server-side Hono JSX. Routes return static HTML shells (empty containers). No server-side state or API endpoints beyond view rendering.
- `public/app.js` — all business logic. Preact components mount into server-rendered containers at runtime.

**Data flow:**
1. User pastes raw shopping text in the input view.
2. `processWithMistral()` in `app.js` calls Mistral AI API directly from the browser (`mistral-small-latest`, Polish category schema, temperature 0.1).
3. Categorized JSON is stored in IndexedDB (`ZakupyAI` db, `lists` store).
4. Preact `ShoppingList` component renders from IndexedDB state; checked items auto-save back.

**API key:** User-provided Mistral key stored in `localStorage` (`zakupy_api_key`). Never sent to the Workers backend — all AI calls go browser → Mistral API directly. CSP in `src/index.tsx` permits `connect-src https://api.mistral.ai`.

**Key files:**
- `src/index.tsx` — Hono app, all routes, CSP headers
- `src/layout.tsx` — HTML shell, bottom navigation, modal
- `src/views/*.tsx` — thin HTML containers (no logic)
- `public/app.js` — Mistral integration, IndexedDB, Preact components, all event handling
- `wrangler.jsonc` — Workers config (entry: `src/index.tsx`, assets: `./public`)

**Data shape stored in IndexedDB:**
```json
{
  "id": 1234567890,
  "title": "Zakupy 5 maj",
  "date": 1234567890,
  "saved": true,
  "model": "mistral-small-latest",
  "categories": [
    { "name": "nabiał", "emoji": "🥛", "collapsed": false, "items": [{ "name": "Mleko 1L", "checked": false }] }
  ]
}
```

**UI language:** Polish throughout (category names, labels, prompts).
