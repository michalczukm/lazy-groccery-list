import { describe, expect, it } from 'vitest'
import { getItemLink, getItemLinkSegments, stopItemLinkClick } from '../public/item-link.js'

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

  it('keeps trailing sentence punctuation outside url links', () => {
    expect(getItemLinkSegments('buy www.example.com/deals, today')).toEqual([
      { text: 'buy ' },
      { text: 'www.example.com/deals', href: 'https://www.example.com/deals' },
      { text: ', today' },
    ])
    expect(getItemLinkSegments('see https://example.com/a_(b).')).toEqual([
      { text: 'see ' },
      { text: 'https://example.com/a_(b)', href: 'https://example.com/a_(b)' },
      { text: '.' },
    ])
  })

  it('links each url segment independently', () => {
    expect(getItemLinkSegments('compare www.example.com and https://shop.example/cart')).toEqual([
      { text: 'compare ' },
      { text: 'www.example.com', href: 'https://www.example.com/' },
      { text: ' and ' },
      { text: 'https://shop.example/cart', href: 'https://shop.example/cart' },
    ])
  })
})

describe('stopItemLinkClick', () => {
  it('stops link clicks from toggling the item row', () => {
    let stopped = false

    stopItemLinkClick({
      stopPropagation() {
        stopped = true
      },
    })

    expect(stopped).toBe(true)
  })
})
