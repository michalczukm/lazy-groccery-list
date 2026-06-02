import { describe, it, expect, vi } from 'vitest'
import { verifyTurnstile } from './turnstile'

const SECRET = 'turnstile-secret'

describe('verifyTurnstile', () => {
  it('returns true when Cloudflare verifies token', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ success: true }), { status: 200 }),
    )
    const result = await verifyTurnstile('tok', '203.0.113.5', SECRET, fetchMock)
    expect(result).toEqual({ success: true })

    expect(fetchMock).toHaveBeenCalledOnce()
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('https://challenges.cloudflare.com/turnstile/v0/siteverify')
    expect(init.method).toBe('POST')
    const body = JSON.parse(init.body as string)
    expect(body).toEqual({ secret: SECRET, response: 'tok', remoteip: '203.0.113.5' })
  })

  it('returns false when Cloudflare rejects token', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ success: false, 'error-codes': ['invalid-input-response'] }), { status: 200 }),
    )
    const result = await verifyTurnstile('bad', null, SECRET, fetchMock)
    expect(result).toEqual({ success: false })
  })

  it('returns false when network throws', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error('boom'))
    const result = await verifyTurnstile('tok', null, SECRET, fetchMock)
    expect(result).toEqual({ success: false })
  })

  it('returns false when Cloudflare responds non-200', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('nope', { status: 500 }))
    const result = await verifyTurnstile('tok', null, SECRET, fetchMock)
    expect(result).toEqual({ success: false })
  })

  it('omits remoteip when ip is null', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ success: true }), { status: 200 }),
    )
    await verifyTurnstile('tok', null, SECRET, fetchMock)
    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string)
    expect(body).toEqual({ secret: SECRET, response: 'tok' })
  })
})
