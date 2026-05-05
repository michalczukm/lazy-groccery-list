import { Hono } from 'hono'
import { jsxRenderer } from 'hono/jsx-renderer'
import { secureHeaders } from 'hono/secure-headers'
import { Layout } from './layout'
import { InputView } from './views/input'
import { ListView } from './views/list'
import { HistoryView } from './views/history'
import { SetupView } from './views/setup'

const app = new Hono()

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
