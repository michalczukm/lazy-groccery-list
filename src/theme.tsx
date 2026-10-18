// Apply existing app preferences before first paint. Colors come from @lazy/theme.
export const THEME_ANTIFLASH = `(function(){var t=matchMedia('(prefers-color-scheme: light)').matches?'light':'dark';try{var s=localStorage.getItem('theme');if(s==='light'||s==='dark')t=s}catch(e){}document.documentElement.dataset.lazyTheme=t;var m=document.querySelector('meta[name=theme-color]');if(m)m.setAttribute('content',getComputedStyle(document.documentElement).getPropertyValue('--lazy-color-bg').trim())})()`

export const FONT_SIZE_ANTIFLASH = `(function(){try{if(localStorage.getItem('fontSize')==='large')document.documentElement.classList.add('large')}catch(e){}})()`

export const FONT_SIZE_CSS = 'html.large { zoom: 1.15; }'

// Keep existing Tailwind opacity utilities while using complete shared CSS colors.
const colorRoles = {
  bg: 'bg',
  surface: 'surface',
  fg: 'ink',
  muted: 'muted',
  accent: 'accent',
  danger: 'error',
}

export const THEME_CONFIG = `tailwind.config = ${JSON.stringify({
  theme: {
    extend: {
      fontFamily: { sans: ['var(--lazy-font-family)'] },
      colors: Object.fromEntries(
        Object.entries(colorRoles).map(([name, role]) => [
          name,
          `color-mix(in srgb, var(--lazy-color-${role}) calc(<alpha-value> * 100%), transparent)`,
        ]),
      ),
    },
  },
})}`
