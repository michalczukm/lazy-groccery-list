import { describe, it, expect } from 'vitest'
import { listToMarkdown } from '../public/list-markdown.js'

describe('listToMarkdown', () => {
  it('exports the list title, categories, and checked item state', () => {
    const markdown = listToMarkdown({
      id: 1,
      title: 'Zakupy test',
      date: 1,
      saved: true,
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
    })

    expect(markdown).toBe(`# Zakupy test

## nabiał

- [ ] Mleko 1L
- [x] Jogurt

## warzywa

- [ ] Marchewka`)
  })
})
