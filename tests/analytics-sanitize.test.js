import { describe, it, expect } from 'vitest'
import { shareSecretFrom, sanitizeProperties } from '../public/analytics-sanitize.js'

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

  it('arms on an 8-character payload, the new floor', () => {
    expect(shareSecretFrom('?state=12345678')).toBe('12345678')
  })

  it('rejects a 7-character payload, below the new floor', () => {
    expect(shareSecretFrom('?state=1234567')).toBeNull()
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

  it('keeps the event when only a 23-char prefix of the payload survives (below PROBE_LEN)', () => {
    expect(sanitizeProperties({ note: PAYLOAD.slice(0, 23) }, PAYLOAD)).toEqual({
      note: PAYLOAD.slice(0, 23),
    })
  })

  it('drops the event when exactly a 24-char prefix of the payload survives (PROBE_LEN boundary)', () => {
    expect(sanitizeProperties({ note: PAYLOAD.slice(0, 24) }, PAYLOAD)).toBeNull()
  })

  it('keeps the event when the payload is absent', () => {
    expect(sanitizeProperties({ $browser: 'Chrome' }, PAYLOAD)).toEqual({ $browser: 'Chrome' })
  })

  it('does not mutate the input object', () => {
    const props = { $current_url: 'https://example.com/?state=abc' }
    sanitizeProperties(props, null)
    expect(props.$current_url).toBe('https://example.com/?state=abc')
  })

  it('fails closed on cyclic input instead of throwing', () => {
    /** @type {Record<string, unknown>} */
    const o = {}
    o.self = o
    expect(() => sanitizeProperties(o, null)).not.toThrow()
    expect(sanitizeProperties(o, null)).toBeNull()
  })

  it('does not let toJSON bypass the URL sanitizer', () => {
    const props = {
      evil: {
        toJSON: () => `https://evil.example/?x=${PAYLOAD}`,
      },
    }
    const out = sanitizeProperties(props, null)
    expect(JSON.stringify(out)).not.toContain(PAYLOAD)
    expect(out).toEqual({ evil: 'https://evil.example/' })
  })

  it('drops the event when a toJSON payload survives even without the URL sanitizer catching it', () => {
    const props = {
      evil: {
        toJSON: () => `leaked-${PAYLOAD}-not-url-shaped`,
      },
    }
    expect(sanitizeProperties(props, PAYLOAD)).toBeNull()
  })

  it('arms the probe for a short (8-23 char) secret and drops when it survives', () => {
    const shortSecret = PAYLOAD.slice(0, 12)
    expect(sanitizeProperties({ note: `leaked ${shortSecret}` }, shortSecret)).toBeNull()
  })

  it('does not arm for a secret shorter than the 8-char floor (caller would pass null)', () => {
    // shareSecretFrom would never hand back a sub-8-char secret; a null secret
    // means the probe is skipped entirely regardless of what leaked.
    expect(sanitizeProperties({ note: 'leaked 1234567' }, null)).toEqual({
      note: 'leaked 1234567',
    })
  })
})
