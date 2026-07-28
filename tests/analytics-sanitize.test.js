import { describe, it, expect } from 'vitest'
import { shareSecretFrom, sanitizeProperties, bucketSize } from '../public/analytics-sanitize.js'

const PAYLOAD =
  'H4sIAAAAAAAAA6tWSlSyUkrKzFPSUUpKLElVslLKTC1RsopWKlDSUUosLlHSUUqvyswrUdJRKk4tKlHSUQIA'

describe('shareSecretFrom', () => {
  it('extracts the state payload from a share URL query', () => {
    expect(shareSecretFrom(`?state=${PAYLOAD}`)).toBe(PAYLOAD)
  })

  it('returns null when there is no state param', () => {
    expect(shareSecretFrom('?foo=bar')).toBeNull()
    expect(shareSecretFrom('')).toBeNull()
  })

  it('returns null for a payload too short to encode a list', () => {
    expect(shareSecretFrom('?state=abc')).toBeNull()
  })
})

describe('sanitizeProperties', () => {
  it('reduces a share URL to origin and pathname', () => {
    const out = sanitizeProperties(
      { $current_url: `https://lazy-shopping.michalczukm.xyz/?state=${PAYLOAD}` },
      null,
    )
    expect(out).toEqual({ $current_url: 'https://lazy-shopping.michalczukm.xyz/' })
  })

  it('strips query and hash from every URL-shaped property', () => {
    const out = sanitizeProperties(
      {
        $current_url: 'https://example.com/list?state=abc#frag',
        $referrer: 'https://example.com/other?q=1',
      },
      null,
    )
    expect(out).toEqual({
      $current_url: 'https://example.com/list',
      $referrer: 'https://example.com/other',
    })
  })

  it('sanitizes URLs nested in objects and arrays at any depth', () => {
    const out = sanitizeProperties(
      { a: { b: [{ c: `https://example.com/?state=${PAYLOAD}` }] } },
      null,
    )
    expect(JSON.stringify(out)).not.toContain(PAYLOAD)
    expect(out).toEqual({ a: { b: [{ c: 'https://example.com/' }] } })
  })

  it('leaves non-URL values untouched', () => {
    const props = { $browser: 'Chrome', count: 3, ok: true, nothing: null }
    expect(sanitizeProperties(props, null)).toEqual(props)
  })

  it('drops the event entirely when the payload survives in any property', () => {
    expect(sanitizeProperties({ note: `leaked ${PAYLOAD}` }, PAYLOAD)).toBeNull()
  })

  it('drops the event when only a prefix of the payload survives', () => {
    expect(sanitizeProperties({ note: PAYLOAD.slice(0, 30) }, PAYLOAD)).toBeNull()
  })

  it('keeps the event when the payload is absent', () => {
    expect(sanitizeProperties({ $browser: 'Chrome' }, PAYLOAD)).toEqual({ $browser: 'Chrome' })
  })

  it('does not mutate the input object', () => {
    const props = { $current_url: 'https://example.com/?state=abc' }
    sanitizeProperties(props, null)
    expect(props.$current_url).toBe('https://example.com/?state=abc')
  })
})

describe('bucketSize', () => {
  it('buckets counts into coarse ranges', () => {
    expect(bucketSize(0)).toBe('0')
    expect(bucketSize(1)).toBe('1-10')
    expect(bucketSize(10)).toBe('1-10')
    expect(bucketSize(11)).toBe('11-30')
    expect(bucketSize(30)).toBe('11-30')
    expect(bucketSize(31)).toBe('30+')
  })
})
