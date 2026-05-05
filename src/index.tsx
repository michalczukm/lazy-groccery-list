import { Hono } from 'hono'
import { jsxRenderer } from 'hono/jsx-renderer'
import { secureHeaders } from 'hono/secure-headers'
import { Layout } from './layout'
import { InputView } from './views/input'
import { ListView } from './views/list'
import { HistoryView } from './views/history'
import { SetupView } from './views/setup'

interface Env {
  INVITE_TOKEN: string
  MISTRAL_API_KEY: string
  INVITE_KV: KVNamespace
}

const timingSafeEqual = (value: string, reference: string) => {
  const encoder = new TextEncoder();

  const valueEncoded = encoder.encode(value);
  const referenceEndoded = encoder.encode(reference);
  // Do not return early when lengths differ — that leaks the secret's
  // length through timing.  Instead, always perform a constant-time
  // comparison: when the lengths match compare directly; otherwise
  // compare the user input against itself (always true) and negate.
  const lengthsMatch = valueEncoded.byteLength === referenceEndoded.byteLength;

  return lengthsMatch
    ? crypto.subtle.timingSafeEqual(valueEncoded, referenceEndoded)
    : !crypto.subtle.timingSafeEqual(valueEncoded, valueEncoded);
}

const app = new Hono<{ Bindings: Env }>()

app.use(secureHeaders({
  contentSecurityPolicy: {
    defaultSrc:  ["'self'"],
    scriptSrc:   ["'self'", "'unsafe-inline'", "https://cdn.tailwindcss.com", "https://unpkg.com", "https://esm.sh"],
    styleSrc:    ["'self'", "'unsafe-inline'"],
    connectSrc:  ["'self'", "https://api.mistral.ai"],
    imgSrc:      ["'self'", "data:"],
    workerSrc:   ["'self'"],
    manifestSrc: ["'self'"],
  },
}))

/**
 * Hemingway:
 * - deploy new version to Clouflare Workers
 * - update the invite token in the KV store
 * - update the Mistral API key in the KV store
 * - update the invite token in the .env file
 * - check if KV is updated (counter) --> also, document that there might be race condition while saving to KV, but it is negligible for this scale
 */
app.get('/api/invite', async (c) => {
  const token = c.req.query('token')
  console.log("c.env.INVITE_TOKEN", c.env.INVITE_TOKEN, token)
  if (!token || !timingSafeEqual(token, c.env.INVITE_TOKEN)) {
    return c.json({ error: 'Unauthorized' }, 401)
  }

  const countStr = await c.env.INVITE_KV.get('invite:usage')
  const count = (parseInt(countStr ?? '0', 10) || 0) + 1
  await c.env.INVITE_KV.put('invite:usage', String(count))

  return c.json({ key: c.env.MISTRAL_API_KEY })
})

app.get(
  '/',
  jsxRenderer(({ children }) => <Layout>{children}</Layout>),
  (c) => c.render(<InputView />)
)

app.get('/views/input',   (c) => c.html(<InputView />))
app.get('/views/list',    (c) => c.html(<ListView />))
app.get('/views/history', (c) => c.html(<HistoryView />))
app.get('/views/setup',   (c) => c.html(<SetupView />))

export default app
