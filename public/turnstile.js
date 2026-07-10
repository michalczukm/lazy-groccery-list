/** @returns {Promise<void>} */
function waitForTurnstile() {
  return new Promise(resolve => {
    if (window.turnstile) return resolve()
    const id = setInterval(() => {
      if (window.turnstile) {
        clearInterval(id)
        resolve()
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
  } = hooks

  await waitForTurnstile()

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
    window.turnstile.execute(silentId)
    watchdog = setTimeout(showChallenge, timeoutMs)
  })
}
