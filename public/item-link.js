/**
 * @param {string} name
 * @returns {{ href: string, label: string } | null}
 */
export function getItemLink(name) {
  const label = name.trim()
  if (!label) return null

  const href = label.startsWith('www.') ? `https://${label}` : label
  if (!/^https?:\/\//i.test(href)) return null

  try {
    const url = new URL(href)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null
    return { href: url.href, label }
  } catch {
    return null
  }
}
