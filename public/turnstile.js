const WARN_EVENTS = new Set([
  'script-timeout',
  'silent-render-failed',
  'challenge-render-failed',
  'challenge-error',
  'challenge-expired',
])

/**
 * @param {string} event
 * @param {Record<string, unknown>} [detail]
 */
const defaultLog = (event, detail) => {
  const line = `[turnstile] ${event}`
  if (WARN_EVENTS.has(event)) console.warn(line, detail)
  else console.info(line, detail)
}

/**
 * @param {number} timeoutMs
 * @returns {Promise<boolean>}
 */
function waitForTurnstile(timeoutMs) {
  return new Promise(resolve => {
    if (globalThis.window?.turnstile) return resolve(true)
    const startedAt = Date.now()
    const id = setInterval(() => {
      if (globalThis.window?.turnstile) {
        clearInterval(id)
        resolve(true)
      } else if (Date.now() - startedAt >= timeoutMs) {
        clearInterval(id)
        resolve(false)
      }
    }, 50)
  })
}

/**
 * @typedef {{
 *   onChallengeVisible?: () => void
 *   onChallengeHidden?: () => void
 *   onCancel?: (cancel: () => void) => void
 *   silentContainer?: string
 *   challengeContainer?: string
 *   timeoutMs?: number
 *   scriptTimeoutMs?: number
 *   log?: (event: string, detail?: Record<string, unknown>) => void
 * }} TurnstileHooks
 */

/**
 * @param {string} siteKey
 * @param {TurnstileHooks} [hooks]
 * @returns {Promise<string>}
 */
export async function executeTurnstile(siteKey, hooks = {}) {
  const {
    onChallengeVisible = () => {},
    onChallengeHidden = () => {},
    onCancel = () => {},
    silentContainer = '#turnstile-widget',
    challengeContainer = '#turnstile-challenge-widget',
    timeoutMs = 8000,
    scriptTimeoutMs = 10000,
    log = defaultLog,
  } = hooks

  const startedAt = Date.now()
  /**
   * @param {string} event
   * @param {Record<string, unknown>} [detail]
   * @returns {void}
   */
  const emit = (event, detail = {}) => log(event, { ...detail, elapsedMs: Date.now() - startedAt })

  if (!(await waitForTurnstile(scriptTimeoutMs))) {
    emit('script-timeout', { scriptTimeoutMs })
    throw new Error('captcha-unavailable')
  }
  emit('script-ready')

  return new Promise((resolve, reject) => {
    /** @type {string | null} */
    let silentId = null
    /** @type {string | null} */
    let visibleId = null
    /** @type {ReturnType<typeof setTimeout> | null} */
    let watchdog = null
    let challengeShown = false
    let settled = false

    const clearWatchdog = () => {
      if (watchdog !== null) {
        clearTimeout(watchdog)
        watchdog = null
      }
    }

    /** @param {string | null} id */
    const remove = id => {
      if (id !== null) window.turnstile.remove(id)
    }

    const cleanup = () => {
      clearWatchdog()
      remove(silentId)
      silentId = null
      remove(visibleId)
      visibleId = null
      if (challengeShown) onChallengeHidden()
    }

    /** @param {string} token */
    const succeed = token => {
      if (settled) return
      settled = true
      emit(challengeShown ? 'challenge-success' : 'silent-success')
      cleanup()
      resolve(token)
    }

    const fail = () => {
      if (settled) return
      settled = true
      cleanup()
      reject(new Error('captcha-failed'))
    }

    const showChallenge = () => {
      if (settled || challengeShown) return
      challengeShown = true
      clearWatchdog()
      remove(silentId)
      silentId = null
      onChallengeVisible()
      visibleId = window.turnstile.render(challengeContainer, {
        sitekey: siteKey,
        size: 'flexible',
        appearance: 'always',
        'response-field': false,
        callback: succeed,
        'error-callback': fail,
        'timeout-callback': fail,
        'unsupported-callback': fail,
      })
    }

    onCancel(fail)

    silentId = window.turnstile.render(silentContainer, {
      sitekey: siteKey,
      size: 'flexible',
      appearance: 'interaction-only',
      execution: 'execute',
      'response-field': false,
      callback: succeed,
      'error-callback': showChallenge,
      'timeout-callback': showChallenge,
      'unsupported-callback': showChallenge,
    })
    emit('silent-render')
    window.turnstile.execute(silentId)
    watchdog = setTimeout(showChallenge, timeoutMs)
  })
}
