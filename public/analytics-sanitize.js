const MIN_SECRET_LEN = 24
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
 * @returns {unknown}
 */
const sanitizeValue = value => {
  if (typeof value === 'string') return URL_LIKE.test(value) ? stripUrl(value) : value
  if (Array.isArray(value)) return value.map(sanitizeValue)
  if (value !== null && typeof value === 'object') {
    /** @type {Record<string, unknown>} */
    const out = {}
    for (const [key, item] of Object.entries(value)) out[key] = sanitizeValue(item)
    return out
  }
  return value
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
  const cleaned = /** @type {Record<string, unknown>} */ (sanitizeValue(properties))
  if (secret !== null && JSON.stringify(cleaned).includes(secret.slice(0, PROBE_LEN))) return null
  return cleaned
}

/**
 * @param {number} count
 * @returns {string}
 */
export const bucketSize = count => {
  if (count <= 0) return '0'
  if (count <= 10) return '1-10'
  if (count <= 30) return '11-30'
  return '30+'
}
