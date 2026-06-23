export type VerifyResult =
  | { valid: true; iat: number }
  | { valid: false; reason: 'malformed' | 'bad-signature' | 'expired' }

const enc = new TextEncoder()
const dec = new TextDecoder()

const b64urlFromBytes = (bytes: Uint8Array): string => {
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '')
}

const bytesFromB64url = (s: string): Uint8Array => {
  const padded = s.replaceAll('-', '+').replaceAll('_', '/') + '='.repeat((4 - (s.length % 4)) % 4)
  const bin = atob(padded)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

const importKey = (secret: string) =>
  crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, [
    'sign',
    'verify',
  ])

export const signSession = async (secret: string, nowSec: number): Promise<string> => {
  const payload = { iat: nowSec }
  const payloadJson = JSON.stringify(payload)
  const payloadB64 = b64urlFromBytes(enc.encode(payloadJson))
  const key = await importKey(secret)
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(payloadJson)))
  return `${payloadB64}.${b64urlFromBytes(sig)}`
}

export const verifySession = async (
  cookieValue: string,
  secret: string,
  maxAgeSec: number,
  nowSec: number,
): Promise<VerifyResult> => {
  const dot = cookieValue.indexOf('.')
  if (dot < 1 || dot === cookieValue.length - 1) return { valid: false, reason: 'malformed' }

  const payloadB64 = cookieValue.slice(0, dot)
  const sigB64 = cookieValue.slice(dot + 1)

  let payloadBytes: Uint8Array
  let sigBytes: Uint8Array
  try {
    payloadBytes = bytesFromB64url(payloadB64)
    sigBytes = bytesFromB64url(sigB64)
  } catch {
    return { valid: false, reason: 'malformed' }
  }

  const key = await importKey(secret)
  const ok = await crypto.subtle.verify('HMAC', key, sigBytes, payloadBytes)
  if (!ok) return { valid: false, reason: 'bad-signature' }

  let parsed: { iat?: number }
  try {
    parsed = JSON.parse(dec.decode(payloadBytes))
  } catch {
    return { valid: false, reason: 'malformed' }
  }
  if (typeof parsed.iat !== 'number') return { valid: false, reason: 'malformed' }
  if (nowSec - parsed.iat > maxAgeSec) return { valid: false, reason: 'expired' }

  return { valid: true, iat: parsed.iat }
}
