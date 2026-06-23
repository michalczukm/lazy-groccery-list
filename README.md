# Lazy List (🍓 the groccery list)

PWA shopping list app that automatically makes your groccery list from plain text and categorizes it. Runs on Cloudflare Workers.

![create list](./docs/list-demo-1.png)
![list view](./docs/list-demo-2.png)

## Stack

- **[Hono](https://hono.dev/)** — server + JSX rendering
- **[HTMX](https://htmx.org/)** — partial HTML swaps
- **[Cloudflare Workers](https://workers.cloudflare.com/)** — edge runtime
- PWA with service worker and installable manifest

## Invite system

`GET /api/invite?token=<token>` — validates token, returns Mistral API key, increments usage counter in KV.

On load, app detects `?token=` in URL, calls the endpoint, stores returned key in `localStorage`, shows toast. Lets you share a link that auto-provisions the API key for the recipient.

**Required env vars / secrets:**

| Name                  | Where             | Purpose                    |
| --------------------- | ----------------- | -------------------------- |
| `MISTRAL_API_KEY`     | Cloudflare secret | Returned to invited user   |
| `TURNSTILE_SECRET`    | Cloudflare secret | Turnstile secret           |
| `TURNSTILE_SITE_KEY`  | Cloudflare var    | Turnstile site key         |
| `SESSION_HMAC_SECRET` | Cloudflare secret | Session cookie HMAC secret |

Local dev: put vars in `.dev.vars` (gitignored). Production: `pnpm wrangler secret put <NAME>`.

## Turnstile (bot protection)

To get an AI session the client solves an **invisible** Cloudflare Turnstile challenge (`public/turnstile.js`, `size: 'invisible'`) and POSTs the token to `/api/session`, which verifies it server-side and sets a signed session cookie.

Two distinct keys — **don't mix them up** (the sitekey is the public client widget key, the secret is the server-side verify key, and they have different formats):

| Var                  | Side                                        | Format example        |
| -------------------- | ------------------------------------------- | --------------------- |
| `TURNSTILE_SITE_KEY` | client (public, in `wrangler.jsonc` `vars`) | `0xAAAA…` (~24 chars) |
| `TURNSTILE_SECRET`   | server (secret)                             | `0x4AAAA…`            |

### Local dev test keys (always pass on localhost)

Cloudflare's [dummy test keys](https://developers.cloudflare.com/turnstile/troubleshooting/testing/) let the challenge auto-pass locally:

| Var                  | Test value                            | Notes                                                                             |
| -------------------- | ------------------------------------- | --------------------------------------------------------------------------------- |
| `TURNSTILE_SITE_KEY` | `1x00000000000000000000BB`            | **invisible** always-pass sitekey (matches our widget). Visible variant is `…AA`. |
| `TURNSTILE_SECRET`   | `1x0000000000000000000000000000000AA` | always-pass secret (35 chars)                                                     |

⚠️ The dummy **sitekey** (`1x000…BB`, 22 chars) and dummy **secret** (`1x000…AA`, 35 chars) look alike but are NOT interchangeable. Putting the secret value in `TURNSTILE_SITE_KEY` makes the widget reject it as an invalid sitekey and the challenge never passes.

## Dev

```sh
pnpm install
pnpm dev
```

## Deploy

Add "run" to avoid pnpm moaning about workspace.

```sh
pnpm run deploy
```
