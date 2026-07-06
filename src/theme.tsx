// Shared theme primitives for the two standalone HTML documents (app shell in
// layout.tsx and the privacy page). Single source of truth for the palette so
// the two <head>s cannot drift.

// Blocking script: set html.light + theme-color before first paint (no FOUC).
// Reads localStorage first, falls back to prefers-color-scheme on first visit.
export const THEME_ANTIFLASH = `(function(){try{var t=localStorage.getItem('theme');if(!t)t=matchMedia('(prefers-color-scheme: light)').matches?'light':'dark';if(t==='light')document.documentElement.classList.add('light');var m=document.querySelector('meta[name=theme-color]');if(m)m.setAttribute('content',t==='light'?'#ffffff':'#1a1a2e')}catch(e){}})()`

// Tailwind CDN colour tokens backed by CSS vars (space-separated RGB channels so
// the `<alpha-value>` opacity syntax keeps working, e.g. text-fg/50).
export const THEME_CONFIG = `tailwind.config = {
  theme: { extend: { colors: {
    bg: 'rgb(var(--bg) / <alpha-value>)',
    surface: 'rgb(var(--surface) / <alpha-value>)',
    fg: 'rgb(var(--fg) / <alpha-value>)',
    muted: 'rgb(var(--muted) / <alpha-value>)',
    accent: 'rgb(var(--accent) / <alpha-value>)',
    'accent-pink': 'rgb(var(--accent-pink) / <alpha-value>)',
  }}}
}`

// Theme variable blocks: :root = dark defaults, html.light = light overrides.
export const THEME_VARS = `
:root {
  --bg: 15 15 26;
  --surface: 26 26 46;
  --fg: 255 255 255;
  --muted: 138 138 152;
  --accent: 168 237 234;
  --accent-pink: 254 214 227;
}
html.light {
  --bg: 245 245 247;
  --surface: 255 255 255;
  --fg: 17 17 20;
  --muted: 107 107 114;
  --accent: 15 118 110;
  --accent-pink: 214 92 141;
}`
