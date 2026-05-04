import { Hono } from 'hono'
import { jsxRenderer } from 'hono/jsx-renderer'
import { Layout } from './layout'
import { InputView } from './views/input'
import { ListView } from './views/list'
import { HistoryView } from './views/history'
import { SetupView } from './views/setup'

const app = new Hono()

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
