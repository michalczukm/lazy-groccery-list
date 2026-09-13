import { SELF } from 'cloudflare:test'
import { describe, it, expect } from 'vitest'

describe('GET /api/list-sync/:room', () => {
  it('rejects requests that are not WebSocket upgrades', async () => {
    const res = await SELF.fetch('https://example.com/api/list-sync/room_12345678')

    expect(res.status).toBe(426)
    expect(await res.json()).toEqual({ code: 'websocket-required' })
  })

  it('rejects invalid room IDs before reaching the Durable Object', async () => {
    const res = await SELF.fetch('https://example.com/api/list-sync/not.valid', {
      headers: { Upgrade: 'websocket' },
    })

    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ code: 'invalid-room' })
  })
})
