import { SELF } from 'cloudflare:test'
import { describe, it, expect } from 'vitest'

async function connect(room = 'room_12345678'): Promise<WebSocket> {
  const response = await SELF.fetch(`https://example.com/api/list-sync/${room}`, {
    headers: { Upgrade: 'websocket' },
  })
  const socket = response.webSocket
  if (!socket) throw new Error('expected websocket response')
  socket.accept()
  return socket
}

function message(room: string, updatedAt: number, title: string) {
  return JSON.stringify({
    type: 'list-state',
    clientId: `client-${updatedAt}`,
    shareId: room,
    updatedAt,
    title,
    date: updatedAt,
    categories: [{ name: 'nabiał', items: [{ name: title, checked: false }] }],
  })
}

function nextMessage(socket: WebSocket): Promise<string> {
  return new Promise(resolve => {
    socket.addEventListener(
      'message',
      event => {
        resolve(String(event.data))
      },
      { once: true },
    )
  })
}

function noMessage(socket: WebSocket): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, 50)
    socket.addEventListener(
      'message',
      event => {
        clearTimeout(timer)
        reject(new Error(`unexpected message: ${String(event.data)}`))
      },
      { once: true },
    )
  })
}

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

  it('sends the latest room state to clients that connect later', async () => {
    const room = 'room_state_12345678'
    const first = await connect(room)
    first.send(message(room, 2000, 'Fresh room state'))

    const second = await connect(room)

    expect(await nextMessage(second)).toBe(message(room, 2000, 'Fresh room state'))
  })

  it('does not rebroadcast an older state over newer room state', async () => {
    const room = 'room_reject_12345678'
    const first = await connect(room)
    const second = await connect(room)
    first.send(message(room, 2000, 'Fresh room state'))
    expect(await nextMessage(second)).toBe(message(room, 2000, 'Fresh room state'))

    first.send(message(room, 1000, 'Stale URL state'))

    await expect(noMessage(second)).resolves.toBeUndefined()
  })

  it('ignores messages for a different room ID', async () => {
    const first = await connect('room_match_12345678')
    const second = await connect('room_match_12345678')

    first.send(message('other_room_12345678', 2000, 'Wrong room'))

    await expect(noMessage(second)).resolves.toBeUndefined()
  })
})
