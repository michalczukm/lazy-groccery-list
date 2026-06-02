export const isSameOrigin = (req: Request): boolean => {
  const origin = req.headers.get('Origin')
  if (!origin) return false
  return origin === new URL(req.url).origin
}
