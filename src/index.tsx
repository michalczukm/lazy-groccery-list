import { Hono } from 'hono'
import type { ExecutionContext } from 'hono'
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
  const ip = c.req.header('CF-Connecting-IP') ?? 'unknown'
  const limit = await c.env.AI_RATE_LIMIT.limit({ key: ip })
  if (!limit.success) {
    return c.json({ code: 'rate-limited' }, 429)
  }

  const body = await c.req.json<{ text?: string }>().catch(() => ({}) as { text?: string })
  const text = (body.text ?? '').trim()
  if (!text || text.length > MAX_INPUT_CHARS) {
    return c.json({ code: 'missing-text' }, 400)
  }

  const result = await categorize(text, c.env.MISTRAL_API_KEY)
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

  return c.json({
    url: await shareUrlFor(new URL(c.req.url).origin, listFromCategories(result.categories)),
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
      <InputView />
    </Layout>,
  ),
)

app.get('/views/input', c => c.html(<InputView />))
app.get('/views/list', c => c.html(<ListView />))
app.get('/views/history', c => c.html(<HistoryView />))
app.get('/views/templates', c => c.html(<TemplatesView />))

app.get('/privacy', c => c.html(<PrivacyView />))

app.get('/integrations', c =>
  c.text(
    `# Lazy List integrations

POST /api/integrations/categorize

Send free shopping-list text and receive a ready-to-open share URL. This endpoint is open for non-browser callers such as Siri Shortcuts, Alfred, webhooks, bots, and agents. It intentionally skips the browser Origin guard, session cookie, and Turnstile challenge because those callers do not have a browser context. Calls are still rate-limited per caller IP with the same AI rate-limit binding as the browser AI endpoint.

Request:

\`\`\`bash
curl -s -X POST https://lazy-shopping.michalczukm.xyz/api/integrations/categorize \\
  -H 'Content-Type: application/json' \\
  -d '{"text":"mleko, chleb"}'
\`\`\`

Success response:

\`\`\`json
{"url":"https://lazy-shopping.michalczukm.xyz/?state=..."}
\`\`\`

Error responses:

\`\`\`json
{"code":"missing-text"}
{"code":"rate-limited"}
{"code":"categorize-failed"}
\`\`\`

Give the returned URL to the user. Opening it renders the categorized list without needing a Mistral key in the browser.
`,
    200,
    { 'Content-Type': 'text/markdown; charset=UTF-8' },
  ),
)

export default app
export { ListSyncRoom }
