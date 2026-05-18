export async function encodeState(list) {
  const payload = {
    title: list.title,
    date: list.date,
    categories: list.categories.map(c => ({
      name: c.name,
      emoji: c.emoji,
      items: c.items.map(i => ({ name: i.name, checked: i.checked })),
    })),
  }
  const stream = new CompressionStream('gzip')
  const writer = stream.writable.getWriter()
  const bufPromise = new Response(stream.readable).arrayBuffer()
  await writer.write(new TextEncoder().encode(JSON.stringify(payload)))
  await writer.close()
  const buf = await bufPromise
  const binary = Array.from(new Uint8Array(buf), b => String.fromCharCode(b)).join('')
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

export async function decodeState(str) {
  let bytes
  try {
    const binary = atob(str.replace(/-/g, '+').replace(/_/g, '/'))
    bytes = Uint8Array.from(binary, c => c.charCodeAt(0))
  } catch {
    throw new Error('decodeState: invalid base64url input')
  }
  if (bytes.byteLength > 200 * 1024) throw new Error('decodeState: input too large')
  const stream = new DecompressionStream('gzip')
  const writer = stream.writable.getWriter()
  const bufPromise = new Response(stream.readable).arrayBuffer()
  await writer.write(bytes)
  await writer.close()
  const buf = await bufPromise
  if (buf.byteLength > 1024 * 1024) throw new Error('decodeState: payload too large')
  const payload = JSON.parse(new TextDecoder().decode(buf))
  if (!Array.isArray(payload?.categories)) throw new Error('decodeState: invalid payload shape')
  return payload
}
