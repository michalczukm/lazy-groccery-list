/**
 * Resolve once the Cloudflare Turnstile global script has loaded.
 * @returns {Promise<void>} Resolves when `window.turnstile` is available.
 */
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
 * Render and run an invisible Turnstile challenge, resolving with its token.
 * @param {string} siteKey - Turnstile site key.
 * @param {string} [containerSelector] - CSS selector for the widget container. Defaults to `'#turnstile-widget'`.
 * @returns {Promise<string>} The Turnstile response token.
 * @throws {Error} If the Turnstile challenge errors.
 */
export async function executeTurnstile(siteKey, containerSelector = '#turnstile-widget') {
  await waitForTurnstile()
  return new Promise((resolve, reject) => {
    const id = window.turnstile.render(containerSelector, {
      sitekey: siteKey,
      size: 'invisible',
      'response-field': false,
      callback: token => {
        window.turnstile.remove(id)
        resolve(token)
      },
      'error-callback': () => {
        window.turnstile.remove(id)
        reject(new Error('Turnstile error'))
      },
    })
    window.turnstile.execute(id)
  })
}
