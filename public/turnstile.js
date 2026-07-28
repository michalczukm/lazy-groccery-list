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
 *   onChallengeError?: (retry: () => void) => void
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
    onChallengeError = () => {},
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
      if (id === null) return
      try {
        window.turnstile.remove(id)
      } catch {
        // widget already torn down by Turnstile itself
      }
    }

    /** @param {string} container */
    const wipe = container => {
      globalThis.document?.querySelector(container)?.replaceChildren()
    }

    /**
     * @param {'silent' | 'challenge'} stage
     * @param {string} container
     * @param {TurnstileRenderOptions} opts
     * @returns {string | null}
     */
    const safeRender = (stage, container, opts) => {
      wipe(container)
      /** @type {string | undefined} */
      let id
      try {
        id = window.turnstile.render(container, opts)
      } catch (err) {
        emit(`${stage}-render-failed`, {
          reason: 'threw',
          message: err instanceof Error ? err.message : String(err),
        })
        return null
      }
      if (!id) {
        emit(`${stage}-render-failed`, { reason: 'empty' })
        return null
      }
      emit(`${stage}-render`)
      return id
    }

    const cleanup = () => {
      clearWatchdog()
      remove(silentId)
      silentId = null
      remove(visibleId)
      visibleId = null
      wipe(silentContainer)
      wipe(challengeContainer)
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

    const cancel = () => {
      if (settled) return
      settled = true
      emit('cancelled')
      cleanup()
      reject(new Error('captcha-failed'))
    }

    const enterErrorState = () => {
      if (settled) return
      remove(visibleId)
      visibleId = null
      wipe(challengeContainer)
      onChallengeError(retry)
    }

    /**
     * @param {string} reason
     * @param {Record<string, unknown>} [detail]
     */
    const challengeFailed = (reason, detail = {}) => {
      if (settled) return
      emit('challenge-error', { reason, ...detail })
      enterErrorState()
    }

    const onExpired = () => {
      if (settled) return
      emit('challenge-expired')
      if (visibleId === null) {
        enterErrorState()
        return
      }
      try {
        window.turnstile.reset(visibleId)
        emit('challenge-reset')
      } catch (err) {
        challengeFailed('reset-failed', {
          message: err instanceof Error ? err.message : String(err),
        })
      }
    }

    const renderChallenge = () => {
      if (settled) return
      remove(visibleId)
      visibleId = safeRender('challenge', challengeContainer, {
        sitekey: siteKey,
        size: 'flexible',
        appearance: 'always',
        'response-field': false,
        callback: succeed,
        'error-callback': code => challengeFailed('error', { code }),
        'timeout-callback': () => challengeFailed('timeout'),
        'unsupported-callback': () => challengeFailed('unsupported'),
        'expired-callback': onExpired,
      })
      if (visibleId === null) enterErrorState()
    }

    const retry = () => {
      if (settled) return
      emit('challenge-retry')
      renderChallenge()
    }

    /** @param {string} reason */
    const showChallenge = reason => {
      if (settled || challengeShown) return
      challengeShown = true
      clearWatchdog()
      remove(silentId)
      silentId = null
      wipe(silentContainer)
      emit('silent-fallback', { reason })
      onChallengeVisible()
      renderChallenge()
    }

    onCancel(cancel)

    silentId = safeRender('silent', silentContainer, {
      sitekey: siteKey,
      size: 'flexible',
      appearance: 'interaction-only',
      execution: 'execute',
      'response-field': false,
      callback: succeed,
      'error-callback': code => showChallenge(`error:${code ?? ''}`),
      'timeout-callback': () => showChallenge('timeout'),
      'unsupported-callback': () => showChallenge('unsupported'),
    })
    if (silentId === null) {
      showChallenge('render-failed')
    } else {
      window.turnstile.execute(silentId)
      watchdog = setTimeout(() => showChallenge('watchdog'), timeoutMs)
    }
  })
}
