import { shareSecretFrom, sanitizeProperties, bucketSize } from './analytics-sanitize.js'

const PROXY = '/basket'
const UI_HOST = 'https://eu.posthog.com'
const ASSET_PATH = `${PROXY}/static/array.js`
const MAX_BUFFERED = 20

/** @returns {Promise<void>} */
const loadScript = () =>
  new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = ASSET_PATH
    script.async = true
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('posthog script blocked'))
    document.head.appendChild(script)
  })

/**
 * @returns {{ flush: () => void, dispose: () => void }}
 */
const installBootHandlers = () => {
  /** @type {unknown[]} */
  const pending = []

  /** @param {ErrorEvent} event */
  const onError = event => {
    if (pending.length < MAX_BUFFERED) pending.push(event.error ?? new Error(event.message))
  }

  /** @param {PromiseRejectionEvent} event */
  const onRejection = event => {
    if (pending.length < MAX_BUFFERED) pending.push(event.reason)
  }

  window.addEventListener('error', onError)
  window.addEventListener('unhandledrejection', onRejection)

  const dispose = () => {
    window.removeEventListener('error', onError)
    window.removeEventListener('unhandledrejection', onRejection)
  }

  return {
    dispose,
    flush: () => {
      dispose()
      for (const error of pending) window.posthog?.captureException(error)
      pending.length = 0
    },
  }
}

const start = async () => {
  const key = window.__POSTHOG_KEY__
  if (!key) return

  const shareSecret = shareSecretFrom(location.search)
  const boot = installBootHandlers()

  try {
    await loadScript()
  } catch {
    boot.dispose()
    return
  }

  window.posthog?.init(key, {
    api_host: PROXY,
    ui_host: UI_HOST,
    persistence: 'localStorage',
    autocapture: false,
    capture_heatmaps: false,
    disable_session_recording: true,
    disable_surveys: true,
    capture_pageview: 'history_change',
    capture_exceptions: {
      capture_unhandled_errors: true,
      capture_unhandled_rejections: true,
      capture_console_errors: false,
    },
    capture_performance: {
      web_vitals: true,
      web_vitals_allowed_metrics: ['LCP', 'CLS', 'FCP', 'INP'],
    },
    respect_dnt: true,
    advanced_disable_flags: true,
    tracing_headers: [location.host],
    before_send: event => {
      if (!event) return null
      const properties = sanitizeProperties(event.properties ?? {}, shareSecret)
      if (properties === null) return null
      return { ...event, properties }
    },
  })

  window.Analytics = {
    setListSize: count => window.posthog?.register({ list_size_bucket: bucketSize(count) }),
  }

  boot.flush()
}

void start()
