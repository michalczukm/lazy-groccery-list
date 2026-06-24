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
 * @param {string} siteKey
 * @param {string} [containerSelector]
 * @returns {Promise<string>}
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
