# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
pnpm vendor     # esbuild client deps from node_modules → public/vendor (gitignored)
pnpm dev        # pnpm vendor, then local dev server via wrangler
pnpm deploy     # pnpm vendor, then deploy to Cloudflare Workers (minified)
pnpm test       # run vitest (Cloudflare Workers pool)
pnpm typecheck  # tsc on src (Workers) + public DOM JS + service worker (all checkJs)
pnpm cf-typegen # regenerate Cloudflare bindings types → worker-configuration.d.ts
pnpm lint       # oxlint (correctness rules, error)
pnpm lint:fix   # oxlint --fix
pnpm fmt        # oxfmt (write)
pnpm fmt:check  # oxfmt --check
```

Linting/formatting via oxc: `oxlint` (`.oxlintrc.json`) + `oxfmt` (`.oxfmtrc.json`, single-quote/no-semi/avoid-arrow-parens). A husky `pre-commit` hook runs `lint-staged`, which applies `oxlint --fix` + `oxfmt` to staged files only.

**Client JS docs:** `public/*.js` carry type-checked JSDoc that is **TYPES-ONLY** — JSDoc blocks contain only typed tags (`@param {Type} name`, `@returns {Type}`) with **no prose**: no summary line, no `@param`/`@returns` descriptions. A function with no parameters and no meaningful return may **omit the JSDoc block entirely** (an empty block is not required); keep a one-line `@returns {Type}` only where the type is load-bearing for inference (e.g. a `new Promise()` resolve hint). Reference the shared `@typedef`s in `public/globals.d.ts` (`ShoppingListData`, `Category`, `Item`, `Template`, …) by name. Preact components use `@returns {import('preact').VNode}` and a single typed `props` object. `pnpm typecheck` runs three tsconfigs — `tsconfig.test.json` (Workers `src`), `tsconfig.public.json` (browser DOM JS via the glob `public/**/*.js`, with `public/sw.js` and the generated `public/vendor` excluded), and `tsconfig.sw.json` (service worker) — all with `checkJs`. `preact`, `@preact/signals`, `htm` and `canvas-confetti` are runtime `dependencies` (vendored into `public/vendor`, see above) and double as the types `checkJs` resolves app.js's bare imports against; `@types/canvas-confetti` supplies the types that package ships without. oxlint runs the `jsdoc` plugin on `public/**/*.js` and enforces `@param`/`@returns` _types_ where blocks exist (no `require-*-description` rules are enabled, so dropping descriptions stays lint-clean); note oxlint 1.71 has no `require-jsdoc` and no `jsdoc/check-param-names`, so JSDoc presence and `@param` name matching are by convention/review while types are machine-enforced.

**Analytics privacy rule:** never interpolate list content (item names, titles, share payloads)
into thrown `Error` messages. `$exception_message` and stack traces reach PostHog and are the one
property no sanitizer can clean. Buckets and codes only.

## Architecture

**Stack:** Hono (edge framework) + Cloudflare Workers runtime. UI uses HTMX for partial HTML swaps plus Preact islands for interactive components. PWA with service worker.

**Rendering split:**

- `src/` — server-side Hono JSX views **plus** the AI proxy API (`/api/session`, `/api/categorize`). Views return static HTML shells (empty containers). No persistent server-side state — IndexedDB on the client holds all lists.
- `public/app.js` — client business logic. Preact components mount into server-rendered containers at runtime.
- `public/vendor/` — **generated, gitignored.** `pnpm vendor` runs esbuild over the one-line re-export stubs in `scripts/vendor-entries/` (see the README there), bundling `preact`, `preact/hooks`, `@preact/signals`, `htm` and `canvas-confetti` out of `node_modules` into minified ESM + source maps. The importmap in `src/layout.tsx` points every bare specifier at the resulting entry files.

**Client deps are vendored, not CDN-loaded.** They used to come from esm.sh, which forced CSP to trust that origin in `script-src` and pin per-version paths in `connect-src` — and esm.sh resolves transitive deps by semver **range** at request time (`@preact/signals` imports `@preact/signals-core@^1.7.0`), so an upstream 1.14.3 → 1.14.4 bump changed the shipped bytes and broke CSP with no commit anywhere. Vendoring makes `pnpm-lock.yaml` the single source of truth and lets CSP drop esm.sh entirely.

This is the only build step in the project; `public/*.js` app code is still hand-authored and served raw, never bundled.

Consequences to keep in mind when touching this:

- `preact`, `@preact/signals`, `htm`, `canvas-confetti` are real `dependencies`, not devDeps — their bytes ship.
- `--splitting` is load-bearing, not a size optimisation. It hoists preact into one shared chunk that `preact.js`, `hooks.js` and `signals.js` all import. Drop it and each entry inlines its own preact; signals then patches an `options` object the app never renders through, and the list goes stale on add/toggle. This replaces the old esm.sh `?external=preact` query hack.
- Transitive deps (`@preact/signals-core`) are bundled into their importer and must **not** get importmap entries — nothing requests them by bare name, and an entry would load a second copy alongside the bundled one. A test asserts the importmap keys exactly.
- `public/vendor` is excluded from `tsconfig.public.json`, `.oxlintrc.json` and `.oxfmtrc.json` — it is third-party dist code, not ours.
- Anything invoking wrangler **directly** rather than through a package.json script must run `pnpm vendor` first, or it ships an empty `public/vendor`. The CI preview job (`wrangler versions upload`) does exactly this and has its own vendor step.

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
- **Turnstile** — to obtain a session the client solves a Cloudflare Turnstile challenge (`public/turnstile.js`) and POSTs the token to `/api/session`, which verifies it server-side (`src/lib/turnstile.ts`) and sets the cookie. `executeTurnstile()` is two-stage: a silent `interaction-only`/`execute` attempt, then — on any failure callback or an 8s watchdog — a visible challenge rendered once into the `#turnstile-challenge-overlay` modal. Client auto-retries `callCategorize` once after `ensureSession()`.

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
- `public/analytics.js` — PostHog init, boot-error buffer
- `public/analytics-sanitize.js` — URL sanitizer + share-payload kill switch (privacy-critical)
- `src/lib/posthog.ts` — `/basket/*` reverse proxy + server-side `captureServer()`
- `scripts/vendor-entries/` — one-line re-export stubs, one per bare specifier; esbuild entry points for `pnpm vendor`
- `wrangler.jsonc` — Workers config (entry: `src/index.tsx`, assets: `./public`, `AI_RATE_LIMIT` ratelimit binding)

**Secrets / vars (wrangler):** `MISTRAL_API_KEY`, `TURNSTILE_SECRET`, `SESSION_HMAC_SECRET` (secrets); `TURNSTILE_SITE_KEY` (public var); `POSTHOG_KEY`, `POSTHOG_HOST` (public vars, optional — absent means analytics is fully disabled).

**Data shape stored in IndexedDB** (emoji is derived client-side, not stored):

```json
{
  "id": 1234567890,
  "title": "Zakupy 5 maj",
  "date": 1234567890,
  "saved": true,
  "categories": [
    {
      "name": "nabiał",
      "collapsed": false,
      "manualExpand": false,
      "items": [{ "name": "Mleko 1L", "checked": false }]
    }
  ]
}
```

**UI language:** Polish throughout (category names, labels, prompts).

**UI design:** Mobile-first. Design and verify the phone viewport first; desktop (sidebar + multi-column grid via `md:`/`lg:` Tailwind breakpoints) is the progressive enhancement, not the baseline.

**Privacy policy:** the `/privacy` page describes what data is collected, where it is sent (Cloudflare Turnstile, Mistral AI), cookies, and local storage. After ANY change to data handling — new data collected/stored, new third party or sub-processor, cookies, IP usage, retention, or the share mechanism — review `src/views/privacy.tsx` and update it if needed (and bump its "last updated" date).

## Testing

### Unit tests

Run: `pnpm test` (vitest). Tests live next to source: `src/index.test.ts`, `src/lib/*.test.ts`.

### Manual testing & smoke tests

- [Share feature testing guide](docs/testing-share-feature.md) — manual steps, automated snippets, known bugs fixed, edge cases.
- [Testing server-side AI proxy](docs/testing-server-proxy.md) — manual steps, automated snippets, known bugs fixed, edge cases.
- [Testing PostHog analytics](docs/testing-analytics.md) — off-by-default gates, enabling locally, and the pre-release privacy check.
