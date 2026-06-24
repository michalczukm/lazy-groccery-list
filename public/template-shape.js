// Pure, deterministic transforms between saved lists and templates.
// No Date.now()/Math.random()/new Date()/fmtDate here — callers pass ids and titles in.

/**
 * @param {ShoppingListData} list
 * @param {number} id
 * @param {string} name
 * @returns {Template}
 */
export function listToTemplate(list, id, name) {
  return {
    id,
    date: id,
    name,
    categories: (list.categories ?? [])
      .map(c => ({
        name: c.name,
        items: (c.items ?? []).map(i => ({ name: i.name })),
      }))
      .filter(c => c.items.length > 0),
  }
}

/**
 * @param {Template} tpl
 * @param {number} id
 * @param {string} title
 * @returns {ShoppingListData}
 */
export function templateToList(tpl, id, title) {
  return {
    id,
    title,
    date: id,
    saved: true,
    categories: (tpl.categories ?? [])
      .map(c => ({
        name: c.name,
        collapsed: false,
        manualExpand: false,
        items: (c.items ?? []).map(i => ({ name: i.name, checked: false })),
      }))
      .filter(c => c.items.length > 0),
  }
}
