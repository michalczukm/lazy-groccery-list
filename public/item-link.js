const ITEM_URL_PATTERN = /(?:https?:\/\/|www\.)[^\s]+/gi

/**
 * @param {string} label
 * @returns {string | null}
 */
function normalizeHref(label) {
  const href = label.startsWith('www.') ? `https://${label}` : label
  if (!/^https?:\/\//i.test(href)) return null

  try {
    const url = new URL(href)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null
    return url.href
  } catch {
    return null
  }
}

/**
 * @param {string} name
 * @returns {{ href: string, label: string } | null}
 */
export function getItemLink(name) {
  const label = name.trim()
  if (!label) return null

  const href = normalizeHref(label)
  return href ? { href, label } : null
}

/**
 * @param {string} name
 * @returns {Array<{ text: string, href?: string }>}
 */
export function getItemLinkSegments(name) {
  /** @type {Array<{ text: string, href?: string }>} */
  const segments = []
  ITEM_URL_PATTERN.lastIndex = 0
  let lastIndex = 0

  for (const match of name.matchAll(ITEM_URL_PATTERN)) {
    const text = match[0]
    const index = /** @type {number} */ (match.index)
    const href = normalizeHref(text)
    if (!href) continue

    if (index > lastIndex) segments.push({ text: name.slice(lastIndex, index) })
    segments.push({ text, href })
    lastIndex = index + text.length
  }

  if (lastIndex < name.length) segments.push({ text: name.slice(lastIndex) })
  return segments.length ? segments : [{ text: name }]
}
