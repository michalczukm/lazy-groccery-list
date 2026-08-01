import { SELF, env, createExecutionContext, waitOnExecutionContext } from 'cloudflare:test'
import { describe, it, expect, vi, afterEach } from 'vitest'
import worker from './index'
import { signSession } from './lib/cookie-session'

describe('POST /api/session', () => {
  it('returns 403 when Origin does not match request URL origin', async () => {
    const res = await SELF.fetch('https://example.com/api/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: 'https://evil.com' },
      body: JSON.stringify({ turnstileToken: 'dummy' }),
    })
    expect(res.status).toBe(403)
    expect(await res.json()).toEqual({ code: 'forbidden' })
  })

  it('returns 400 when turnstileToken is missing', async () => {
    const res = await SELF.fetch('https://example.com/api/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: 'https://example.com' },
      body: JSON.stringify({}),
    })
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ code: 'missing-token' })
  })
})

describe('POST /api/categorize', () => {
  it('returns 403 when Origin does not match request URL origin', async () => {
    const res = await SELF.fetch('https://example.com/api/categorize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: 'https://evil.com' },
      body: JSON.stringify({ text: 'mleko, chleb' }),
    })
    expect(res.status).toBe(403)
    expect(await res.json()).toEqual({ code: 'forbidden' })
  })

  it('returns 401 when session cookie is missing', async () => {
    const res = await SELF.fetch('https://example.com/api/categorize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: 'https://example.com' },
      body: JSON.stringify({ text: 'mleko, chleb' }),
    })
    expect(res.status).toBe(401)
    expect(await res.json()).toEqual({ code: 'captcha-required' })
  })

  it('returns 401 when session cookie is invalid', async () => {
    const res = await SELF.fetch('https://example.com/api/categorize', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: 'https://example.com',
        Cookie: 'lazy_list_session=invalid-cookie-value',
      },
      body: JSON.stringify({ text: 'mleko, chleb' }),
    })
    expect(res.status).toBe(401)
    expect(await res.json()).toEqual({ code: 'captcha-required' })
  })

  describe('upstream failure', () => {
    afterEach(() => {
      vi.restoreAllMocks()
    })

    it('fires worker_request_error to PostHog when Mistral upstream fails', async () => {
      // Drive a real request through the full /api/categorize handler (session cookie,
      // gating, categorize() call) so this exercises the live server-capture wiring —
      // fireAndForget, distinctIdFrom reading the real header, and captureServer being
      // reached at all — rather than re-testing captureServer in isolation.
      const cookie = await signSession(env.SESSION_HMAC_SECRET, Math.floor(Date.now() / 1000))

      const posthogCalls: Array<{ url: string; body: unknown }> = []

      const originalFetch = globalThis.fetch
      vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
        const url = typeof input === 'string' ? input : ((input as Request).url ?? String(input))

        if (url.includes('api.mistral.ai')) {
          // Simulate the AI upstream failing, driving categorize() into its 'upstream' branch.
          return new Response('upstream down', { status: 500 })
        }

        if (url.endsWith('/i/v0/e')) {
          posthogCalls.push({ url, body: JSON.parse(String(init?.body)) })
          return new Response(null, { status: 200 })
        }

        // Anything else is unexpected in this test — fall through to the real fetch
        // rather than silently swallowing an unhandled request.
        return originalFetch(input as RequestInfo, init)
      })

      const request = new Request('https://example.com/api/categorize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Origin: 'https://example.com',
          Cookie: `lazy_list_session=${cookie}`,
          'X-POSTHOG-DISTINCT-ID': 'test-distinct-id',
        },
        body: JSON.stringify({ text: 'mleko, chleb' }),
      })

      const ctx = createExecutionContext()
      const res = await worker.fetch(request, env, ctx)
      expect(res.status).toBe(502)
      expect(await res.json()).toEqual({ code: 'upstream-error' })

      // fireAndForget hands the capture off via c.executionCtx.waitUntil — wait for it.
      await waitOnExecutionContext(ctx)

      expect(posthogCalls).toHaveLength(1)
      expect(posthogCalls[0].url).toContain('/i/v0/e')
      expect(posthogCalls[0].body).toMatchObject({
        event: 'worker_request_error',
        distinct_id: 'test-distinct-id',
        properties: {
          route: '/api/categorize',
          status: 502,
          code: 'upstream-error',
          reason: 'upstream',
        },
      })
    })
  })
})

describe('View routes', () => {
  it('returns HTML when GET /views/input', async () => {
    const res = await SELF.fetch('https://example.com/views/input')
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toContain('text/html')
  })

  it('returns HTML when GET /views/list', async () => {
    const res = await SELF.fetch('https://example.com/views/list')
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toContain('text/html')
  })

  it('returns HTML when GET /views/history', async () => {
    const res = await SELF.fetch('https://example.com/views/history')
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toContain('text/html')
  })
})

describe('GET /privacy', () => {
  it('returns an HTML privacy page', async () => {
    const res = await SELF.fetch('https://example.com/privacy')
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toContain('text/html')
  })

  it('mentions the Cloudflare Turnstile privacy policy and key topics', async () => {
    const res = await SELF.fetch('https://example.com/privacy')
    const html = await res.text()
    expect(html).toContain('https://www.cloudflare.com/en-gb/turnstile-privacy-policy/')
    expect(html).toContain('Turnstile')
    expect(html).toContain('Mistral')
    expect(html).toContain('Cookies')
    expect(html).toContain('rozmiar')
  })
})

describe('GET / importmap', () => {
  it('pins @preact/signals to the app preact instance via external=preact', async () => {
    // Regression: esm.sh otherwise resolves its own preact@10.x for signals, giving
    // a second preact instance whose patched `options` the app never renders through,
    // so signal-driven components never re-render (list stale after add/toggle).
    const res = await SELF.fetch('https://example.com/')
    const html = await res.text()
    expect(html).toContain('@preact/signals@1.3.4?external=preact')
  })
})

describe('GET / font size toggle', () => {
  it('renders the font-size toggle button in the header', async () => {
    const res = await SELF.fetch('https://example.com/')
    const html = await res.text()
    expect(html).toContain('id="font-size-toggle"')
    expect(html).toContain('App.toggleFontSize()')
  })

  it('ships the font-size antiflash script (no FOUC)', async () => {
    const res = await SELF.fetch('https://example.com/')
    const html = await res.text()
    // antiflash reads localStorage.fontSize and adds html.large before paint
    expect(html).toContain("localStorage.getItem('fontSize')")
    expect(html).toContain("classList.add('large')")
  })

  it('defines the html.large zoom rule', async () => {
    const res = await SELF.fetch('https://example.com/')
    const html = await res.text()
    expect(html).toContain('html.large')
    expect(html).toContain('zoom: 1.15')
  })
})

describe('GET / analytics injection', () => {
  it('injects the posthog key and analytics module when configured', async () => {
    const res = await SELF.fetch('https://example.com/')
    const html = await res.text()
    expect(html).toContain('window.__POSTHOG_KEY__ = "phc_test"')
    expect(html).toContain('src="/analytics.js"')
  })

  it('keeps the CSP free of third-party analytics hosts', async () => {
    const res = await SELF.fetch('https://example.com/')
    const csp = res.headers.get('content-security-policy') ?? ''
    expect(csp).not.toContain('posthog')
  })
})
