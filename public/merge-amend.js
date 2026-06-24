/**
 * @param {ShoppingListData} list
 * @param {Array<{ name: string, items: Array<string> }>} newCategories
 * @returns {{ categories: Category[], added: number, skipped: number }}
 */
export function mergeAmendInto(list, newCategories) {
  const existing = list.categories.map(c => ({ ...c, items: [...c.items] }))
  let added = 0
  let skipped = 0

  for (const nc of newCategories) {
    if (!nc.items || nc.items.length === 0) continue

    const match = existing.find(c => c.name.toLowerCase() === nc.name.toLowerCase())

    if (match) {
      const existingNames = new Set(match.items.map(i => i.name.trim().toLowerCase()))
      const toAdd = nc.items.filter(n => !existingNames.has(String(n).trim().toLowerCase()))
      skipped += nc.items.length - toAdd.length
      if (toAdd.length > 0) {
        match.items.push(...toAdd.map(name => ({ name: String(name).trim(), checked: false })))
        match.collapsed = false
        match.manualExpand = false
        added += toAdd.length
      }
    } else {
      existing.push({
        name: nc.name,
        collapsed: false,
        manualExpand: false,
        items: nc.items.map(name => ({ name: String(name).trim(), checked: false })),
      })
      added += nc.items.length
    }
  }

  return { categories: existing, added, skipped }
}
