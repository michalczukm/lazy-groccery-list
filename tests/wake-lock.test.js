import { describe, expect, it, vi } from 'vitest'
import { createScreenWakeLockController } from '../public/wake-lock.js'

function createDocumentDouble() {
  const listeners = new Map()
  return {
    visibilityState: 'visible',
    addEventListener: vi.fn((type, fn) => listeners.set(type, fn)),
    removeEventListener: vi.fn((type, fn) => {
      if (listeners.get(type) === fn) listeners.delete(type)
    }),
    dispatch(type) {
      listeners.get(type)?.()
    },
  }
}

function makeSentinel() {
  const listeners = new Map()
  const sentinel = {
    released: false,
    addEventListener: vi.fn((type, fn) => listeners.set(type, fn)),
    removeEventListener: vi.fn((type, fn) => {
      if (listeners.get(type) === fn) listeners.delete(type)
    }),
    release: vi.fn(async () => {
      if (sentinel.released) return
      sentinel.released = true
      listeners.get('release')?.()
    }),
    systemRelease() {
      sentinel.released = true
      listeners.get('release')?.()
    },
  }
  return sentinel
}

describe('createScreenWakeLockController', () => {
  it('requests a screen wake lock only while a visible list view is active', async () => {
    const documentDouble = createDocumentDouble()
    const sentinel = makeSentinel()
    const request = vi.fn().mockResolvedValue(sentinel)
    const controller = createScreenWakeLockController({
      document: documentDouble,
      navigator: { wakeLock: { request } },
    })

    await controller.setActiveListView(true)

    expect(request).toHaveBeenCalledWith('screen')
    await controller.setActiveListView(false)
    expect(sentinel.release).toHaveBeenCalledTimes(1)
  })

  it('releases the wake lock while the page is hidden and reacquires when visible again', async () => {
    const documentDouble = createDocumentDouble()
    const firstSentinel = makeSentinel()
    const secondSentinel = makeSentinel()
    const request = vi
      .fn()
      .mockResolvedValueOnce(firstSentinel)
      .mockResolvedValueOnce(secondSentinel)
    const controller = createScreenWakeLockController({
      document: documentDouble,
      navigator: { wakeLock: { request } },
    })
    await controller.setActiveListView(true)

    documentDouble.visibilityState = 'hidden'
    documentDouble.dispatch('visibilitychange')
    await Promise.resolve()

    expect(firstSentinel.release).toHaveBeenCalledTimes(1)
    expect(request).toHaveBeenCalledTimes(1)

    documentDouble.visibilityState = 'visible'
    documentDouble.dispatch('visibilitychange')
    await Promise.resolve()

    expect(request).toHaveBeenCalledTimes(2)
    expect(secondSentinel.release).not.toHaveBeenCalled()
  })

  it('reacquires after the browser releases the wake lock while the list remains visible', async () => {
    const documentDouble = createDocumentDouble()
    const firstSentinel = makeSentinel()
    const secondSentinel = makeSentinel()
    const request = vi
      .fn()
      .mockResolvedValueOnce(firstSentinel)
      .mockResolvedValueOnce(secondSentinel)
    const controller = createScreenWakeLockController({
      document: documentDouble,
      navigator: { wakeLock: { request } },
    })
    await controller.setActiveListView(true)

    firstSentinel.systemRelease()
    await Promise.resolve()

    expect(request).toHaveBeenCalledTimes(2)
  })

  it('releases a wake lock that resolves after the list view becomes inactive', async () => {
    const documentDouble = createDocumentDouble()
    const sentinel = makeSentinel()
    /** @type {(sentinel: ReturnType<typeof makeSentinel>) => void} */
    let resolveRequest
    const request = vi.fn(
      () =>
        new Promise(resolve => {
          resolveRequest = resolve
        }),
    )
    const controller = createScreenWakeLockController({
      document: documentDouble,
      navigator: { wakeLock: { request } },
    })
    const firstSync = controller.setActiveListView(true)

    await controller.setActiveListView(false)
    resolveRequest(sentinel)
    await firstSync

    expect(sentinel.release).toHaveBeenCalledTimes(1)
  })

  it('quietly no-ops when the Screen Wake Lock API is unsupported', async () => {
    const documentDouble = createDocumentDouble()
    const onUserVisibleError = vi.fn()
    const controller = createScreenWakeLockController({
      document: documentDouble,
      navigator: {},
      onUserVisibleError,
    })

    await controller.setActiveListView(true)

    expect(onUserVisibleError).not.toHaveBeenCalled()
  })
})
