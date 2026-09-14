import { DurableObject } from 'cloudflare:workers'

const ROOM_RE = /^[A-Za-z0-9_-]{8,80}$/
const LATEST_STATE_KEY = 'latest-list-state'

export const isValidSyncRoom = (room: string): boolean => ROOM_RE.test(room)

type ListSyncMessage = {
  type: 'list-state'
  clientId: string
  shareId: string
  updatedAt: number
  title: string
  date: number
  categories: Array<{ name: string; items: Array<{ name: string; checked: boolean }> }>
}

function isSyncCategory(value: unknown): value is ListSyncMessage['categories'][number] {
  if (!value || typeof value !== 'object') return false
  const category = value as Record<string, unknown>
  return (
    typeof category.name === 'string' &&
    Array.isArray(category.items) &&
    category.items.every(item => {
      if (!item || typeof item !== 'object') return false
      const entry = item as Record<string, unknown>
      return typeof entry.name === 'string' && typeof entry.checked === 'boolean'
    })
  )
}

function isListSyncMessage(value: unknown): value is ListSyncMessage {
  if (!value || typeof value !== 'object') return false
  const msg = value as Record<string, unknown>
  return (
    msg.type === 'list-state' &&
    typeof msg.clientId === 'string' &&
    isValidSyncRoom(String(msg.shareId)) &&
    typeof msg.updatedAt === 'number' &&
    Number.isFinite(msg.updatedAt) &&
    typeof msg.title === 'string' &&
    typeof msg.date === 'number' &&
    Number.isFinite(msg.date) &&
    Array.isArray(msg.categories) &&
    msg.categories.every(isSyncCategory)
  )
}

function compareSyncMessages(a: ListSyncMessage, b: ListSyncMessage): number {
  if (a.updatedAt !== b.updatedAt) return a.updatedAt - b.updatedAt
  if (a.clientId === b.clientId) return 0
  return a.clientId < b.clientId ? -1 : 1
}

export async function loadLatestListState(storage: {
  get<T = unknown>(key: string): Promise<T | undefined>
}): Promise<ListSyncMessage | null> {
  const latest = await storage.get<unknown>(LATEST_STATE_KEY)
  return isListSyncMessage(latest) ? latest : null
}

export class ListSyncRoom extends DurableObject {
  private sessions = new Set<WebSocket>()
  private latest: ListSyncMessage | null = null
  private latestLoaded = false

  async fetch(request: Request): Promise<Response> {
    if (request.headers.get('Upgrade') !== 'websocket') {
      return Response.json({ code: 'websocket-required' }, { status: 426 })
    }
    const room = new URL(request.url).pathname.split('/').pop() ?? ''

    await this.loadLatestState()

    const pair = new WebSocketPair()
    const [client, server] = Object.values(pair)
    this.sessions.add(server)
    server.accept()
    if (this.latest) server.send(JSON.stringify(this.latest))
    server.addEventListener('message', event => {
      if (typeof event.data !== 'string') return
      void this.handleMessage(server, room, event.data)
    })
    const close = () => {
      this.sessions.delete(server)
    }
    server.addEventListener('close', close)
    server.addEventListener('error', close)

    return new Response(null, { status: 101, webSocket: client })
  }

  private async loadLatestState(): Promise<void> {
    if (this.latestLoaded) return
    this.latest = await loadLatestListState(this.ctx.storage)
    this.latestLoaded = true
  }

  private parseMessage(data: string): ListSyncMessage | null {
    try {
      const parsed: unknown = JSON.parse(data)
      return isListSyncMessage(parsed) ? parsed : null
    } catch {
      return null
    }
  }

  private async handleMessage(server: WebSocket, room: string, raw: string): Promise<void> {
    const data = this.parseMessage(raw)
    if (!data) return
    if (data.shareId !== room) return
    if (this.latest && compareSyncMessages(data, this.latest) <= 0) return
    this.latest = data
    await this.ctx.storage.put(LATEST_STATE_KEY, data)
    const payload = JSON.stringify(data)
    for (const session of this.sessions) {
      if (session !== server && session.readyState === WebSocket.OPEN) {
        session.send(payload)
      }
    }
  }
}
