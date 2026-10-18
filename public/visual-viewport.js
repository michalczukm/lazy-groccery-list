/**
 * @param {HTMLElement} overlay
 * @param {VisualViewport} viewport
 * @returns {() => void}
 */
export function trackVisualViewport(overlay, viewport) {
  const previous = {
    top: overlay.style.top,
    height: overlay.style.height,
    bottom: overlay.style.bottom,
  }

  function update() {
    overlay.style.top = `${viewport.offsetTop}px`
    overlay.style.height = `${viewport.height}px`
    overlay.style.bottom = 'auto'
  }

  viewport.addEventListener('resize', update)
  viewport.addEventListener('scroll', update)
  update()

  return () => {
    viewport.removeEventListener('resize', update)
    viewport.removeEventListener('scroll', update)
    overlay.style.top = previous.top
    overlay.style.height = previous.height
    overlay.style.bottom = previous.bottom
  }
}
