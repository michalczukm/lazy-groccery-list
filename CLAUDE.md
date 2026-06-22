# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
pnpm dev        # local dev server via wrangler
pnpm deploy     # deploy to Cloudflare Workers (minified)
pnpm test       # run vitest (Cloudflare Workers pool)
pnpm cf-typegen # regenerate Cloudflare bindings types → worker-configuration.d.ts
```

No lint script exists.

## Architecture

**Stack:** Hono (edge framework) + Cloudflare Workers runtime. UI uses HTMX for partial HTML swaps plus Preact islands for interactive components. PWA with service worker.

**Rendering split:**
- `src/` — server-side Hono JSX views **plus** the AI proxy API (`/api/session`, `/api/categorize`). Views return static HTML shells (empty containers). No persistent server-side state — IndexedDB on the client holds all lists.
- `public/app.js` — client business logic. Preact components mount into server-rendered containers at runtime.

**Data flow:**
1. User pastes raw shopping text in the input view.
2. Client `callCategorize()` in `app.js` POSTs the text to `/api/categorize`. The Worker (`src/lib/mistral.ts` `categorize()`) calls Mistral AI server-side (`mistral-small-latest`, Polish category schema via JSON-schema `response_format`, temperature 0.1).
3. Server returns `{ categories: [{ name, items: string[] }] }`. Client maps items to `{ name, checked: false }`, derives the per-category emoji locally (`CATEGORY_EMOJI` map / `emojiFor()` in `app.js`), and adds `collapsed`/`manualExpand` UI flags.
4. Categorized list is stored in IndexedDB (`LazyGrocceryList` db, `lists` store).
5. Preact `ShoppingList` component renders from IndexedDB state; checked items auto-save back.

**AI proxy & auth:** All Mistral calls go browser → Worker → Mistral. The Mistral key lives only as the `MISTRAL_API_KEY` Worker secret — never exposed to the browser. CSP `connect-src` is `'self'`. Request gating on `/api/categorize`:
- **Same-origin guard** (`src/lib/origin-guard.ts`) — rejects cross-origin with 403.
- **Rate limit** — `AI_RATE_LIMIT` binding (20 req / 60s per IP), 429 on exceed.
- **Session cookie** — signed HMAC cookie (`src/lib/cookie-session.ts`), 24h max age. Missing/invalid → 401 `captcha-required`.
- **Turnstile** — to obtain a session the client solves an invisible Cloudflare Turnstile challenge (`public/turnstile.js`) and POSTs the token to `/api/session`, which verifies it server-side (`src/lib/turnstile.ts`) and sets the cookie. Client auto-retries `callCategorize` once after `ensureSession()`.

Input is capped at `MAX_INPUT_CHARS` (10 000).

**Key files:**
- `src/index.tsx` — Hono app, API routes, view routes, CSP headers, `Env` bindings
- `src/lib/mistral.ts` — server-side Mistral call, category schema, system prompt
- `src/lib/cookie-session.ts` — HMAC sign/verify session cookie
- `src/lib/origin-guard.ts` — same-origin check
- `src/lib/turnstile.ts` — Turnstile token verification
- `src/layout.tsx` — HTML shell, bottom navigation, modal
- `src/views/*.tsx` — thin HTML containers (no logic)
- `public/app.js` — API calls, IndexedDB, Preact components, emoji map, all event handling
- `public/turnstile.js` — invisible Turnstile widget helper
- `public/share-state.js` — gzip encode/decode list for share links
- `public/merge-amend.js` — merge appended categories into an existing list
- `wrangler.jsonc` — Workers config (entry: `src/index.tsx`, assets: `./public`, `AI_RATE_LIMIT` ratelimit binding)

**Secrets / vars (wrangler):** `MISTRAL_API_KEY`, `TURNSTILE_SECRET`, `SESSION_HMAC_SECRET` (secrets); `TURNSTILE_SITE_KEY` (public var).

**Data shape stored in IndexedDB** (emoji is derived client-side, not stored):
```json
{
  "id": 1234567890,
  "title": "Zakupy 5 maj",
  "date": 1234567890,
  "saved": true,
  "categories": [
    { "name": "nabiał", "collapsed": false, "manualExpand": false, "items": [{ "name": "Mleko 1L", "checked": false }] }
  ]
}
```

**UI language:** Polish throughout (category names, labels, prompts).

## Testing

### Unit tests

Run: `pnpm test` (vitest). Tests live next to source: `src/index.test.ts`, `src/lib/*.test.ts`.

### Manual testing & smoke tests

- [Share feature testing guide](docs/testing-share-feature.md) — manual steps, automated snippets, known bugs fixed, edge cases.
- [Testing server-side AI proxy](docs/testing-server-proxy.md) — manual steps, automated snippets, known bugs fixed, edge cases.
