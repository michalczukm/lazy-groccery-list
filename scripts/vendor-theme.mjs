import { cp, mkdir, rm } from 'node:fs/promises'

const source = new URL('../node_modules/@lazy/theme/', import.meta.url)
const destination = new URL('../public/vendor/lazy-theme/', import.meta.url)

await rm(destination, { recursive: true, force: true })
await mkdir(destination, { recursive: true })
for (const entry of ['theme.css', 'fonts.css', 'css', 'fonts', 'LICENSE']) {
  await cp(new URL(entry, source), new URL(entry, destination), { recursive: true })
}
