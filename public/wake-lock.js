/**
 * @typedef {{
 *   document: Document,
 *   navigator: Navigator,
 *   onUserVisibleError?: () => void,
 * }} ScreenWakeLockControllerOptions
 */

/**
 * @typedef {{
 *   setActiveListView: (active: boolean) => Promise<void>,
 *   dispose: () => Promise<void>,
 * }} ScreenWakeLockController
 */

/**
 * @param {ScreenWakeLockControllerOptions} options
 * @returns {ScreenWakeLockController}
 */
export function createScreenWakeLockController(options) {
  const { document, navigator, onUserVisibleError } = options
  /** @type {WakeLockSentinel | null} */
  let sentinel = null
  /** @type {Promise<void> | null} */
  let pending = null
  let activeListView = false
  let userVisibleErrorShown = false

  const isVisible = () => document.visibilityState === 'visible'
  const shouldHold = () => activeListView && isVisible()
  const isSupported = () => typeof navigator.wakeLock?.request === 'function'

  const releaseCurrent = async () => {
    const current = sentinel
    sentinel = null
    if (current) {
      current.removeEventListener('release', handleRelease)
      await current.release().catch(() => {})
    }
  }

  const sync = async () => {
    if (!shouldHold()) {
      await releaseCurrent()
      return
    }
    if (sentinel || pending || !isSupported()) return

    pending = navigator.wakeLock
      .request('screen')
      .then(async next => {
        sentinel = next
        if (!shouldHold()) {
          await releaseCurrent()
          return
        }
        sentinel.addEventListener('release', handleRelease)
      })
      .catch(() => {
        if (shouldHold() && !userVisibleErrorShown) {
          userVisibleErrorShown = true
          onUserVisibleError?.()
        }
      })
      .finally(() => {
        pending = null
      })

    await pending
  }

  function handleRelease() {
    if (sentinel) sentinel.removeEventListener('release', handleRelease)
    sentinel = null
    sync().catch(() => {})
  }

  const handleVisibilityChange = () => {
    sync().catch(() => {})
  }

  document.addEventListener('visibilitychange', handleVisibilityChange)

  return {
    async setActiveListView(active) {
      activeListView = active
      await sync()
    },
    async dispose() {
      activeListView = false
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      await releaseCurrent()
    },
  }
}
