# Testing the Share Feature

## What it does

Share button (↑ icon, top-right of list view) encodes the current list as a gzip+base64url URL param (`?state=...`). On load, `handleSharedState` decodes it and renders the list without requiring a Mistral key.

## Manual test steps

### 1. Generate a list

1. Open the app, enter items in the input view, click "Generuj listę".
2. Wait for the list to render (categories visible with checkboxes).

### 2. Share button

3. Click the ↑ share button next to the item counter.
   - Desktop Chrome/Firefox (no `navigator.share`): toast "Link skopiowany 🔗" appears, URL is in clipboard.
   - Mobile / Chrome with Web Share API: native share sheet opens.
4. Copy the URL from clipboard (or from the share sheet).

### 3. Load shared URL

5. Open the URL (`http://<host>/?state=<encoded>`) in a new tab or incognito window.
6. The list should render immediately — same title, categories, and items.
7. The URL bar should revert to `/` after load (`history.replaceState`).
8. The list is persisted to IndexedDB (`saved: true`) on import, so it survives a
   reload and item toggles auto-save — it does not flush after sharing (issue #31).

## Automated testing (Chrome DevTools MCP)

```js
// 1. Intercept clipboard (remove navigator.share to force clipboard path)
Object.defineProperty(navigator, 'share', { value: undefined, configurable: true })
let capturedUrl
navigator.clipboard.writeText = async text => {
  capturedUrl = text
}

// 2. Trigger share button
document
  .querySelector('[title="Udostępnij listę"]')
  ?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))

// 3. Wait ~3s then verify
await new Promise(r => setTimeout(r, 3000))
console.assert(capturedUrl?.includes('?state='), 'URL should contain ?state=')

// 4. Navigate to shared URL
location.href = capturedUrl

// 5. After page load, verify list renders
await new Promise(r => setTimeout(r, 2000))
console.assert(
  document.getElementById('categories-container')?.children.length > 0,
  'List should render',
)
```

## Known bugs fixed (2026-05-07)

| Bug                           | Root cause                                                                                                        | Fix                                                                                                    |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| List not rendering            | `import { html } from 'htm/preact'` resolved to `undefined` due to esm.sh module cache serving CJS default export | Changed to `import htm from 'htm'` + `const html = htm.bind(h)` with separate `"htm"` import map entry |
| `encodeState` deadlocks       | `writer.close()` awaited before readable consumed; `CompressionStream` bacpressure causes hang in Chrome 147      | Start `new Response(stream.readable).arrayBuffer()` before writing, await after close                  |
| `btoa` fails on emoji in list | `new TextDecoder('latin1')` maps bytes 0x80–0x9F to Windows-1252 chars (code points > 255)                        | Replace with `Array.from(new Uint8Array(buf), b => String.fromCharCode(b)).join('')`                   |

## Edge cases to verify

- Empty list: share button should still encode/decode without error.
- Very long list (>100 items): URL may exceed browser limits; current 200 KB compressed input guard covers this.
- Invalid/truncated `?state=`: `decodeState` throws, app shows "Nieprawidłowy link" toast and falls back to normal flow.
- `?state=` with tampered data: same toast, graceful fallback.
