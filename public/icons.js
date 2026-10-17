import { html } from './html.js'

/**
 * @param {{ name: string, className?: string }} props
 * @returns {import('preact').VNode}
 */
export function Icon({ name, className = '' }) {
  return html`<svg
    class=${`icon ${className}`}
    width="22"
    height="22"
    aria-hidden="true"
    focusable="false"
  >
    <use href=${`/icons.svg#${name}`} />
  </svg>`
}

/** @returns {import('preact').VNode} */
export function PlusIcon() {
  return html`<${Icon} name="plus" />`
}

/** @returns {import('preact').VNode} */
export function DotsIcon() {
  return html`<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
    <circle cx="12" cy="5" r="2" />
    <circle cx="12" cy="12" r="2" />
    <circle cx="12" cy="19" r="2" />
  </svg>`
}

/** @type {Record<string, string>} */
const CATEGORY_ICONS = {
  nabiał: 'milk',
  'mięso i wędliny': 'meat',
  warzywa: 'carrot',
  owoce: 'apple',
  pieczywo: 'bread',
  napoje: 'cup',
  'suche produkty': 'wheat',
  'przyprawy i sosy': 'salt',
  'gotowe dania': 'meal',
  'chemia i higiena': 'bottle',
  inne: 'bag',
}

/**
 * @param {{ name: string }} props
 * @returns {import('preact').VNode}
 */
export function CategoryIcon({ name }) {
  const icon = Object.hasOwn(CATEGORY_ICONS, name) ? CATEGORY_ICONS[name] : 'bag'
  return html`<${Icon} name=${icon} className="category-icon" />`
}
