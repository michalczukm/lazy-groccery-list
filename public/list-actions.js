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
