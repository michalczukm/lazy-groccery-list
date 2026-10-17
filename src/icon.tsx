import type { FC } from 'hono/jsx'

export const Icon: FC<{ name: string; class?: string }> = ({ name, class: className = '' }) => (
  <svg class={`icon ${className}`} width="22" height="22" aria-hidden="true" focusable="false">
    <use href={`/icons.svg#${name}`} />
  </svg>
)
