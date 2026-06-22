import { Hono } from 'hono'
import { jsxRenderer } from 'hono/jsx-renderer'
import { secureHeaders } from 'hono/secure-headers'
import { setCookie, getCookie } from 'hono/cookie'
import { Layout } from './layout'
import { InputView } from './views/input'
import { ListView } from './views/list'
import { HistoryView } from './views/history'
import { PrivacyView } from './views/privacy'
import { isSameOrigin } from './lib/origin-guard'
import { signSession, verifySession } from './lib/cookie-session'
import { verifyTurnstile } from './lib/turnstile'
import { categorize } from './lib/mistral'

interface Env {
  MISTRAL_API_KEY: string
  TURNSTILE_SECRET: string
  SESSION_HMAC_SECRET: string
  TURNSTILE_SITE_KEY: string
  AI_RATE_LIMIT: RateLimit
}

const SESSION_COOKIE = 'lazy_list_session'
const SESSION_MAX_AGE_SEC = 86400
const MAX_INPUT_CHARS = 10_000

const app = new Hono<{ Bindings: Env }>()

app.use(secureHeaders({
  contentSecurityPolicy: {
    defaultSrc:  ["'self'"],
    scriptSrc:   ["'self'", "'unsafe-inline'", "https://cdn.tailwindcss.com", "https://unpkg.com", "https://esm.sh", "https://challenges.cloudflare.com"],
    styleSrc:    ["'self'", "'unsafe-inline'"],
    connectSrc:  ["'self'"],
    imgSrc:      ["'self'", "data:"],
    frameSrc:    ["https://challenges.cloudflare.com"],
    workerSrc:   ["'self'"],
    manifestSrc: ["'self'"],
  },
}))

app.use('*', async (c, next) => {
  await next()
  c.header('X-Robots-Tag', 'noindex, nofollow, noarchive')
})

app.post('/api/session', async (c) => {
  if (!isSameOrigin(c.req.raw)) {
    return c.json({ code: 'forbidden' }, 403)
  }

  const body = await c.req.json<{ turnstileToken?: string }>().catch(() => ({}))
  if (!("turnstileToken" in body && body.turnstileToken)) {
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

app.post('/api/categorize', async (c) => {
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
    return c.json({ code: 'upstream-error' }, 502)
  }
  return c.json({ categories: result.categories })
})

app.get(
  '/',
  jsxRenderer(),
  (c) => c.render(
    <Layout turnstileSiteKey={c.env.TURNSTILE_SITE_KEY}>
      <InputView />
    </Layout>,
  ),
)

app.get('/views/input',   (c) => c.html(<InputView />))
app.get('/views/list',    (c) => c.html(<ListView />))
app.get('/views/history', (c) => c.html(<HistoryView />))

app.get('/privacy', (c) => c.html(<PrivacyView />))

export default app
