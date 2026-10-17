import { describe, expect, it } from 'vitest'
import { runInNewContext } from 'node:vm'
import { THEME_ANTIFLASH, FONT_SIZE_ANTIFLASH } from '../src/theme'

function bootTheme(saved, systemLight, storageBlocked = false) {
  const root = { dataset: {}, classList: new Set() }
  const meta = { setAttribute: (_, value) => (meta.content = value) }
  runInNewContext(THEME_ANTIFLASH + ';' + FONT_SIZE_ANTIFLASH, {
    document: { documentElement: root, querySelector: () => meta },
    localStorage: {
      getItem: key => {
        if (storageBlocked) throw new Error('Storage unavailable')
        return key === 'theme' ? saved : 'large'
      },
    },
    matchMedia: () => ({ matches: systemLight }),
    getComputedStyle: () => ({ getPropertyValue: () => '  shared-background  ' }),
  })
  return { root, meta }
}

describe('shared theme preference migration', () => {
  it.each([
    ['dark', true, 'dark'],
    ['light', false, 'light'],
    [null, true, 'light'],
    [null, false, 'dark'],
    ['invalid', true, 'light'],
  ])('preserves saved %s with system light=%s', (saved, systemLight, expected) => {
    const { root, meta } = bootTheme(saved, systemLight)
    expect(root.dataset.lazyTheme).toBe(expected)
    expect(root.classList.has('large')).toBe(true)
    expect(meta.content).toBe('shared-background')
  })

  it('uses the system preference when storage is unavailable', () => {
    expect(bootTheme(null, true, true).root.dataset.lazyTheme).toBe('light')
  })
})
