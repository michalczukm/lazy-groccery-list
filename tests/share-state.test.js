import { describe, it, expect } from 'vitest'
import { encodeState, decodeState } from '../public/share-state.js'

const sample = {
  id: 9999,
  title: 'Zakupy test',
  date: 1000000000,
  saved: true,
  model: 'mistral-small-latest',
  categories: [
    {
      name: 'nabiał',
      collapsed: false,
      manualExpand: false,
      items: [
        { name: 'Mleko 1L', checked: false },
        { name: 'Jogurt', checked: true },
      ],
    },
    {
      name: 'warzywa',
      collapsed: true,
      manualExpand: true,
      items: [{ name: 'Marchewka', checked: false }],
    },
  ],
}

describe('encodeState / decodeState round-trip', () => {
  it('preserves title, date, and category count', async () => {
    const decoded = await decodeState(await encodeState(sample))
    expect(decoded.title).toBe('Zakupy test')
    expect(decoded.date).toBe(1000000000)
    expect(decoded.categories).toHaveLength(2)
  })

  it('preserves category name and items, strips emoji', async () => {
    const decoded = await decodeState(await encodeState(sample))
    expect(decoded.categories[0].name).toBe('nabiał')
    expect(decoded.categories[0].items).toEqual([
      { name: 'Mleko 1L', checked: false },
      { name: 'Jogurt', checked: true },
    ])
  })

  it('strips id, saved, model from payload', async () => {
    const decoded = await decodeState(await encodeState(sample))
    expect(decoded).not.toHaveProperty('id')
    expect(decoded).not.toHaveProperty('saved')
    expect(decoded).not.toHaveProperty('model')
  })

  it('strips collapsed and manualExpand from categories', async () => {
    const decoded = await decodeState(await encodeState(sample))
    expect(decoded.categories[0]).not.toHaveProperty('collapsed')
    expect(decoded.categories[0]).not.toHaveProperty('manualExpand')
  })

  it('produces URL-safe base64url (only [A-Za-z0-9_-])', async () => {
    const encoded = await encodeState(sample)
    expect(encoded).toMatch(/^[A-Za-z0-9_-]+$/)
  })

  it('handles empty categories array', async () => {
    const decoded = await decodeState(await encodeState({ ...sample, categories: [] }))
    expect(decoded.categories).toEqual([])
  })

  it('handles non-ASCII characters in item names (Polish, emoji)', async () => {
    const list = {
      ...sample,
      categories: [
        { name: 'pieczywo', emoji: '🍞', items: [{ name: 'Chleb żytni', checked: false }] },
      ],
    }
    const decoded = await decodeState(await encodeState(list))
    expect(decoded.categories[0].items[0].name).toBe('Chleb żytni')
  })
})

describe('decodeState error handling', () => {
  it('throws on invalid base64url characters', async () => {
    await expect(decodeState('not!!!valid')).rejects.toThrow('invalid base64url input')
  })

  it('throws when compressed input exceeds 200KB', async () => {
    const raw = new Uint8Array(201 * 1024)
    const chunks = []
    for (let i = 0; i < raw.length; i += 8192) {
      chunks.push(String.fromCharCode(...raw.subarray(i, i + 8192)))
    }
    const oversized = btoa(chunks.join('')).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
    await expect(decodeState(oversized)).rejects.toThrow('input too large')
  })

  it('throws when decompressed payload has no categories array', async () => {
    const stream = new CompressionStream('gzip')
    const writer = stream.writable.getWriter()
    const bufPromise = new Response(stream.readable).arrayBuffer()
    await writer.write(new TextEncoder().encode(JSON.stringify({ title: 'bad', date: 0 })))
    await writer.close()
    const buf = await bufPromise
    const binary = Array.from(new Uint8Array(buf), b => String.fromCharCode(b)).join('')
    const encoded = btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
    await expect(decodeState(encoded)).rejects.toThrow('invalid payload shape')
  })
})
