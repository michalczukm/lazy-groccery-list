import { describe, expect, it, vi } from 'vitest'
import { checkPreviewAi } from '../scripts/check-preview-ai.js'

describe('checkPreviewAi', () => {
  it('posts the smoke-test text and accepts a response containing a URL', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ url: 'https://preview.example/list/123' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    )

    await expect(checkPreviewAi('https://preview.example/', fetchMock)).resolves.toEqual({
      url: 'https://preview.example/list/123',
    })
    expect(fetchMock).toHaveBeenCalledWith('https://preview.example/api/integrations/categorize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: 'mleko\nchleb' }),
    })
  })

  it('rejects a non-2xx response', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 502 }))

    await expect(checkPreviewAi('https://preview.example', fetchMock)).rejects.toThrow(
      'Preview AI check failed with HTTP 502',
    )
  })

  it('rejects invalid JSON', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('not json', { status: 200 }))

    await expect(checkPreviewAi('https://preview.example', fetchMock)).rejects.toThrow(
      'Preview AI check returned invalid JSON',
    )
  })

  it('rejects a JSON body without a string URL', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ url: 123 }), { status: 200 }))

    await expect(checkPreviewAi('https://preview.example', fetchMock)).rejects.toThrow(
      'Preview AI check returned an invalid body',
    )
  })
})
