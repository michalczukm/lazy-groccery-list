import { SELF } from 'cloudflare:test'
import { describe, it, expect } from 'vitest'

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
