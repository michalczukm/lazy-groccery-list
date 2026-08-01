export const POSTHOG_INGEST_HOST = 'https://eu.i.posthog.com'
export const POSTHOG_ASSET_HOST = 'https://eu-assets.i.posthog.com'
export const PROXY_PREFIX = '/basket'

const ASSET_PATHS = ['/static/', '/array/']
const ASSET_CACHE_TTL_SEC = 3600

export type PosthogEnv = {
  POSTHOG_KEY?: string
  POSTHOG_HOST?: string
}

export const resolveUpstream = (pathname: string, search: string, ingestHost: string): string => {
  const path = pathname.slice(PROXY_PREFIX.length) || '/'
  const isAsset = ASSET_PATHS.some(prefix => path.startsWith(prefix))
  return `${isAsset ? POSTHOG_ASSET_HOST : ingestHost}${path}${search}`
}

export const proxyPosthog = async (
  request: Request,
  env: PosthogEnv,
  fetchImpl: typeof fetch = fetch,
): Promise<Response> => {
  if (!env.POSTHOG_KEY) return new Response(null, { status: 404 })

  const url = new URL(request.url)
  const target = resolveUpstream(url.pathname, url.search, env.POSTHOG_HOST ?? POSTHOG_INGEST_HOST)
  const isAsset = target.startsWith(POSTHOG_ASSET_HOST)

  const headers = new Headers(request.headers)
  // Our signed session cookie must never reach a third party.
  headers.delete('cookie')
  // Nor must the caller's real IP — PostHog only ever sees our own server's address.
  headers.delete('cf-connecting-ip')
  headers.delete('x-forwarded-for')
  headers.delete('x-real-ip')
  // Referer can carry the share payload (?state=... lives in the query string) —
  // before_send runs client-side and can't reach HTTP headers, so this must be dropped here.
  headers.delete('referer')
  headers.set('host', new URL(target).host)

  const hasBody = request.method !== 'GET' && request.method !== 'HEAD'
  const upstream = new Request(target, {
    method: request.method,
    headers,
    body: hasBody ? request.body : undefined,
  })

  return isAsset
    ? fetchImpl(upstream, { cf: { cacheEverything: true, cacheTtl: ASSET_CACHE_TTL_SEC } })
    : fetchImpl(upstream)
}

const CAPTURE_PATH = '/i/v0/e'
const ANONYMOUS_SERVER_ID = 'anonymous-server'
const DISTINCT_ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/

export type ServerEvent = {
  event: string
  distinctId: string
  properties?: Record<string, string | number | boolean>
}

export const distinctIdFrom = (request: Request): string => {
  const header = request.headers.get('X-POSTHOG-DISTINCT-ID')
  return header && DISTINCT_ID_PATTERN.test(header) ? header : ANONYMOUS_SERVER_ID
}

export const captureServer = async (
  env: PosthogEnv,
  ev: ServerEvent,
  fetchImpl: typeof fetch = fetch,
): Promise<void> => {
  if (!env.POSTHOG_KEY) return

  const host = env.POSTHOG_HOST ?? POSTHOG_INGEST_HOST
  try {
    await fetchImpl(`${host}${CAPTURE_PATH}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: env.POSTHOG_KEY,
        event: ev.event,
        distinct_id: ev.distinctId,
        properties: { ...ev.properties, $process_person_profile: false },
        timestamp: new Date().toISOString(),
      }),
    })
  } catch {
    // Analytics must never turn a working request into a failed one.
  }
}
