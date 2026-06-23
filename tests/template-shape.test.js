import { describe, it, expect } from 'vitest'
import { listToTemplate, templateToList } from '../public/template-shape.js'

const savedList = () => ({
  id: 111,
  title: 'Zakupy 5 maj',
  date: 111,
  saved: true,
  categories: [
    {
      name: 'nabiał',
      collapsed: true,
      manualExpand: true,
      items: [
        { name: 'Mleko 1L', checked: true },
        { name: 'Jogurt', checked: false },
      ],
    },
    { name: 'pusta', collapsed: false, manualExpand: false, items: [] },
    {
      name: 'owoce',
      collapsed: false,
      manualExpand: false,
      items: [{ name: 'Jabłka', checked: false }],
    },
  ],
})

describe('listToTemplate', () => {
  it('strips ui flags and checked state, keeps name+items', () => {
    const t = listToTemplate(savedList(), 999, 'Cotygodniowe')
    expect(t).toEqual({
      id: 999,
      date: 999,
      name: 'Cotygodniowe',
      categories: [
        { name: 'nabiał', items: [{ name: 'Mleko 1L' }, { name: 'Jogurt' }] },
        { name: 'owoce', items: [{ name: 'Jabłka' }] },
      ],
    })
  })

  it('drops empty categories', () => {
    const t = listToTemplate(savedList(), 1, 'x')
    expect(t.categories.map(c => c.name)).toEqual(['nabiał', 'owoce'])
  })

  it('preserves item order', () => {
    const t = listToTemplate(savedList(), 1, 'x')
    expect(t.categories[0].items.map(i => i.name)).toEqual(['Mleko 1L', 'Jogurt'])
  })
})

describe('templateToList', () => {
  const tpl = () => ({
    id: 222,
    date: 222,
    name: 'Cotygodniowe',
    categories: [
      { name: 'nabiał', items: [{ name: 'Mleko 1L' }, { name: 'Jogurt' }] },
      { name: 'owoce', items: [{ name: 'Jabłka' }] },
    ],
  })

  it('produces an unchecked, saved, expanded list', () => {
    const l = templateToList(tpl(), 333, 'Cotygodniowe 5 maj')
    expect(l).toEqual({
      id: 333,
      title: 'Cotygodniowe 5 maj',
      date: 333,
      saved: true,
      categories: [
        {
          name: 'nabiał',
          collapsed: false,
          manualExpand: false,
          items: [
            { name: 'Mleko 1L', checked: false },
            { name: 'Jogurt', checked: false },
          ],
        },
        {
          name: 'owoce',
          collapsed: false,
          manualExpand: false,
          items: [{ name: 'Jabłka', checked: false }],
        },
      ],
    })
  })

  it('round-trips category and item names', () => {
    const original = savedList()
    const back = templateToList(listToTemplate(original, 1, 'n'), 2, 'title')
    expect(back.categories.map(c => c.name)).toEqual(['nabiał', 'owoce'])
    expect(back.categories[0].items.map(i => i.name)).toEqual(['Mleko 1L', 'Jogurt'])
    expect(back.categories.flatMap(c => c.items).every(i => i.checked === false)).toBe(true)
  })
})
