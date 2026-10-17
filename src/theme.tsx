// Shared theme primitives for the two standalone HTML documents (app shell in
// layout.tsx and the privacy page). Single source of truth for the palette so
// the two <head>s cannot drift.

// Blocking script: set html.light + theme-color before first paint (no FOUC).
// Reads localStorage first, falls back to prefers-color-scheme on first visit.
export const THEME_ANTIFLASH = `(function(){try{var t=localStorage.getItem('theme');if(!t)t=matchMedia('(prefers-color-scheme: light)').matches?'light':'dark';if(t==='light')document.documentElement.classList.add('light');var m=document.querySelector('meta[name=theme-color]');if(m)m.setAttribute('content',t==='light'?'#f5f3e9':'#222722')}catch(e){}})()`

// Blocking script: set html.large before first paint if the saved font size is
// large (no FOUC). Mirrors THEME_ANTIFLASH; app shell only.
export const FONT_SIZE_ANTIFLASH = `(function(){try{if(localStorage.getItem('fontSize')==='large')document.documentElement.classList.add('large')}catch(e){}})()`

// Tailwind CDN colour tokens backed by CSS vars (space-separated RGB channels so
// the `<alpha-value>` opacity syntax keeps working, e.g. text-fg/50).
export const THEME_CONFIG = `tailwind.config = {
  theme: { extend: { fontFamily: { sans: ['Atkinson Hyperlegible Next', 'sans-serif'] }, colors: {
    bg: 'rgb(var(--bg) / <alpha-value>)',
    surface: 'rgb(var(--surface) / <alpha-value>)',
    fg: 'rgb(var(--fg) / <alpha-value>)',
    muted: 'rgb(var(--muted) / <alpha-value>)',
    accent: 'rgb(var(--accent) / <alpha-value>)',
  }}}
}`

// The kitchen workspace palette, shared by the app and privacy page.
export const THEME_VARS = `
:root {
  color-scheme: dark;
  --bg: 34 39 34;
  --surface: 44 51 44;
  --fg: 244 244 233;
  --muted: 184 196 181;
  --accent: 232 196 107;
  --on-accent: 36 41 31;
  --soft: 54 63 50;
  --line: 86 96 78;
  --danger: 255 169 157;
}
html.light {
  color-scheme: light;
  --bg: 245 243 233;
  --surface: 255 253 247;
  --fg: 37 46 36;
  --muted: 92 104 85;
  --accent: 75 96 48;
  --on-accent: 255 253 247;
  --soft: 231 234 218;
  --line: 190 197 176;
  --danger: 164 45 35;
}`
