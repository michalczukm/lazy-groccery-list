import { describe, it, expect } from 'vitest'
import {
  resolveUpstream,
  proxyPosthog,
  captureServer,
  distinctIdFrom,
  POSTHOG_ASSET_HOST,
  POSTHOG_INGEST_HOST,
} from './posthog'

describe('resolveUpstream', () => {
  it('routes /static/ paths to the asset host', () => {
    expect(resolveUpstream('/basket/static/array.js', '', POSTHOG_INGEST_HOST)).toBe(
      `${POSTHOG_ASSET_HOST}/static/array.js`,
    )
  })

  it('routes /array/ paths to the asset host', () => {
    expect(resolveUpstream('/basket/array/abc/config.js', '', POSTHOG_INGEST_HOST)).toBe(
      `${POSTHOG_ASSET_HOST}/array/abc/config.js`,
    )
  })

  it('routes every other path to the ingestion host', () => {
    expect(resolveUpstream('/basket/e/', '', POSTHOG_INGEST_HOST)).toBe(`${POSTHOG_INGEST_HOST}/e/`)
  })

  it('preserves the query string', () => {
    expect(resolveUpstream('/basket/e/', '?ver=1.2', POSTHOG_INGEST_HOST)).toBe(
      `${POSTHOG_INGEST_HOST}/e/?ver=1.2`,
    )
  })

  it('maps the bare prefix to root', () => {
    expect(resolveUpstream('/basket', '', POSTHOG_INGEST_HOST)).toBe(`${POSTHOG_INGEST_HOST}/`)
  })

  it('honours a custom ingestion host', () => {
    expect(resolveUpstream('/basket/e/', '', 'https://ph.example.com')).toBe(
      'https://ph.example.com/e/',
    )
  })
})

describe('proxyPosthog', () => {
  it('returns 404 when no key is configured', async () => {
    const res = await proxyPosthog(new Request('https://app.test/basket/e/'), {})
    expect(res.status).toBe(404)
  })

  it('forwards to the resolved upstream URL', async () => {
    let seen: Request | undefined
    const fetchImpl = (async (input: Request) => {
      seen = input as Request
      return new Response('ok')
    }) as unknown as typeof fetch

    const res = await proxyPosthog(
      new Request('https://app.test/basket/e/', { method: 'POST', body: 'payload' }),
      { POSTHOG_KEY: 'phc_test' },
      fetchImpl,
    )

    expect(res.status).toBe(200)
    expect(seen?.url).toBe(`${POSTHOG_INGEST_HOST}/e/`)
    expect(seen?.method).toBe('POST')
  })

  it('never forwards the session cookie upstream', async () => {
    let seen: Request | undefined
    const fetchImpl = (async (input: Request) => {
      seen = input as Request
      return new Response('ok')
    }) as unknown as typeof fetch

    await proxyPosthog(
      new Request('https://app.test/basket/e/', {
        method: 'POST',
        headers: { cookie: 'lazy_list_session=secret' },
        body: 'payload',
      }),
      { POSTHOG_KEY: 'phc_test' },
      fetchImpl,
    )

    expect(seen?.headers.get('cookie')).toBeNull()
  })

  it('never forwards client IP headers upstream', async () => {
    let seen: Request | undefined
    const fetchImpl = (async (input: Request) => {
      seen = input as Request
      return new Response('ok')
    }) as unknown as typeof fetch

    await proxyPosthog(
      new Request('https://app.test/basket/e/', {
        method: 'POST',
        headers: {
          'cf-connecting-ip': '1.2.3.4',
          'x-forwarded-for': '1.2.3.4',
          'x-real-ip': '1.2.3.4',
        },
        body: 'payload',
      }),
      { POSTHOG_KEY: 'phc_test' },
      fetchImpl,
    )

    expect(seen?.headers.get('cf-connecting-ip')).toBeNull()
    expect(seen?.headers.get('x-forwarded-for')).toBeNull()
    expect(seen?.headers.get('x-real-ip')).toBeNull()
  })

  it('never forwards the Referer header upstream', async () => {
    // A share link keeps its payload in the query string (?state=...). Referer would
    // carry that whole URL to a third party if it were ever forwarded.
    let seen: Request | undefined
    const fetchImpl = (async (input: Request) => {
      seen = input as Request
      return new Response('ok')
    }) as unknown as typeof fetch

    await proxyPosthog(
      new Request('https://app.test/basket/e/', {
        method: 'POST',
        headers: { referer: 'https://app.test/?state=H4sIAAAA-secret-payload' },
        body: 'payload',
      }),
      { POSTHOG_KEY: 'phc_test' },
      fetchImpl,
    )

    expect(seen?.headers.get('referer')).toBeNull()
  })
})

describe('distinctIdFrom', () => {
  it('reads the posthog distinct id header set by tracing_headers', () => {
    const req = new Request('https://app.test/api/categorize', {
      headers: { 'X-POSTHOG-DISTINCT-ID': 'abc-123' },
    })
    expect(distinctIdFrom(req)).toBe('abc-123')
  })

  it('falls back to an anonymous id when the header is absent', () => {
    expect(distinctIdFrom(new Request('https://app.test/api/categorize'))).toBe('anonymous-server')
  })

  it('passes through a valid UUID-shaped id unchanged', () => {
    const id = '018f4c2e-6b7a-7c3d-9e1a-0123456789ab'
    const req = new Request('https://app.test/api/categorize', {
      headers: { 'X-POSTHOG-DISTINCT-ID': id },
    })
    expect(distinctIdFrom(req)).toBe(id)
  })

  it('falls back to an anonymous id when the header is 65 characters', () => {
    const req = new Request('https://app.test/api/categorize', {
      headers: { 'X-POSTHOG-DISTINCT-ID': 'a'.repeat(65) },
    })
    expect(distinctIdFrom(req)).toBe('anonymous-server')
  })

  it('accepts a 64 character header', () => {
    const id = 'a'.repeat(64)
    const req = new Request('https://app.test/api/categorize', {
      headers: { 'X-POSTHOG-DISTINCT-ID': id },
    })
    expect(distinctIdFrom(req)).toBe(id)
  })

  it('falls back to an anonymous id when the header contains disallowed characters', () => {
    for (const value of ['abc def', '<script>']) {
      const req = new Request('https://app.test/api/categorize', {
        headers: { 'X-POSTHOG-DISTINCT-ID': value },
      })
      expect(distinctIdFrom(req)).toBe('anonymous-server')
    }
  })

  it('falls back to an anonymous id when the header is empty', () => {
    const req = new Request('https://app.test/api/categorize', {
      headers: { 'X-POSTHOG-DISTINCT-ID': '' },
    })
    expect(distinctIdFrom(req)).toBe('anonymous-server')
  })
})

describe('captureServer', () => {
  it('posts the documented event body to /i/v0/e', async () => {
    let url: string | undefined
    let body: Record<string, unknown> | undefined
    const fetchImpl = (async (input: string, init?: RequestInit) => {
      url = input
      body = JSON.parse(init?.body as string)
      return new Response(null, { status: 200 })
    }) as unknown as typeof fetch

    await captureServer(
      { POSTHOG_KEY: 'phc_test' },
      { event: 'worker_request_error', distinctId: 'abc', properties: { status: 502 } },
      fetchImpl,
    )

    expect(url).toBe(`${POSTHOG_INGEST_HOST}/i/v0/e`)
    expect(body?.api_key).toBe('phc_test')
    expect(body?.event).toBe('worker_request_error')
    expect(body?.distinct_id).toBe('abc')
    expect(body?.properties).toMatchObject({ status: 502, $process_person_profile: false })
    expect(typeof body?.timestamp).toBe('string')
  })

  it('uses a custom host when configured', async () => {
    let url: string | undefined
    const fetchImpl = (async (input: string) => {
      url = input
      return new Response(null, { status: 200 })
    }) as unknown as typeof fetch

    await captureServer(
      { POSTHOG_KEY: 'phc_test', POSTHOG_HOST: 'https://ph.example.com' },
      { event: 'e', distinctId: 'abc' },
      fetchImpl,
    )

    expect(url).toBe('https://ph.example.com/i/v0/e')
  })

  it('no-ops when no key is configured', async () => {
    let called = false
    const fetchImpl = (async () => {
      called = true
      return new Response(null)
    }) as unknown as typeof fetch

    await captureServer({}, { event: 'e', distinctId: 'abc' }, fetchImpl)
    expect(called).toBe(false)
  })

  it('swallows upstream failure and never throws', async () => {
    const fetchImpl = (async () => {
      throw new Error('network down')
    }) as unknown as typeof fetch

    await expect(
      captureServer({ POSTHOG_KEY: 'phc_test' }, { event: 'e', distinctId: 'abc' }, fetchImpl),
    ).resolves.toBeUndefined()
  })
})
