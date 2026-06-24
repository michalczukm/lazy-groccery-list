// Ambient declarations for browser globals used by public/*.js but not imported,
// plus shared @typedefs for the app's data shapes (referenced from JSDoc).

export {} // make this a module-free ambient file under Bundler resolution

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

  /** Minimal htmx surface used by app.js. */
  interface Htmx {
    ajax(method: string, url: string, opts: { target: string; swap: string }): Promise<void>
  }

  /** Cloudflare Turnstile global surface used by turnstile.js. */
  interface Turnstile {
    render(
      container: string,
      opts: {
        sitekey: string
        size: string
        'response-field': boolean
        callback: (token: string) => void
        'error-callback': () => void
      },
    ): string
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
