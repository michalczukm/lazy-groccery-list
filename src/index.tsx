import { Hono } from 'hono'
import type { Context, ExecutionContext } from 'hono'
import { jsxRenderer } from 'hono/jsx-renderer'
import { secureHeaders } from 'hono/secure-headers'
import { setCookie, getCookie } from 'hono/cookie'
import { Layout } from './layout'
import { InputView } from './views/input'
import { ListView } from './views/list'
import { HistoryView } from './views/history'
import { TemplatesView } from './views/templates'
import { PrivacyView } from './views/privacy'
import { isSameOrigin } from './lib/origin-guard'
import { signSession, verifySession } from './lib/cookie-session'
import { verifyTurnstile } from './lib/turnstile'
import { categorize } from './lib/mistral'
import { listFromCategories, shareUrlFor } from './lib/share-url'
import { proxyPosthog, captureServer, distinctIdFrom } from './lib/posthog'
import { ListSyncRoom, isValidSyncRoom } from './lib/list-sync-room'

export interface Env {
  MISTRAL_API_KEY: string
  TURNSTILE_SECRET: string
  SESSION_HMAC_SECRET: string
  TURNSTILE_SITE_KEY: string
  AI_RATE_LIMIT: RateLimit
  LIST_SYNC_ROOMS: DurableObjectNamespace<ListSyncRoom>
  POSTHOG_KEY?: string
  POSTHOG_HOST?: string
}

const SESSION_COOKIE = 'lazy_list_session'
const SESSION_MAX_AGE_SEC = 86400
const MAX_INPUT_CHARS = 10_000

const app = new Hono<{ Bindings: Env }>()

app.use(
  secureHeaders({
    contentSecurityPolicy: {
      defaultSrc: ["'self'"],
      scriptSrc: [
        "'self'",
        "'unsafe-inline'",
        'https://cdn.tailwindcss.com',
        'https://unpkg.com',
        'https://challenges.cloudflare.com',
      ],
      styleSrc: ["'self'", "'unsafe-inline'"],
      connectSrc: ["'self'"],
      imgSrc: ["'self'", 'data:'],
      frameSrc: ['https://challenges.cloudflare.com'],
      workerSrc: ["'self'"],
      manifestSrc: ["'self'"],
    },
  }),
)

app.use('*', async (c, next) => {
  await next()
  c.header('X-Robots-Tag', 'noindex, nofollow, noarchive')
})

app.post('/api/session', async c => {
  if (!isSameOrigin(c.req.raw)) {
    return c.json({ code: 'forbidden' }, 403)
  }

  const body = await c.req.json<{ turnstileToken?: string }>().catch(() => ({}))
  if (!('turnstileToken' in body && body.turnstileToken)) {
    return c.json({ code: 'missing-token' }, 400)
  }

  const ip = c.req.header('CF-Connecting-IP') ?? null
  const result = await verifyTurnstile({
    token: body.turnstileToken,
    ip,
    secret: c.env.TURNSTILE_SECRET,
  })
  if (!result.success) {
    return c.json({ code: 'captcha-failed' }, 403)
  }

  const cookie = await signSession(c.env.SESSION_HMAC_SECRET, Math.floor(Date.now() / 1000))
  setCookie(c, SESSION_COOKIE, cookie, {
    httpOnly: true,
    secure: true,
    sameSite: 'Strict',
    path: '/',
    maxAge: SESSION_MAX_AGE_SEC,
  })
  return c.body(null, 204)
})

const fireAndForget = (c: { executionCtx: ExecutionContext }, work: Promise<unknown>): void => {
  try {
    c.executionCtx.waitUntil(work)
  } catch {
    work.catch(() => {})
  }
}

type AppContext = Context<{ Bindings: Env }>

const integrationCategorize = async (
  c: AppContext,
  text: string,
  options?: { redirect?: boolean },
) => {
  const ip = c.req.header('CF-Connecting-IP') ?? 'unknown'
  const limit = await c.env.AI_RATE_LIMIT.limit({ key: ip })
  if (!limit.success) {
    return c.json({ code: 'rate-limited' }, 429)
  }

  const normalizedText = text.trim()
  if (!normalizedText || normalizedText.length > MAX_INPUT_CHARS) {
    return c.json({ code: 'missing-text' }, 400)
  }

  const result = await categorize(normalizedText, c.env.MISTRAL_API_KEY)
  if (!result.ok) {
    fireAndForget(
      c,
      captureServer(c.env, {
        event: 'worker_request_error',
        distinctId: distinctIdFrom(c.req.raw),
        properties: {
          route: '/api/integrations/categorize',
          status: 502,
          code: 'categorize-failed',
          reason: result.reason,
        },
      }),
    )
    return c.json({ code: 'categorize-failed' }, 502)
  }

  const url = await shareUrlFor(new URL(c.req.url).origin, listFromCategories(result.categories))
  if (options?.redirect) {
    return c.redirect(url)
  }

  return c.json({ url })
}

app.post('/api/categorize', async c => {
  if (!isSameOrigin(c.req.raw)) {
    return c.json({ code: 'forbidden' }, 403)
  }

  const ip = c.req.header('CF-Connecting-IP') ?? 'unknown'
  const limit = await c.env.AI_RATE_LIMIT.limit({ key: ip })
  if (!limit.success) {
    return c.json({ code: 'rate-limited' }, 429)
  }

  const cookie = getCookie(c, SESSION_COOKIE)
  if (!cookie) {
    return c.json({ code: 'captcha-required' }, 401)
  }
  const session = await verifySession(
    cookie,
    c.env.SESSION_HMAC_SECRET,
    SESSION_MAX_AGE_SEC,
    Math.floor(Date.now() / 1000),
  )
  if (!session.valid) {
    return c.json({ code: 'captcha-required' }, 401)
  }

  const body = await c.req.json<{ text?: string }>().catch(() => ({}) as { text?: string })
  const text = (body.text ?? '').trim()
  if (!text || text.length > MAX_INPUT_CHARS) {
    return c.json({ code: 'invalid-input' }, 400)
  }

  const result = await categorize(text, c.env.MISTRAL_API_KEY)
  if (!result.ok) {
    fireAndForget(
      c,
      captureServer(c.env, {
        event: 'worker_request_error',
        distinctId: distinctIdFrom(c.req.raw),
        properties: {
          route: '/api/categorize',
          status: 502,
          code: 'upstream-error',
          reason: result.reason,
        },
      }),
    )
    return c.json({ code: 'upstream-error' }, 502)
  }
  return c.json({ categories: result.categories })
})

app.post('/api/integrations/categorize', async c => {
  const body = await c.req.json<{ text?: string }>().catch(() => ({}) as { text?: string })
  return integrationCategorize(c, body.text ?? '')
})

app.get('/api/integrations/categorize', async c => {
  const searchParams = new URL(c.req.url).searchParams
  return integrationCategorize(c, searchParams.get('text') ?? '', {
    redirect: searchParams.get('mode') === 'redirect',
  })
})

app.get('/api/list-sync/:room', c => {
  if (c.req.header('Upgrade') !== 'websocket') {
    return c.json({ code: 'websocket-required' }, 426)
  }

  const room = c.req.param('room')
  if (!isValidSyncRoom(room)) {
    return c.json({ code: 'invalid-room' }, 400)
  }

  const id = c.env.LIST_SYNC_ROOMS.idFromName(room)
  return c.env.LIST_SYNC_ROOMS.get(id).fetch(c.req.raw)
})

app.all('/basket/*', c => proxyPosthog(c.req.raw, c.env))

app.get('/', jsxRenderer(), c =>
  c.render(
    <Layout turnstileSiteKey={c.env.TURNSTILE_SITE_KEY} posthogKey={c.env.POSTHOG_KEY}>
      <InputView integrationUrl={`${new URL(c.req.url).origin}/integrations`} />
    </Layout>,
  ),
)

app.get('/views/input', c =>
  c.html(<InputView integrationUrl={`${new URL(c.req.url).origin}/integrations`} />),
)
app.get('/views/list', c => c.html(<ListView />))
app.get('/views/history', c => c.html(<HistoryView />))
app.get('/views/templates', c => c.html(<TemplatesView />))

app.get('/privacy', c => c.html(<PrivacyView />))

app.get('/integrations', c => {
  const origin = new URL(c.req.url).origin
  return c.html(`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Lazy List integrations</title>
  </head>
  <body>
    <main>
      <h1>Lazy List integrations</h1>
      <p>Use this open endpoint to turn free shopping-list text into a ready-to-open Lazy List share URL.</p>
      <p>The endpoint intentionally skips browser-only Origin, session cookie, and Turnstile checks so non-browser callers such as Siri Shortcuts, Alfred, webhooks, bots, and agents can use it. Calls are still rate-limited per caller IP with the same AI rate-limit binding as the browser AI endpoint.</p>

      <h2>Simple chats and limited environments</h2>
      <p>If you cannot call APIs or process JSON, return a URL in this format to the user. Put the user's shopping text URL-encoded in the <code>text</code> query parameter.</p>
      <pre><code>${origin}/api/integrations/categorize?mode=redirect&amp;text=mleko%2C%20chleb</code></pre>

      <h2>Recommended for agents</h2>
      <p>Call <code>GET /api/integrations/categorize?text=...</code> with the user's shopping text URL-encoded in the <code>text</code> query parameter.</p>
      <pre><code>curl -s "${origin}/api/integrations/categorize?text=mleko%2C%20chleb"</code></pre>

      <h2>POST alternative</h2>
      <p>Call <code>POST /api/integrations/categorize</code> with JSON body <code>{"text":"..."}</code>.</p>
      <pre><code>curl -s -X POST "${origin}/api/integrations/categorize" \\
  -H 'Content-Type: application/json' \\
  -d '{"text":"mleko, chleb"}'</code></pre>

      <h2>Success response</h2>
      <pre><code>{"url":"${origin}/?state=..."}</code></pre>

      <h2>Error responses</h2>
      <pre><code>{"code":"missing-text"}
{"code":"rate-limited"}
{"code":"categorize-failed"}</code></pre>

      <p>Give the returned URL to the user. Opening it renders the categorized list without needing a Mistral key in the browser.</p>
    </main>
  </body>
</html>`)
})

export default app
export { ListSyncRoom }
