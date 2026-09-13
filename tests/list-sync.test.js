import { describe, it, expect, vi } from 'vitest'
import {
  createShareId,
  isListSyncMessage,
  listToSyncMessage,
  sanitizeShareId,
  syncMessageToList,
} from '../public/list-sync.js'

const list = {
  id: 123,
  title: 'Zakupy test',
  date: 1000,
  saved: true,
  shareId: 'room_abc',
  shareUpdatedAt: 2000,
  categories: [
    {
      name: 'nabiał',
      collapsed: true,
      manualExpand: true,
      items: [{ name: 'Mleko', checked: false }],
    },
  ],
}

describe('share room IDs', () => {
  it('accepts only URL-safe share IDs', () => {
    expect(sanitizeShareId('aB-123_zyx')).toBe('aB-123_zyx')
    expect(sanitizeShareId('../secret')).toBeNull()
    expect(sanitizeShareId('short')).toBeNull()
    expect(sanitizeShareId('x'.repeat(81))).toBeNull()
  })

  it('creates URL-safe random IDs', () => {
    vi.spyOn(crypto, 'getRandomValues').mockImplementation(bytes => {
      bytes.fill(255)
      return bytes
    })

    expect(createShareId()).toMatch(/^[A-Za-z0-9_-]{32}$/)
  })
})

describe('list sync messages', () => {
  it('serializes a list without UI-only category state', () => {
    const message = listToSyncMessage(list, 'client-a')

    expect(message).toEqual({
      type: 'list-state',
      clientId: 'client-a',
      shareId: 'room_abc',
      updatedAt: 2000,
      title: 'Zakupy test',
      date: 1000,
      categories: [
        {
          name: 'nabiał',
          items: [{ name: 'Mleko', checked: false }],
        },
      ],
    })
  })

  it('validates inbound messages before applying them', () => {
    expect(isListSyncMessage(listToSyncMessage(list, 'client-a'))).toBe(true)
    expect(isListSyncMessage({ type: 'list-state', categories: 'bad' })).toBe(false)
    expect(
      isListSyncMessage({
        ...listToSyncMessage(list, 'client-a'),
        categories: [{ name: 'nabiał', items: [{ name: 'Mleko' }] }],
      }),
    ).toBe(false)
  })

  it('applies a newer inbound message to the local persisted list shape', () => {
    const message = listToSyncMessage(list, 'client-a')
    const synced = syncMessageToList(message, {
      id: 999,
      title: 'Old',
      date: 1,
      saved: true,
      shareId: 'room_abc',
      shareUpdatedAt: 1,
      categories: [],
    })

    expect(synced).toMatchObject({
      id: 999,
      title: 'Zakupy test',
      date: 1000,
      saved: true,
      shareId: 'room_abc',
      shareUpdatedAt: 2000,
    })
    expect(synced.categories).toEqual([
      {
        name: 'nabiał',
        collapsed: false,
        manualExpand: false,
        items: [{ name: 'Mleko', checked: false }],
      },
    ])
  })
})
