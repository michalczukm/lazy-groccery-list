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
