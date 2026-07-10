// Ambient declarations for browser globals used by public/*.js but not imported,
// plus shared @typedefs for the app's data shapes (referenced from JSDoc).

export {} // make this a module so `declare global` augments the true global scope under Bundler resolution

declare global {
  /** A single shopping-list item. */
  interface Item {
    name: string
    checked: boolean
  }

  /** A category grouping items, with collapse UI state. */
  interface Category {
    name: string
    collapsed: boolean
    manualExpand: boolean
    items: Item[]
  }

  /** A full shopping list as persisted in IndexedDB. */
  interface ShoppingListData {
    id: number
    title: string
    date: number
    saved: boolean
    categories: Category[]
  }

  /** A single item inside a template (name only — no checked/UI state). */
  interface TemplateItem {
    name: string
  }

  /** A category inside a template. */
  interface TemplateCategory {
    name: string
    items: TemplateItem[]
  }

  /** A saved list template (no checked/collapse state). */
  interface Template {
    id: number
    date: number
    name: string
    categories: TemplateCategory[]
  }

  /** Minimal htmx surface used by app.js. */
  interface Htmx {
    ajax(method: string, url: string, opts: { target: string; swap: string }): Promise<void>
  }

  /** Options accepted by turnstile.render(). */
  interface TurnstileRenderOptions {
    sitekey: string
    size?: 'normal' | 'flexible' | 'compact'
    appearance?: 'always' | 'execute' | 'interaction-only'
    execution?: 'render' | 'execute'
    'response-field'?: boolean
    callback?: (token: string) => void
    'error-callback'?: (code?: string) => void
    'timeout-callback'?: () => void
    'unsupported-callback'?: () => void
  }

  /** Cloudflare Turnstile global surface used by turnstile.js. */
  interface Turnstile {
    render(container: string, opts: TurnstileRenderOptions): string
    remove(id: string): void
    execute(id: string): void
  }

  const htmx: Htmx
  interface Window {
    App: Record<string, (...args: any[]) => unknown>
    turnstile: Turnstile
    __TURNSTILE_SITE_KEY__: string
  }
}
