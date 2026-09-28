import { describe, expect, it, vi } from 'vitest'
import {
  buildTitleSuggestionPayload,
  normalizeSuggestedTitle,
  requestTitleSuggestion,
} from '../public/list-title.js'

const list = {
  id: 1,
  title: 'Zakupy 28 wrz',
  date: 1,
  saved: true,
  categories: [
    {
      name: 'nabiał',
      collapsed: false,
      manualExpand: false,
      items: [
        { name: 'mleko', checked: false },
        { name: 'jogurt', checked: true },
      ],
    },
  ],
}

describe('list title suggestions', () => {
  it('builds the minimal AI payload from the current list', () => {
    expect(buildTitleSuggestionPayload(list)).toEqual({
      currentTitle: 'Zakupy 28 wrz',
      categories: [{ name: 'nabiał', items: ['mleko', 'jogurt'] }],
    })
  })

  it('normalizes quoted and overlong suggestions', () => {
    expect(normalizeSuggestedTitle('  "Kolacja i śniadanie"  ')).toBe('Kolacja i śniadanie')
    expect(normalizeSuggestedTitle('x'.repeat(90))).toHaveLength(60)
    expect(normalizeSuggestedTitle('')).toBeNull()
  })

  it('requests a suggestion and returns null on failed responses', async () => {
    const fetchOk = vi.fn().mockResolvedValue(Response.json({ title: 'Szybkie zakupy' }))
    await expect(requestTitleSuggestion(list, fetchOk)).resolves.toBe('Szybkie zakupy')
    expect(fetchOk).toHaveBeenCalledWith('/api/suggest-title', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(buildTitleSuggestionPayload(list)),
    })

    const fetchFail = vi.fn().mockResolvedValue(new Response(null, { status: 502 }))
    await expect(requestTitleSuggestion(list, fetchFail)).resolves.toBeNull()
  })
})
