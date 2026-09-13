const ITEM_URL_PATTERN = /(?:https?:\/\/|www\.)[^\s]+/gi
const TRAILING_URL_PUNCTUATION = new Set(['.', ',', '!', '?', ':', ';', '"', "'"])
const TRAILING_PAIRED_PUNCTUATION = {
  ')': '(',
  ']': '[',
  '}': '{',
}

/**
 * @param {string} value
 * @param {string} char
 * @returns {number}
 */
function countChar(value, char) {
  let count = 0
  for (const current of value) {
    if (current === char) count += 1
  }
  return count
}

/**
 * @param {string} candidate
 * @returns {{ label: string, trailingText: string }}
 */
function splitTrailingUrlPunctuation(candidate) {
  let label = candidate
  let trailingText = ''

  while (label) {
    const lastChar = label.at(-1)
    if (!lastChar) break

    const openingPair =
      /** @type {Partial<Record<string, string>>} */ (TRAILING_PAIRED_PUNCTUATION)[lastChar]
    const shouldTrimPair = openingPair && countChar(label, lastChar) > countChar(label, openingPair)
    const shouldTrim = TRAILING_URL_PUNCTUATION.has(lastChar) || shouldTrimPair
    if (!shouldTrim) break

    trailingText = lastChar + trailingText
    label = label.slice(0, -1)
  }

  return { label, trailingText }
}

/**
 * @param {Array<{ text: string, href?: string }>} segments
 * @param {string} text
 */
function pushTextSegment(segments, text) {
  if (!text) return

  const previous = segments.at(-1)
  if (previous && !previous.href) {
    previous.text += text
    return
  }

  segments.push({ text })
}

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
    const candidate = match[0]
    const { label: text, trailingText } = splitTrailingUrlPunctuation(candidate)
    const index = /** @type {number} */ (match.index)
    const href = normalizeHref(text)
    if (!href) continue

    if (index > lastIndex) pushTextSegment(segments, name.slice(lastIndex, index))
    segments.push({ text, href })
    pushTextSegment(segments, trailingText)
    lastIndex = index + candidate.length
  }

  if (lastIndex < name.length) pushTextSegment(segments, name.slice(lastIndex))
  return segments.length ? segments : [{ text: name }]
}

/** @param {{ stopPropagation: () => void }} e */
export function stopItemLinkClick(e) {
  e.stopPropagation()
}
