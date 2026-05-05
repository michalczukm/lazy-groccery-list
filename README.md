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

| Name | Where | Purpose |
|---|---|---|
| `INVITE_TOKEN` | Cloudflare secret | Token validated on invite endpoint |
| `MISTRAL_API_KEY` | Cloudflare secret | Returned to invited user |
| `INVITE_KV` | KV namespace binding | Usage counter |

Local dev: put vars in `.dev.vars` (gitignored). Production: `pnpm wrangler secret put <NAME>`.

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
