// Minimal service worker: skip waiting on install, claim clients and clear old caches on activate.

// The WebWorker lib types self as WorkerGlobalScope (no skipWaiting/clients); retype to ServiceWorkerGlobalScope. The any hop is the standard JSDoc idiom for this — do not "tidy" it away.
/** @type {ServiceWorkerGlobalScope} */
const sw = /** @type {any} */ (self)

sw.addEventListener('install', () => sw.skipWaiting())

/**
 * On activate, delete all existing caches and take control of open clients.
 * @param {ExtendableEvent} e - The activate lifecycle event.
 * @returns {void}
 */
sw.addEventListener('activate', e =>
  e.waitUntil(
    caches
      .keys()
      .then(keys => Promise.all(keys.map(k => caches.delete(k))))
      .then(() => sw.clients.claim()),
  ),
)
