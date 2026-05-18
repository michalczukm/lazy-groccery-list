import { describe, it, expect } from 'vitest'
import { mergeAmendInto } from '../public/merge-amend.js'

const baseList = () => ({
  id: 1,
  title: 'Zakupy test',
  date: 1000,
  saved: true,
  model: 'mistral-small-latest',
  categories: [
    {
      name: 'nabiał',
      emoji: '🥛',
      collapsed: false,
      manualExpand: false,
      items: [
        { name: 'Mleko 1L', checked: false },
        { name: 'Jogurt', checked: true },
      ],
    },
    {
      name: 'warzywa',
      emoji: '🥦',
      collapsed: true,
      manualExpand: false,
      items: [{ name: 'Marchewka', checked: false }],
    },
  ],
})

describe('mergeAmendInto', () => {
  it('appends new items to an existing category', () => {
    const list = baseList()
    const result = mergeAmendInto(list, [
      { name: 'nabiał', emoji: '🥛', items: ['Masło', 'Ser żółty'] },
    ])
    expect(result.added).toBe(2)
    expect(result.skipped).toBe(0)
    const cat = result.categories.find(c => c.name === 'nabiał')
    expect(cat.items.map(i => i.name)).toEqual(['Mleko 1L', 'Jogurt', 'Masło', 'Ser żółty'])
    expect(cat.items.every(i => typeof i.checked === 'boolean')).toBe(true)
  })

  it('skips duplicates within a category (case-insensitive, trimmed)', () => {
    const list = baseList()
    const result = mergeAmendInto(list, [
      { name: 'nabiał', emoji: '🥛', items: ['  mleko 1l ', 'Masło', 'JOGURT'] },
    ])
    expect(result.added).toBe(1)
    expect(result.skipped).toBe(2)
    const cat = result.categories.find(c => c.name === 'nabiał')
    expect(cat.items.map(i => i.name)).toEqual(['Mleko 1L', 'Jogurt', 'Masło'])
  })

  it('auto-uncollapses a category that gains items', () => {
    const list = baseList()
    const result = mergeAmendInto(list, [
      { name: 'warzywa', emoji: '🥦', items: ['Pomidor'] },
    ])
    const cat = result.categories.find(c => c.name === 'warzywa')
    expect(cat.collapsed).toBe(false)
    expect(cat.manualExpand).toBe(false)
  })

  it('leaves collapse state untouched when all new items are duplicates', () => {
    const list = baseList()
    const result = mergeAmendInto(list, [
      { name: 'warzywa', emoji: '🥦', items: ['marchewka'] },
    ])
    expect(result.added).toBe(0)
    expect(result.skipped).toBe(1)
    const cat = result.categories.find(c => c.name === 'warzywa')
    expect(cat.collapsed).toBe(true)
  })

  it('appends a brand new category at the end', () => {
    const list = baseList()
    const result = mergeAmendInto(list, [
      { name: 'owoce', emoji: '🍎', items: ['Jabłko', 'Banan'] },
    ])
    expect(result.added).toBe(2)
    expect(result.categories[result.categories.length - 1]).toMatchObject({
      name: 'owoce',
      emoji: '🍎',
      collapsed: false,
      manualExpand: false,
    })
    expect(result.categories[result.categories.length - 1].items.map(i => i.name))
      .toEqual(['Jabłko', 'Banan'])
  })

  it('returns 0/0 when newCategories is empty', () => {
    const list = baseList()
    const result = mergeAmendInto(list, [])
    expect(result.added).toBe(0)
    expect(result.skipped).toBe(0)
    expect(result.categories).toHaveLength(2)
  })

  it('does not mutate the input list', () => {
    const list = baseList()
    const snapshot = JSON.parse(JSON.stringify(list))
    mergeAmendInto(list, [
      { name: 'nabiał', emoji: '🥛', items: ['Masło'] },
      { name: 'owoce', emoji: '🍎', items: ['Jabłko'] },
    ])
    expect(list).toEqual(snapshot)
  })

  it('matches category names case-insensitively', () => {
    const list = baseList()
    const result = mergeAmendInto(list, [
      { name: 'Nabiał', emoji: '🥛', items: ['Masło'] },
    ])
    expect(result.categories.filter(c => c.name.toLowerCase() === 'nabiał')).toHaveLength(1)
    expect(result.added).toBe(1)
  })

  it('skips categories returned with no items', () => {
    const list = baseList()
    const result = mergeAmendInto(list, [
      { name: 'owoce', emoji: '🍎', items: [] },
    ])
    expect(result.added).toBe(0)
    expect(result.categories).toHaveLength(2)
  })
})
