# Testing the Server-Side AI Proxy

## Pre-requisites

- `pnpm dev` running on `http://localhost:8787`
- `.dev.vars` contains:
  ```
  TURNSTILE_SECRET=1x0000000000000000000000000000000AA
  SESSION_HMAC_SECRET=dev-only-rotate-me-please-32bytes-min
  MISTRAL_API_KEY=<real key>
  ```
- `wrangler.jsonc` `vars.TURNSTILE_SITE_KEY` set to `1x00000000000000000000AA` for local dev (Cloudflare test site key — always passes).

## 1. First-load flow

1. Open an Incognito window → `http://localhost:8787/`.
2. Paste a short list, click "Wyślij".
3. Expected: invisible challenge resolves; list categorizes; `lazy_list_session` cookie set (DevTools → Application → Cookies).

## 2. Returning user (cookie present)

1. Refresh the same tab.
2. Send another list.
3. Expected: no new `/api/session` call in DevTools → Network; `/api/categorize` returns 200 immediately.

## 3. Expired cookie

1. DevTools → Application → Cookies → edit `lazy_list_session` Expires to a past date.
2. Send a list.
3. Expected: `/api/categorize` returns 401 `captcha-required`; client invokes Turnstile; new cookie issued; retry succeeds.

## 4. Rate limit

```bash
for i in $(seq 1 25); do
  curl -s -o /dev/null -w "%{http_code}\n" \
    -X POST http://localhost:8787/api/categorize \
    -H "Origin: http://localhost:8787" \
    -H "Content-Type: application/json" \
    -b "lazy_list_session=<paste valid cookie>" \
    -d '{"text":"mleko"}'
done
```

Expected: first 20 return 200/502 (depending on Mistral key); requests 21+ return 429.

## 5. Foreign origin rejection

```bash
curl -i -X POST http://localhost:8787/api/categorize \
  -H "Origin: https://evil.example" \
  -H "Content-Type: application/json" \
  -d '{"text":"mleko"}'
```

Expected: `HTTP/1.1 403 Forbidden`, body `{"code":"forbidden"}`.

## 6. Mistral upstream failure

1. Temporarily set `MISTRAL_API_KEY=invalid` in `.dev.vars`, restart dev.
2. Send a list.
3. Expected: 502 `upstream-error`; toast "Błąd AI. Spróbuj ponownie."

## 7. Anti-crawler headers

```bash
curl -s http://localhost:8787/robots.txt
curl -sI http://localhost:8787/ | grep -i x-robots-tag
```

Expected:

- `robots.txt` → `User-agent: *` / `Disallow: /`
- header → `x-robots-tag: noindex, nofollow, noarchive`

## 8. CSP sanity

DevTools → Console after page load. No CSP violation warnings. Network shows `challenges.cloudflare.com/turnstile/v0/api.js` loaded. No request to `api.mistral.ai` from browser.

## 9. Visible challenge fallback and recovery (issues #30, #36)

When the silent Turnstile attempt cannot produce a token (as reported on some
Android devices), `executeTurnstile()` renders a visible challenge into the
`#turnstile-challenge-overlay` modal so the user can solve it. If that render is
refused or the challenge itself fails, the modal shows an error line and a
**Spróbuj ponownie** button instead of hanging.

### 9a. Silent failure → visible challenge

Force the fallback in the browser without a real failing device. After the page
loads, stub the silent widget to fire its error callback (needs the CF test keys
from `.dev.vars.example`):

```js
const realRender = window.turnstile.render.bind(window.turnstile)
const realExecute = window.turnstile.execute.bind(window.turnstile)
const realRemove = window.turnstile.remove.bind(window.turnstile)
window.turnstile.render = (container, opts) => {
  if (container === '#turnstile-widget') {
    setTimeout(() => opts['error-callback']('600010'), 0)
    return 'fake-silent'
  }
  return realRender(container, opts) // real visible widget; test key auto-solves
}
window.turnstile.execute = id => (id === 'fake-silent' ? undefined : realExecute(id))
window.turnstile.remove = id => (id === 'fake-silent' ? true : realRemove(id))
```

Then paste a list and press generate. Confirm:

- the modal appears above the loading overlay (`z-[90]` vs `z-[70]`),
- a Turnstile checkbox renders inside `#turnstile-challenge-widget`,
- the console logs `[turnstile] silent-fallback` then `[turnstile] challenge-render`,
- solving it fires `POST /api/session` → `204`, then retries `POST /api/categorize`,
- pressing **Anuluj** hides the modal and toasts
  "Weryfikacja nie powiodła się. Spróbuj ponownie."

The silent → visible promotion happens **at most once** per `ensureSession()`
call — a second silent failure or the 8s watchdog after the modal is already up
does nothing. Retries within the visible stage are unlimited.

### 9b. Empty modal recovery (issue #36)

Simulate Cloudflare refusing the visible render — the original bug, where the
modal opened with nothing inside it and only a reload helped:

```js
const realRender = window.turnstile.render.bind(window.turnstile)
let refuse = true
window.turnstile.render = (container, opts) => {
  if (container === '#turnstile-widget') {
    setTimeout(() => opts['error-callback']('600010'), 0)
    return 'fake-silent'
  }
  if (refuse) {
    refuse = false
    return undefined // what CF does when it will not render
  }
  return realRender(container, opts)
}
window.turnstile.execute = () => {}
window.turnstile.remove = () => {}
```

Paste a list and press generate. Confirm:

- the modal opens with the error line "Nie udało się załadować weryfikacji."
  and a **Spróbuj ponownie** button — **not** an empty box,
- the console logs `[turnstile] challenge-render-failed` with `reason: 'empty'`,
- pressing **Spróbuj ponownie** logs `challenge-retry` and renders a working
  checkbox in the same modal, with no page reload,
- solving it completes the original categorize request and the pasted text is
  still in the input (app state survived).

### 9c. Script never loads

In DevTools → Network, block `challenges.cloudflare.com/*`, reload, paste a list
and press generate. After ~10s confirm the console logs
`[turnstile] script-timeout` and the app toasts
"Weryfikacja nie powiodła się. Spróbuj ponownie." instead of spinning forever.

### 9d. Token expiry

Waiting out a real token's lifetime is impractical to test live, and
intercepting `window.turnstile.reset` never triggers `expired-callback` — that
callback only fires from inside Cloudflare's widget. Instead, capture the
callback at render time and fire it yourself from the console:

```js
const realRender = window.turnstile.render.bind(window.turnstile)
/** @type {(() => void) | undefined} */
let expire
window.turnstile.render = (container, opts) => {
  if (container === '#turnstile-challenge-widget') expire = opts['expired-callback']
  return realRender(container, opts)
}
```

Trigger the fallback per 9a to get the visible challenge open (which captures
`expire`), then run `expire()` in the console. Confirm the console logs
`[turnstile] challenge-expired` followed by `challenge-reset`, and the widget
becomes solvable again without the error line appearing.
