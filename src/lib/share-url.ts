import type { Category } from './mistral'

export type ShareList = {
  title: string
  date: number
  categories: Array<{ name: string; items: Array<{ name: string; checked: boolean }> }>
}

const bytesToBase64Url = (bytes: Uint8Array): string => {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

export const encodeShareState = async (list: ShareList): Promise<string> => {
  const payload = {
    title: list.title,
    date: list.date,
    categories: list.categories.map(c => ({
      name: c.name,
      items: c.items.map(i => ({ name: i.name, checked: i.checked })),
    })),
  }
  const stream = new CompressionStream('gzip')
  const writer = stream.writable.getWriter()
  const bufPromise = new Response(stream.readable).arrayBuffer()
  await writer.write(new TextEncoder().encode(JSON.stringify(payload)))
  await writer.close()
  return bytesToBase64Url(new Uint8Array(await bufPromise))
}

export const listFromCategories = (categories: Category[], now = Date.now()): ShareList => ({
  title: `Zakupy ${new Date(now).toLocaleDateString('pl-PL', { day: 'numeric', month: 'short' })}`,
  date: now,
  categories: categories.map(c => ({
    name: c.name,
    items: c.items.map(name => ({ name, checked: false })),
  })),
})

export const shareUrlFor = async (origin: string, list: ShareList): Promise<string> => {
  const url = new URL('/', origin)
  url.searchParams.set('state', await encodeShareState(list))
  return url.toString()
}
