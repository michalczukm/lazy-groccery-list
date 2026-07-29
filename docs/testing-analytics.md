# Testing PostHog analytics

## Off by default

Analytics is disabled unless `POSTHOG_KEY` is set. Four independent gates enforce this:

| Gate             | File                  | Behaviour without a key                              |
| ---------------- | --------------------- | ---------------------------------------------------- |
| Layout injection | `src/layout.tsx`      | neither the key script nor `analytics.js` is emitted |
| Client init      | `public/analytics.js` | `start()` returns before loading anything            |
| Proxy route      | `src/lib/posthog.ts`  | `/basket/*` returns 404                              |
| Server capture   | `src/lib/posthog.ts`  | `captureServer()` returns immediately                |

Dev and test are therefore off unless you opt in. `wrangler.test.jsonc` sets `phc_test`, which
exercises the code paths without a reachable PostHog project.

## Enabling locally

Put the project token in `.dev.vars`:

```
POSTHOG_KEY=phc_your_project_token
```

Then `pnpm dev` and open http://localhost:8787.

## Confirming events arrive

1. Open the PostHog EU project → **Activity** (live event feed).
2. Load the app. Within a few seconds you should see `$pageview`.
3. In DevTools Network, filter `basket`. Expect `GET /basket/static/array.js` (200) and
   `POST /basket/e/` or `/basket/i/v0/e/` (200).
4. In the console, run `throw new Error('analytics smoke test')`. An `$exception` event should
   appear in the feed. **Never** put list content in that message.
5. Stop the dev server and submit a list to trigger a fetch failure. Expect
   `network_request_failed` with `route: /api/categorize`.

## How the privacy gates work

`public/analytics.js` calls `posthog.init` with `person_profiles: 'never'`, and its `before_send`
hook unconditionally strips `$set` / `$set_once` / `$unset` off every event before it reaches
`sanitizeProperties` — no identity-linking payload leaves the browser, even in a mangled event.

`public/analytics-sanitize.js` is the privacy-critical file:

- Every string-valued property that looks like a URL (`^https?://`) is truncated to
  `origin + pathname` — no query string, no fragment, ever reaches PostHog.
- If the page was loaded via a share link (`?state=...` with a value of at least
  `MIN_SECRET_LEN` = 8 characters), `sanitizeProperties` takes a probe of that `state` value (the
  first 24 characters, or the whole value if shorter) and checks whether the serialized,
  URL-stripped properties still contain it. If they do, the entire event is dropped
  (`sanitizeProperties` returns `null`, `before_send` returns `null`, PostHog never sees it).
- `sanitizeProperties` **fails closed**: any internal exception while sanitizing (cyclic object,
  unexpected shape, etc.) also makes it return `null` and the event is dropped. A bug in the
  sanitizer can only lose an event, never leak one.

`tracing_headers` is set to `[location.hostname]` (not `location.host`) — posthog-js matches
tracing headers on hostname without a port, so `location.host` (which includes `:8787` locally)
would silently never match.

## Privacy check (run this before every release that touches analytics)

Share links carry the whole list in `?state=`, and PostHog initializes before
`handleSharedState` clears the URL — so a `$pageview` fires while the payload is still in
`location.href`. This is the exact scenario `public/analytics-sanitize.js` exists for.

1. Create a list, share it, open the resulting `/?state=...` link in a fresh tab.
2. DevTools Network → filter `basket` → inspect every request body.

Expected: no body contains the `state` payload, any item name, or the list title. `$current_url`
reads `http://localhost:8787/` with no query string.

If a payload ever does appear, the kill switch in `sanitizeProperties` failed — treat it as a
privacy incident, not a bug: revert the analytics init before investigating.

## What PostHog receives about the request itself

`proxyPosthog` (`src/lib/posthog.ts`) forwards `/basket/*` requests to PostHog but strips the
`cookie`, `cf-connecting-ip`, `x-forwarded-for`, and `x-real-ip` headers before forwarding. PostHog
never sees the visitor's real IP address — only our own Worker's, since Cloudflare re-adds its own
connecting-IP header for the outbound `fetch`. It also strips our signed session cookie, so the
analytics proxy can never be used to read or replay the app's auth cookie.

## Opting out

- Browser "Do Not Track" is respected via `respect_dnt: true` — nothing is collected.
- Per-user, from the console: `posthog.opt_out_capturing()`. Persists in localStorage.
- Whole deployment: unset `POSTHOG_KEY`.
