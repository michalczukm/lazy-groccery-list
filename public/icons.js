import { html } from './html.js'

/** @returns {import('preact').VNode} */
export function PlusIcon() {
  return html`<svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
  >
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </svg>`
}

/** @returns {import('preact').VNode} */
export function CheckIcon() {
  return html`<svg width="11" height="8" viewBox="0 0 13 10" fill="none">
    <path
      d="M1 5L5 9L12 1"
      stroke="#0f0f1a"
      stroke-width="2.5"
      stroke-linecap="round"
      stroke-linejoin="round"
    />
  </svg>`
}

/** @returns {import('preact').VNode} */
export function DotsIcon() {
  return html`<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
    <circle cx="12" cy="5" r="2" />
    <circle cx="12" cy="12" r="2" />
    <circle cx="12" cy="19" r="2" />
  </svg>`
}
