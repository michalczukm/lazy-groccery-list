import { useEffect, useState } from 'preact/hooks'
import { html } from './html.js'
import { DotsIcon, Icon } from './icons.js'

/**
 * @param {{ items: Array<{ icon: string, label: string, onClick: () => void }> }} props
 * @returns {import('preact').VNode}
 */
export function Meatballs({ items }) {
  const [open, setOpen] = useState(false)
  useEffect(() => {
    if (!open) return
    /** @param {KeyboardEvent} e */
    const onKey = e => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])
  return html` <div class="relative">
    <button
      class="icon-button text-muted bg-transparent border-none"
      onClick=${() => setOpen(o => !o)}
      title="Więcej"
      aria-label="Więcej opcji"
      aria-haspopup="menu"
      aria-expanded=${open}
    >
      <${DotsIcon} />
    </button>
    ${open &&
    html`<div class="fixed inset-0 z-40" onClick=${() => setOpen(false)} />
      <div
        class="action-menu absolute right-0 top-full mt-1 z-50 bg-surface border border-fg/10 rounded-xl py-1 shadow-lg"
        role="menu"
      >
        ${items.map(
          (it, i) => html`
            <button
              key=${i}
              class="flex items-center gap-2.5 w-full text-left px-4 py-2.5 text-[14px] text-fg/85 bg-transparent border-none cursor-pointer active:bg-fg/5"
              role="menuitem"
              onClick=${() => {
                setOpen(false)
                it.onClick()
              }}
            >
              <${Icon} name=${it.icon} /><span>${it.label}</span>
            </button>
          `,
        )}
      </div>`}
  </div>`
}
