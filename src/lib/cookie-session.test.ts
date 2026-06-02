import { describe, it, expect } from 'vitest'
import { signSession, verifySession } from './cookie-session'

const SECRET = 'test-secret-please-rotate'
const MAX_AGE = 86400

describe('cookie-session', () => {
  it('returns valid when cookie is freshly signed', async () => {
    const now = 1_700_000_000
    const cookie = await signSession(SECRET, now)
    const result = await verifySession(cookie, SECRET, MAX_AGE, now)
    expect(result).toEqual({ valid: true, iat: now })
  })

  it('returns bad-signature when signature is tampered', async () => {
    const now = 1_700_000_000
    const cookie = await signSession(SECRET, now)
    const [payload] = cookie.split('.')
    const tampered = `${payload}.AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA`
    const result = await verifySession(tampered, SECRET, MAX_AGE, now)
    expect(result).toEqual({ valid: false, reason: 'bad-signature' })
  })

  it('returns expired when iat is older than maxAge', async () => {
    const iat = 1_700_000_000
    const cookie = await signSession(SECRET, iat)
    const later = iat + MAX_AGE + 1
    const result = await verifySession(cookie, SECRET, MAX_AGE, later)
    expect(result).toEqual({ valid: false, reason: 'expired' })
  })

  it('returns malformed when cookie has no dot', async () => {
    const result = await verifySession('nodothere', SECRET, MAX_AGE, 1_700_000_000)
    expect(result).toEqual({ valid: false, reason: 'malformed' })
  })

  it('returns malformed when cookie has bad base64', async () => {
    const result = await verifySession('!!!.???', SECRET, MAX_AGE, 1_700_000_000)
    expect(result).toEqual({ valid: false, reason: 'malformed' })
  })

  it('returns bad-signature when signed with different secret', async () => {
    const now = 1_700_000_000
    const cookie = await signSession('other-secret', now)
    const result = await verifySession(cookie, SECRET, MAX_AGE, now)
    expect(result).toEqual({ valid: false, reason: 'bad-signature' })
  })
})
