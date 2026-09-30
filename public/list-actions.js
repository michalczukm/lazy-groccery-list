/**
 * @typedef {{
 *   getCurrentList: () => ShoppingListData | null,
 *   clearCurrentList: () => void,
 *   deleteList: (id: number) => Promise<unknown>,
 *   stopSync: () => void,
 *   navigateToHistory: () => Promise<unknown>,
 *   showToast: (msg: string, dur?: number, isError?: boolean) => void,
 *   confirmDelete: (msg: string) => boolean,
 * }} DeleteCurrentListOptions
 */

/** @param {DeleteCurrentListOptions} options */
export async function deleteCurrentListFlow(options) {
  const list = options.getCurrentList()
  if (!list) {
    options.showToast('Brak aktywnej listy')
    return
  }
  if (!options.confirmDelete('Usunąć bieżącą listę?')) return

  try {
    await options.deleteList(list.id)
    options.clearCurrentList()
    options.stopSync()
    await options.navigateToHistory()
    options.showToast('Lista usunięta')
  } catch {
    options.showToast('Nie udało się usunąć listy', 4000, true)
  }
}

/**
 * @typedef {{
 *   getCurrentList: () => ShoppingListData | null,
 *   setCurrentList: (list: ShoppingListData) => void,
 *   saveList: (list: ShoppingListData) => Promise<unknown>,
 *   showToast: (msg: string, dur?: number, isError?: boolean) => void,
 *   confirmDelete: (msg: string) => boolean,
 * }} RemoveItemFromListOptions
 */

/**
 * @param {RemoveItemFromListOptions} options
 * @param {number} categoryIndex
 * @param {number} itemIndex
 */
export async function removeItemFromListFlow(options, categoryIndex, itemIndex) {
  const list = options.getCurrentList()
  const item = list?.categories[categoryIndex]?.items[itemIndex]
  if (!list || !item) {
    options.showToast('Nie znaleziono produktu', 4000, true)
    return
  }
  if (!options.confirmDelete(`Usunąć „${item.name}” z listy?`)) return

  const updated = {
    ...list,
    categories: list.categories.map((category, ci) =>
      ci !== categoryIndex
        ? category
        : {
            ...category,
            items: category.items.filter((_, ii) => ii !== itemIndex),
          },
    ),
  }

  try {
    options.setCurrentList(updated)
    if (updated.saved) await options.saveList(updated)
    options.showToast('Produkt usunięty')
  } catch {
    options.setCurrentList(list)
    options.showToast('Nie udało się usunąć produktu', 4000, true)
  }
}
