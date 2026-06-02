import { describe, it, expect } from 'vitest'
import { isSameOrigin } from './origin-guard'

const req = (origin: string | null) =>
  new Request('https://lazy.example.com/api/x', {
    method: 'POST',
    headers: origin ? { Origin: origin } : {},
  })

describe('isSameOrigin', () => {
  it('returns true when Origin matches request URL origin', () => {
    expect(isSameOrigin(req('https://lazy.example.com'))).toBe(true)
  })

  it('returns false when Origin differs from request URL origin', () => {
    expect(isSameOrigin(req('https://evil.example.com'))).toBe(false)
  })

  it('returns false when Origin header is missing', () => {
    expect(isSameOrigin(req(null))).toBe(false)
  })

  it('returns false when scheme differs', () => {
    expect(isSameOrigin(req('http://lazy.example.com'))).toBe(false)
  })
})
