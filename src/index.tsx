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

app.get('/api/invite', async (c) => {
  const token = c.req.query('token')

  const timingSafeEqual = (a: string, b: string): boolean => {
    const ea = new TextEncoder().encode(a)
    const eb = new TextEncoder().encode(b)
    if (ea.length !== eb.length) return false
    let diff = 0
    for (let i = 0; i < ea.length; i++) diff |= ea[i] ^ eb[i]
    return diff === 0
  }

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
