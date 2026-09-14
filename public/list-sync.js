const SHARE_ID_RE = /^[A-Za-z0-9_-]{8,80}$/

/**
 * @param {unknown} value
 * @returns {boolean}
 */
function isSyncCategory(value) {
  if (!value || typeof value !== 'object') return false
  const category = /** @type {Record<string, unknown>} */ (value)
  return (
    typeof category.name === 'string' &&
    Array.isArray(category.items) &&
    category.items.every(item => {
      if (!item || typeof item !== 'object') return false
      const entry = /** @type {Record<string, unknown>} */ (item)
      return typeof entry.name === 'string' && typeof entry.checked === 'boolean'
    })
  )
}

/**
 * @param {string | null | undefined} value
 * @returns {string | null}
 */
export function sanitizeShareId(value) {
  if (!value || !SHARE_ID_RE.test(value)) return null
  return value
}

export function createShareId() {
  const bytes = new Uint8Array(24)
  crypto.getRandomValues(bytes)
  const binary = Array.from(bytes, b => String.fromCharCode(b)).join('')
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

/**
 * @param {ShoppingListData} list
 * @param {string} clientId
 * @returns {{ type: 'list-state', clientId: string, shareId: string | undefined, updatedAt: number, title: string, date: number, categories: Array<{ name: string, items: Item[] }> }}
 */
export function listToSyncMessage(list, clientId) {
  return {
    type: 'list-state',
    clientId,
    shareId: list.shareId,
    updatedAt: list.shareUpdatedAt ?? Date.now(),
    title: list.title,
    date: list.date,
    categories: list.categories.map(c => ({
      name: c.name,
      items: c.items.map(i => ({ name: i.name, checked: i.checked })),
    })),
  }
}

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isListSyncMessage(value) {
  if (!value || typeof value !== 'object') return false
  const msg = /** @type {Record<string, unknown>} */ (value)
  return (
    msg.type === 'list-state' &&
    typeof msg.clientId === 'string' &&
    sanitizeShareId(/** @type {string | undefined} */ (msg.shareId)) !== null &&
    typeof msg.updatedAt === 'number' &&
    Number.isFinite(msg.updatedAt) &&
    typeof msg.title === 'string' &&
    typeof msg.date === 'number' &&
    Number.isFinite(msg.date) &&
    Array.isArray(msg.categories) &&
    msg.categories.every(isSyncCategory)
  )
}

/**
 * @param {ReturnType<typeof listToSyncMessage>} message
 * @param {ShoppingListData} current
 * @returns {ShoppingListData}
 */
export function syncMessageToList(message, current) {
  return {
    ...current,
    title: message.title,
    date: message.date,
    saved: true,
    shareId: message.shareId,
    shareUpdatedAt: message.updatedAt,
    categories: message.categories.map(c => ({
      name: c.name,
      collapsed: false,
      manualExpand: false,
      items: c.items.map(i => ({ name: i.name, checked: i.checked })),
    })),
  }
}
