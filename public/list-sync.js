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
 * @param {{ updatedAt: number, clientId: string }} a
 * @param {{ updatedAt: number, clientId: string }} b
 * @returns {number}
 */
export function compareSyncMessages(a, b) {
  if (a.updatedAt !== b.updatedAt) return a.updatedAt - b.updatedAt
  if (a.clientId === b.clientId) return 0
  return a.clientId < b.clientId ? -1 : 1
}

/**
 * @param {string} clientId
 * @param {() => number} [now]
 * @returns {(list: ShoppingListData) => { shareUpdatedAt: number, shareUpdatedBy: string }}
 */
export function createShareVersionAllocator(clientId, now = Date.now) {
  let lastShareUpdatedAt = 0
  return list => {
    const shareUpdatedAt = Math.max(now(), (list.shareUpdatedAt ?? 0) + 1, lastShareUpdatedAt + 1)
    lastShareUpdatedAt = shareUpdatedAt
    return { shareUpdatedAt, shareUpdatedBy: clientId }
  }
}

/**
 * @param {ShoppingListData} list
 * @param {string} clientId
 * @returns {{ type: 'list-state', clientId: string, shareId: string | undefined, updatedAt: number, title: string, date: number, categories: Array<{ name: string, items: Item[] }> }}
 */
export function listToSyncMessage(list, clientId) {
  return {
    type: 'list-state',
    clientId: list.shareUpdatedBy ?? clientId,
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
 * @param {ShoppingListData} sharedList
 * @param {ShoppingListData[]} savedLists
 * @returns {ShoppingListData}
 */
export function preferNewestSharedList(sharedList, savedLists) {
  const shareId = sanitizeShareId(sharedList.shareId)
  if (!shareId) return sharedList
  const sharedUpdatedAt = sharedList.shareUpdatedAt ?? 0
  const local = savedLists
    .filter(list => list.shareId === shareId)
    .sort((a, b) => {
      const bySync = (b.shareUpdatedAt ?? 0) - (a.shareUpdatedAt ?? 0)
      if (bySync !== 0) return bySync
      return b.date - a.date
    })[0]
  if (!local) return sharedList
  return (local.shareUpdatedAt ?? 0) >= sharedUpdatedAt ? local : sharedList
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
    shareUpdatedBy: message.clientId,
    categories: message.categories.map(c => ({
      name: c.name,
      collapsed: false,
      manualExpand: false,
      items: c.items.map(i => ({ name: i.name, checked: i.checked })),
    })),
  }
}
