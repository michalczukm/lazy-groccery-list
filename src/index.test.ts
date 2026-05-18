import { SELF, env } from 'cloudflare:test'
import { describe, it, expect } from 'vitest'

describe('GET /api/invite', () => {
  it('returns 401 with no token', async () => {
    const res = await SELF.fetch('https://example.com/api/invite')
    expect(res.status).toBe(401)
    expect(await res.json()).toEqual({ error: 'Unauthorized' })
  })

  it('returns 401 with wrong token', async () => {
    const res = await SELF.fetch('https://example.com/api/invite?token=wrong-token')
    expect(res.status).toBe(401)
    expect(await res.json()).toEqual({ error: 'Unauthorized' })
  })

  it('returns 200 with Mistral key for valid token', async () => {
    const { INVITE_TOKEN, MISTRAL_API_KEY } = env as { INVITE_TOKEN: string; MISTRAL_API_KEY: string }
    const res = await SELF.fetch(`https://example.com/api/invite?token=${encodeURIComponent(INVITE_TOKEN)}`)
    expect(res.status).toBe(200)
    const body = await res.json() as { key: string }
    expect(body.key).toBe(MISTRAL_API_KEY)
  })
})

describe('View routes', () => {
  it('GET /views/input returns HTML', async () => {
    const res = await SELF.fetch('https://example.com/views/input')
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toContain('text/html')
  })

  it('GET /views/list returns HTML', async () => {
    const res = await SELF.fetch('https://example.com/views/list')
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toContain('text/html')
  })

  it('GET /views/history returns HTML', async () => {
    const res = await SELF.fetch('https://example.com/views/history')
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toContain('text/html')
  })

  it('GET /views/setup returns HTML', async () => {
    const res = await SELF.fetch('https://example.com/views/setup')
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toContain('text/html')
  })
})
