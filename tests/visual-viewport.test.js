import { describe, expect, it, vi } from 'vitest'

async function loadController() {
  return import('../public/visual-viewport.js').catch(() => ({}))
}

function createVisualViewport() {
  const listeners = new Map()
  return {
    offsetTop: 120,
    height: 520,
    addEventListener: vi.fn((type, listener) => listeners.set(type, listener)),
    removeEventListener: vi.fn((type, listener) => {
      if (listeners.get(type) === listener) listeners.delete(type)
    }),
    dispatch(type) {
      listeners.get(type)?.()
    },
  }
}

function createOverlay() {
  return { style: { top: '', height: '', bottom: '' } }
}

describe('trackVisualViewport', () => {
  it('sizes and positions an overlay within the visible viewport', async () => {
    const { trackVisualViewport } = await loadController()
    expect(trackVisualViewport).toBeTypeOf('function')
    const overlay = createOverlay()
    const viewport = createVisualViewport()

    trackVisualViewport(overlay, viewport)

    expect(overlay.style.top).toBe('120px')
    expect(overlay.style.height).toBe('520px')
    expect(overlay.style.bottom).toBe('auto')
  })

  it.each(['resize', 'scroll'])('updates the overlay on visual viewport %s', async event => {
    const { trackVisualViewport } = await loadController()
    expect(trackVisualViewport).toBeTypeOf('function')
    const overlay = createOverlay()
    const viewport = createVisualViewport()
    trackVisualViewport(overlay, viewport)

    viewport.offsetTop = 48
    viewport.height = 360
    viewport.dispatch(event)

    expect(overlay.style.top).toBe('48px')
    expect(overlay.style.height).toBe('360px')
  })

  it('removes listeners and restores inline positioning during cleanup', async () => {
    const { trackVisualViewport } = await loadController()
    expect(trackVisualViewport).toBeTypeOf('function')
    const overlay = createOverlay()
    overlay.style.top = '10px'
    overlay.style.height = '90px'
    overlay.style.bottom = '5px'
    const viewport = createVisualViewport()

    const cleanup = trackVisualViewport(overlay, viewport)
    cleanup()

    expect(viewport.removeEventListener).toHaveBeenCalledWith('resize', expect.any(Function))
    expect(viewport.removeEventListener).toHaveBeenCalledWith('scroll', expect.any(Function))
    expect(overlay.style.top).toBe('10px')
    expect(overlay.style.height).toBe('90px')
    expect(overlay.style.bottom).toBe('5px')

    viewport.offsetTop = 200
    viewport.height = 240
    viewport.dispatch('resize')
    expect(overlay.style.top).toBe('10px')
    expect(overlay.style.height).toBe('90px')
  })
})
