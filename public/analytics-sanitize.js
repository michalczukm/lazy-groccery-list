const MIN_SECRET_LEN = 8
const PROBE_LEN = 24
const URL_LIKE = /^https?:\/\//i

/**
 * @param {string} value
 * @returns {string}
 */
const stripUrl = value => {
  try {
    const url = new URL(value)
    return `${url.origin}${url.pathname}`
  } catch {
    return value
  }
}

/**
 * @param {unknown} value
 * @param {WeakSet<object>} seen
 * @returns {unknown}
 */
const sanitizeValue = (value, seen) => {
  if (typeof value === 'string') return URL_LIKE.test(value) ? stripUrl(value) : value
  if (value === null || typeof value !== 'object') return value
  if (seen.has(value)) throw new Error('cyclic value')
  seen.add(value)
  const toJSON = /** @type {{ toJSON?: unknown }} */ (value).toJSON
  if (typeof toJSON === 'function') return sanitizeValue(toJSON.call(value), seen)
  if (Array.isArray(value)) return value.map(item => sanitizeValue(item, seen))
  /** @type {Record<string, unknown>} */
  const out = {}
  for (const [key, item] of Object.entries(value)) out[key] = sanitizeValue(item, seen)
  return out
}

/**
 * @param {string} search
 * @returns {string | null}
 */
export const shareSecretFrom = search => {
  const state = new URLSearchParams(search).get('state')
  return state !== null && state.length >= MIN_SECRET_LEN ? state : null
}

/**
 * @param {Record<string, unknown>} properties
 * @param {string | null} secret
 * @returns {Record<string, unknown> | null}
 */
export const sanitizeProperties = (properties, secret) => {
  try {
    const cleaned = /** @type {Record<string, unknown>} */ (
      sanitizeValue(properties, new WeakSet())
    )
    if (secret !== null) {
      const probe = secret.length < PROBE_LEN ? secret : secret.slice(0, PROBE_LEN)
      if (JSON.stringify(cleaned).includes(probe)) return null
    }
    return cleaned
  } catch {
    return null
  }
}
