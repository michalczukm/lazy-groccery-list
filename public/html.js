import { h } from 'preact'
import htm from 'htm'

// htm.bind(h) types its return as `VNode | VNode[]`; every app template has a single
// root element, so we narrow to `VNode`. The cast is the standard htm/Preact idiom.
export const html =
  /** @type {(strings: TemplateStringsArray, ...values: unknown[]) => import('preact').VNode} */ (
    htm.bind(h)
  )
