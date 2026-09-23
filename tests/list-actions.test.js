import { describe, it, expect, vi } from 'vitest'
import { deleteCurrentListFlow } from '../public/list-actions.js'

const sharedList = () => ({
  id: 123,
  title: 'Zakupy test',
  date: 1000,
  saved: true,
  shareId: 'share_room',
  shareUpdatedAt: 2000,
  categories: [
    {
      name: 'nabiał',
      collapsed: false,
      manualExpand: false,
      items: [{ name: 'Mleko', checked: false }],
    },
  ],
})

function options(overrides = {}) {
  let current = sharedList()
  return {
    getCurrentList: () => current,
    clearCurrentList: vi.fn(() => {
      current = null
    }),
    deleteList: vi.fn(async () => {}),
    stopSync: vi.fn(),
    navigateToHistory: vi.fn(async () => {}),
    showToast: vi.fn(),
    confirmDelete: vi.fn(() => true),
    ...overrides,
  }
}

describe('deleteCurrentListFlow', () => {
  it('deletes the confirmed current list and returns to history', async () => {
    const deps = options()

    await deleteCurrentListFlow(deps)

    expect(deps.confirmDelete).toHaveBeenCalledWith('Usunąć bieżącą listę?')
    expect(deps.deleteList).toHaveBeenCalledWith(123)
    expect(deps.clearCurrentList).toHaveBeenCalledOnce()
    expect(deps.stopSync).toHaveBeenCalledOnce()
    expect(deps.navigateToHistory).toHaveBeenCalledOnce()
    expect(deps.showToast).toHaveBeenCalledWith('Lista usunięta')
  })

  it('leaves the current list untouched when confirmation is cancelled', async () => {
    const deps = options({ confirmDelete: vi.fn(() => false) })

    await deleteCurrentListFlow(deps)

    expect(deps.deleteList).not.toHaveBeenCalled()
    expect(deps.clearCurrentList).not.toHaveBeenCalled()
    expect(deps.stopSync).not.toHaveBeenCalled()
    expect(deps.navigateToHistory).not.toHaveBeenCalled()
    expect(deps.showToast).not.toHaveBeenCalled()
  })

  it('shows feedback when there is no active list', async () => {
    const deps = options({ getCurrentList: () => null })

    await deleteCurrentListFlow(deps)

    expect(deps.confirmDelete).not.toHaveBeenCalled()
    expect(deps.deleteList).not.toHaveBeenCalled()
    expect(deps.showToast).toHaveBeenCalledWith('Brak aktywnej listy')
  })

  it('keeps the current list active and shows an error when deletion fails', async () => {
    const deps = options({ deleteList: vi.fn(async () => Promise.reject(new Error('fail'))) })

    await deleteCurrentListFlow(deps)

    expect(deps.clearCurrentList).not.toHaveBeenCalled()
    expect(deps.stopSync).not.toHaveBeenCalled()
    expect(deps.navigateToHistory).not.toHaveBeenCalled()
    expect(deps.showToast).toHaveBeenCalledWith('Nie udało się usunąć listy', 4000, true)
  })
})
