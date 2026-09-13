import { DurableObject } from 'cloudflare:workers'

const ROOM_RE = /^[A-Za-z0-9_-]{8,80}$/

export const isValidSyncRoom = (room: string): boolean => ROOM_RE.test(room)

export class ListSyncRoom extends DurableObject {
  private sessions = new Set<WebSocket>()

  fetch(request: Request): Response {
    if (request.headers.get('Upgrade') !== 'websocket') {
      return Response.json({ code: 'websocket-required' }, { status: 426 })
    }

    const pair = new WebSocketPair()
    const [client, server] = Object.values(pair)
    this.sessions.add(server)
    server.accept()
    server.addEventListener('message', event => {
      if (typeof event.data !== 'string') return
      for (const session of this.sessions) {
        if (session !== server && session.readyState === WebSocket.OPEN) {
          session.send(event.data)
        }
      }
    })
    const close = () => {
      this.sessions.delete(server)
    }
    server.addEventListener('close', close)
    server.addEventListener('error', close)

    return new Response(null, { status: 101, webSocket: client })
  }
}
