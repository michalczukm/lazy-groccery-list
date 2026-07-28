import { describe, it, expect } from 'vitest'
import { resolveUpstream, proxyPosthog, POSTHOG_ASSET_HOST, POSTHOG_INGEST_HOST } from './posthog'

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
})
