import { describe, expect, it } from 'vitest'
import { getItemLink, getItemLinkSegments } from '../public/item-link.js'

describe('getItemLink', () => {
  it('returns an external href for http and https item names', () => {
    expect(getItemLink('https://example.com/list?id=42')).toEqual({
      href: 'https://example.com/list?id=42',
      label: 'https://example.com/list?id=42',
    })
    expect(getItemLink('http://example.com')).toEqual({
      href: 'http://example.com/',
      label: 'http://example.com',
    })
  })

  it('normalizes www item names to https links', () => {
    expect(getItemLink('www.example.com/deals')).toEqual({
      href: 'https://www.example.com/deals',
      label: 'www.example.com/deals',
    })
  })

  it('leaves non-link item names as plain text', () => {
    expect(getItemLink('milk')).toBeNull()
    expect(getItemLink('example.com')).toBeNull()
  })
})

describe('getItemLinkSegments', () => {
  it('links only the url text inside an item name', () => {
    expect(getItemLinkSegments('bread www.example.com/deals today')).toEqual([
      { text: 'bread ' },
      { text: 'www.example.com/deals', href: 'https://www.example.com/deals' },
      { text: ' today' },
    ])
  })
})
