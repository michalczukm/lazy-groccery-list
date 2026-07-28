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
