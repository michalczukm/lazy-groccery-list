/**
 * @param {ShoppingListData} list
 * @returns {{ currentTitle: string, categories: Array<{ name: string, items: string[] }> }}
 */
export function buildTitleSuggestionPayload(list) {
  return {
    currentTitle: list.title,
    categories: list.categories.map(c => ({
      name: c.name,
      items: c.items.map(i => i.name),
    })),
  }
}

/**
 * @param {unknown} value
 * @returns {string | null}
 */
export function normalizeSuggestedTitle(value) {
  if (typeof value !== 'string') return null
  const title = value
    .trim()
    .replace(/^['"“”„]+|['"“”„]+$/g, '')
    .trim()
  if (!title) return null
  return title.slice(0, 60)
}

/**
 * @param {ShoppingListData} list
 * @param {typeof fetch} [fetcher]
 * @returns {Promise<string | null>}
 */
export async function requestTitleSuggestion(list, fetcher = fetch) {
  const res = await fetcher('/api/suggest-title', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(buildTitleSuggestionPayload(list)),
  })
  if (!res.ok) return null
  const data = await res.json().catch(() => null)
  return normalizeSuggestedTitle(data?.title)
}
