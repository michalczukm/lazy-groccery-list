import { render } from 'preact'
import { useEffect, useRef } from 'preact/hooks'
import { signal } from '@preact/signals'
import confetti from 'canvas-confetti'
import { html } from './html.js'
import { PlusIcon, CheckIcon } from './icons.js'
import { Meatballs } from './meatballs.js'
import { encodeState, decodeState } from './share-state.js'
import { mergeAmendInto } from './merge-amend.js'
import { listToTemplate, templateToList } from './template-shape.js'
import { executeTurnstile } from './turnstile.js'

// Emoji per category name. Keep in sync with CATEGORIES in src/lib/mistral.ts.
/** @type {Record<string, string>} */
const CATEGORY_EMOJI = {
  nabiał: '🥛',
  'mięso i wędliny': '🥩',
  warzywa: '🥦',
  owoce: '🍎',
  pieczywo: '🍞',
  napoje: '🥤',
  'suche produkty': '🌾',
  'przyprawy i sosy': '🧂',
  'gotowe dania': '🍱',
  'chemia i higiena': '🧴',
  inne: '🛒',
}
/**
 * @param {string} name
 * @returns {string}
 */
const emojiFor = name => CATEGORY_EMOJI[name] ?? '📦'

// ── IndexedDB ──────────────────────────────────────────────────────────────────
const DB = (() => {
  /** @type {IDBDatabase} */
  let db
  const open = () =>
    /** @type {Promise<void>} */ (
      new Promise((res, rej) => {
        const r = indexedDB.open('LazyGrocceryList', 2)
        r.onupgradeneeded = e => {
          const d = /** @type {IDBOpenDBRequest} */ (e.target).result
          if (!d.objectStoreNames.contains('lists')) d.createObjectStore('lists', { keyPath: 'id' })
          if (!d.objectStoreNames.contains('templates'))
            d.createObjectStore('templates', { keyPath: 'id' })
        }
        r.onsuccess = e => {
          db = /** @type {IDBOpenDBRequest} */ (e.target).result
          res()
        }
        r.onerror = () => rej(r.error)
      })
    )
  /**
   * @param {string} store
   * @param {IDBTransactionMode} m
   * @returns {IDBObjectStore}
   */
  const tx = (store, m) => db.transaction(store, m).objectStore(store)
  /**
   * @template T
   * @param {IDBRequest<T>} r
   * @returns {Promise<T>}
   */
  const wrap = r =>
    new Promise((res, rej) => {
      r.onsuccess = () => res(r.result)
      r.onerror = () => rej(r.error)
    })
  return {
    init: open,
    /**
     * @param {ShoppingListData} l
     * @returns {Promise<IDBValidKey>}
     */
    save: l => wrap(tx('lists', 'readwrite').put(l)),
    /** @returns {Promise<ShoppingListData[]>} */
    getAll: () =>
      wrap(tx('lists', 'readonly').getAll()).then(a => a.sort((a, b) => b.date - a.date)),
    /**
     * @param {number} id
     * @returns {Promise<undefined>}
     */
    del: id => wrap(tx('lists', 'readwrite').delete(id)),
    /** @returns {Promise<undefined>} */
    clear: () => wrap(tx('lists', 'readwrite').clear()),
    /**
     * @param {Template} t
     * @returns {Promise<IDBValidKey>}
     */
    saveTemplate: t => wrap(tx('templates', 'readwrite').put(t)),
    /** @returns {Promise<Template[]>} */
    getAllTemplates: () =>
      wrap(tx('templates', 'readonly').getAll()).then(a => a.sort((a, b) => b.date - a.date)),
    /**
     * @param {number} id
     * @returns {Promise<undefined>}
     */
    delTemplate: id => wrap(tx('templates', 'readwrite').delete(id)),
  }
})()

// ── State ─────────────────────────────────────────────────────────────────────
/** @type {import('@preact/signals').Signal<ShoppingListData|null>} */
const currentList = signal(/** @type {ShoppingListData|null} */ (null))
let currentView = 'input'

// ── Modal ─────────────────────────────────────────────────────────────────────
function openAmendModal() {
  if (!currentList.value) {
    toast('Brak aktywnej listy')
    return
  }
  const amendElement = /** @type {HTMLInputElement | null} */ (
    document.getElementById('amend-input')
  )
  if (amendElement) amendElement.value = ''
  const overlay = /** @type {HTMLElement} */ (document.getElementById('amend-modal-overlay'))
  overlay.classList.remove('hidden')
  setTimeout(() => amendElement?.focus(), 50)
}
function closeAmendModal() {
  /** @type {HTMLElement} */ (document.getElementById('amend-modal-overlay')).classList.add(
    'hidden',
  )
}
/** @param {MouseEvent} e */
function handleAmendOverlayClick(e) {
  if (/** @type {HTMLElement} */ (e.target).id === 'amend-modal-overlay') closeAmendModal()
}
// ── Routing ───────────────────────────────────────────────────────────────────
function showBottomNav() {
  /** @type {HTMLElement} */ (document.getElementById('bottom-nav')).style.display = ''
}
function showMainApp() {
  /** @type {HTMLElement} */ (document.getElementById('bottom-nav')).style.display = ''
  if (currentView !== 'input') {
    navigateTo('input')
  } else {
    const btn = document.querySelector('[data-view="input"]')
    if (btn) setActiveNav(btn)
    updateHeader('input')
  }
}

// ── Navigation ────────────────────────────────────────────────────────────────
/** @type {Record<string, { title: string, sub: string }>} */
const META = {
  input: { title: '🛒 Lazy List', sub: 'Nowa lista' },
  list: { title: '📋 Lista', sub: '' },
  history: { title: '📚 Historia', sub: 'Poprzednie listy' },
  templates: { title: '📌 Szablony', sub: 'Zapisane szablony' },
}

/**
 * @param {string} name
 * @returns {Promise<void>}
 */
function navigateTo(name) {
  currentView = name
  const btn = document.querySelector(`[data-view="${name}"]`)
  setActiveNav(btn)
  updateHeader(name)
  return htmx.ajax('GET', `/views/${name}`, { target: '#main-content', swap: 'innerHTML' })
}

/** @param {HTMLElement} el */
function handleNavClick(el) {
  const name = /** @type {string} */ (el.dataset.view)
  currentView = name
  setActiveNav(el)
  updateHeader(name)
}

/** @param {Element | null} el */
function setActiveNav(el) {
  document.querySelectorAll('[data-view]').forEach(b => b.classList.remove('active'))
  if (el) el.classList.add('active')
}

/** @param {string} name */
function updateHeader(name) {
  const m = META[name]
  if (!m) return
  const titleEl = document.getElementById('header-title')
  const subEl = document.getElementById('header-sub')
  if (titleEl) titleEl.textContent = m.title
  if (subEl)
    subEl.textContent = name === 'list' && currentList.value ? currentList.value.title : m.sub
}

// ── Server-side AI proxy ─────────────────────────────────────────────────────
async function ensureSession() {
  const token = await executeTurnstile(window.__TURNSTILE_SITE_KEY__)
  const res = await fetch('/api/session', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ turnstileToken: token }),
  })
  if (res.status !== 204) throw new Error('Captcha failed')
}

/**
 * @param {string} rawText
 * @param {boolean} [allowRetry]
 * @returns {Promise<Array<{ name: string, items: string[] }>>}
 */
async function callCategorize(rawText, allowRetry = true) {
  const res = await fetch('/api/categorize', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: rawText }),
  })

  if (res.ok) {
    const data = await res.json()
    if (!Array.isArray(data?.categories)) throw new Error('AI zwróciło niepoprawny format.')
    return data.categories
  }

  const err = await res.json().catch(() => ({}))
  if (res.status === 401 && err.code === 'captcha-required' && allowRetry) {
    await ensureSession()
    return callCategorize(rawText, false)
  }
  if (res.status === 400) throw new Error('Lista pusta lub za długa.')
  if (res.status === 429) throw new Error('Limit zapytań przekroczony. Spróbuj za chwilę.')
  if (res.status === 502) throw new Error('Błąd AI. Spróbuj ponownie.')
  throw new Error('Nieoczekiwany błąd. Spróbuj ponownie.')
}

async function processWithMistral() {
  const raw = /** @type {HTMLInputElement} */ (
    document.getElementById('shopping-input')
  ).value.trim()
  if (!raw) {
    toast('Wpisz listę zakupów 📝')
    return
  }

  setStatus('idle', 'Wysyłam…')
  showLoading('Kategoryzuję listę…')

  try {
    const categories = await callCategorize(raw)

    currentList.value = {
      id: Date.now(),
      title: 'Zakupy ' + fmtDate(Date.now()),
      date: Date.now(),
      saved: true,
      categories: categories
        .filter(c => c.items?.length)
        .map(c => ({
          name: c.name || 'inne',
          collapsed: false,
          manualExpand: false,
          items: c.items.map(n => ({ name: n, checked: false })),
        })),
    }
    await DB.save(currentList.value)

    hideLoading()
    setStatus('ready', 'Gotowe')
    navigateTo('list')
  } catch (e) {
    hideLoading()
    setStatus('error', /** @type {Error} */ (e).message)
    toast(/** @type {Error} */ (e).message, 4000, true)
  }
}

async function amendCurrentList() {
  if (!currentList.value) {
    toast('Brak aktywnej listy')
    return
  }
  const raw = /** @type {HTMLInputElement} */ (document.getElementById('amend-input')).value.trim()
  if (!raw) {
    toast('Wpisz listę zakupów 📝')
    return
  }

  showLoading('Dodaję do listy…')

  try {
    const newCategories = await callCategorize(raw)
    const { categories, added, skipped } = mergeAmendInto(currentList.value, newCategories)

    const updated = { ...currentList.value, categories }
    if (updated.saved) await DB.save(updated)
    currentList.value = updated

    hideLoading()
    closeAmendModal()

    if (added === 0 && skipped === 0) toast('Nic nie dodano')
    else if (added === 0) toast(`Wszystko już na liście (${skipped} duplikatów)`)
    else if (skipped === 0) toast(`Dodano ${added} ✓`)
    else toast(`Dodano ${added} (${skipped} duplikatów)`)
  } catch (e) {
    hideLoading()
    toast(/** @type {Error} */ (e).message, 4000, true)
  }
}

// ── List actions ──────────────────────────────────────────────────────────────
async function saveCurrentList() {
  const saved = /** @type {ShoppingListData} */ ({ ...currentList.value, saved: true })
  await DB.save(saved)
  currentList.value = saved
  toast('Lista zapisana 💾')
}

function discardCurrentList() {
  if (!confirm('Odrzucić bieżącą listę?')) return
  currentList.value = null
  navigateTo('input')
}

// ── Today's list lookup ───────────────────────────────────────────────────────
/**
 * @param {number} ts
 * @param {number} [ref]
 * @returns {boolean}
 */
function isSameDay(ts, ref = Date.now()) {
  const a = new Date(ts),
    b = new Date(ref)
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

/**
 * @param {ShoppingListData[]} lists
 * @returns {ShoppingListData | null}
 */
function findTodaysList(lists) {
  return lists.find(l => l.saved === true && isSameDay(l.date)) ?? null
}

// ── History actions ───────────────────────────────────────────────────────────
/** @param {number} id */
async function loadHistory(id) {
  const lists = await DB.getAll()
  const l = lists.find(l => l.id === id)
  if (!l) return
  l.categories.forEach(c => {
    c.collapsed ??= false
    c.manualExpand ??= false
  })
  currentList.value = l
  navigateTo('list')
}

/** @param {number} id */
async function delHistory(id) {
  if (!confirm('Usunąć tę listę?')) return
  await DB.del(id)
  if (currentList.value?.id === id) currentList.value = null
  await mountHistoryIsland()
  toast('Lista usunięta')
}

async function makeTemplateFromCurrent() {
  const l = currentList.value
  if (!l) {
    toast('Brak aktywnej listy')
    return
  }
  const name = prompt('Nazwa szablonu', l.title)
  if (name == null) return
  const trimmed = name.trim()
  if (!trimmed) return
  await DB.saveTemplate(listToTemplate(l, Date.now(), trimmed))
  toast('Szablon zapisany 📌')
}

async function clearAllHistory() {
  if (!confirm('Usunąć WSZYSTKIE zapisane listy?')) return
  await DB.clear()
  if (currentList.value?.saved) currentList.value = null
  await mountHistoryIsland()
  toast('Historia wyczyszczona 🗑')
}

// ── ShoppingList island ───────────────────────────────────────────────────────
/** @returns {import('preact').VNode} */
function ShoppingList() {
  const list = currentList.value
  /** @type {import('preact/hooks').MutableRef<ReturnType<typeof setTimeout> | null>} */
  const collapseRef = useRef(/** @type {ReturnType<typeof setTimeout> | null} */ (null))
  const prevAllDone = useRef(false)

  const categories = list?.categories ?? []
  const allItems = categories.flatMap(c => c.items)
  const done = allItems.filter(i => i.checked).length
  const allDone = allItems.length > 0 && allItems.every(i => i.checked)

  useEffect(() => {
    if (allDone && !prevAllDone.current)
      confetti({ particleCount: 120, spread: 360, startVelocity: 35, origin: { x: 0.5, y: 0.5 } })
    prevAllDone.current = allDone
  }, [allDone])

  if (!list)
    return html` <div class="text-center py-16 px-6 text-muted">
      <div class="text-[48px] mb-3">📝</div>
      <p class="text-[14px] leading-7">Brak aktywnej listy.<br />Stwórz nową w zakładce "Nowa".</p>
    </div>`

  /**
   * @param {number} ci
   * @param {number} ii
   */
  function toggleItem(ci, ii) {
    let willCollapse = false
    const next = categories.map((c, catIdx) => {
      if (catIdx !== ci) return c
      const newItems = c.items.map((item, itemIdx) =>
        itemIdx !== ii ? item : { ...item, checked: !item.checked },
      )
      const nowChecked = newItems[ii].checked
      if (!nowChecked) return { ...c, items: newItems, collapsed: false, manualExpand: false }
      if (newItems.every(i => i.checked) && !c.manualExpand) willCollapse = true
      return { ...c, items: newItems }
    })
    currentList.value = { .../** @type {ShoppingListData} */ (list), categories: next }
    if (willCollapse) {
      clearTimeout(collapseRef.current ?? undefined)
      collapseRef.current = setTimeout(() => {
        const cur = /** @type {ShoppingListData} */ (currentList.value)
        currentList.value = {
          ...cur,
          categories: cur.categories.map((c, i) => (i === ci ? { ...c, collapsed: true } : c)),
        }
      }, 450)
    }
    if (/** @type {ShoppingListData} */ (list).saved) {
      DB.save(/** @type {ShoppingListData} */ (currentList.value)).catch(e =>
        console.error('Auto-save failed', e),
      )
    }
  }

  /** @param {number} ci */
  function toggleCat(ci) {
    const cur = /** @type {ShoppingListData} */ (list)
    currentList.value = {
      ...cur,
      categories: cur.categories.map((c, i) =>
        i !== ci ? c : { ...c, collapsed: !c.collapsed, manualExpand: c.collapsed },
      ),
    }
  }

  return html` <div>
    <div class="mb-5 pt-1">
      <div class="flex items-center justify-between mb-2">
        <div class="text-[17px] font-semibold text-fg/90 truncate pr-3">${list.title}</div>
        <div class="flex items-center gap-3 shrink-0">
          <div class="text-[12px] text-muted">${done} / ${allItems.length}</div>
          <button
            class="text-muted bg-transparent border-none cursor-pointer p-1 active:text-accent transition-colors"
            onClick=${() => window.App.openAmendModal()}
            title="Dodaj do listy"
            aria-label="Dodaj do listy"
          >
            <${PlusIcon} />
          </button>
          <${Meatballs}
            items=${[
              { icon: '📌', label: 'Utwórz szablon', onClick: makeTemplateFromCurrent },
              {
                icon: '🔗',
                label: 'Udostępnij',
                onClick: () => shareList(/** @type {ShoppingListData} */ (currentList.value)),
              },
            ]}
          />
        </div>
      </div>
      <div class="h-[2px] bg-fg/[0.07] rounded-full overflow-hidden">
        <div
          class="progress-fill h-full rounded-full"
          style=${{ width: allItems.length ? `${(done / allItems.length) * 100}%` : '0%' }}
        />
      </div>
    </div>

    <div class="md:grid md:grid-cols-2 lg:grid-cols-3 md:gap-x-6 md:items-start">
      ${categories.map((cat, ci) => {
        const catDone = cat.items.filter(i => i.checked).length
        const catAllDone = catDone === cat.items.length && cat.items.length > 0
        return html` <div class="border-t border-fg/[0.07] pt-1 mb-1" key=${cat.name + ci}>
          <div
            class="flex items-center justify-between py-2 px-1 cursor-pointer select-none"
            onClick=${() => toggleCat(ci)}
          >
            <div class="flex items-center gap-2 text-[11px] tracking-widest uppercase text-muted">
              <span>${emojiFor(cat.name)}</span>
              <span>${cat.name}</span>
              <span class="opacity-60">(${catDone}/${cat.items.length})</span>
              ${catAllDone &&
              html`<span class="bg-accent/20 text-accent text-[10px] px-2 py-0.5 rounded-full"
                >✓ gotowe</span
              >`}
            </div>
            <span class="cat-chevron text-muted text-[11px] ${cat.collapsed ? 'up' : ''}">▼</span>
          </div>
          <div class="cat-grid ${cat.collapsed ? 'collapsed' : ''}">
            <div class="cat-grid-inner">
              <div>
                ${cat.items.map(
                  (item, ii) => html`
                    <div
                      class="flex items-center px-1 py-[13px] border-b border-fg/[0.07] last:border-0 cursor-pointer active:opacity-70"
                      onClick=${() => toggleItem(ci, ii)}
                      key=${ii}
                    >
                      <div
                        class="w-5 h-5 rounded-[6px] border shrink-0 mr-3 flex items-center justify-center transition-all ${item.checked
                          ? 'bg-accent border-accent'
                          : 'border-muted'}"
                      >
                        ${item.checked && html`<${CheckIcon} />`}
                      </div>
                      <span
                        class="text-[15px] ${item.checked
                          ? 'text-muted line-through'
                          : 'text-fg/90'}"
                        >${item.name}</span
                      >
                    </div>
                  `,
                )}
              </div>
            </div>
          </div>
        </div>`
      })}
    </div>
  </div>`
}

// ── HistoryList island ────────────────────────────────────────────────────────
/**
 * @param {{ lists: ShoppingListData[], onLoad: (id: number) => void, onDelete: (id: number) => void, onClear: () => void }} props
 * @returns {import('preact').VNode}
 */
function HistoryList({ lists, onLoad, onDelete, onClear }) {
  const header = html` <div class="flex justify-between items-center mb-4">
    <h2 class="text-fg/60 text-[12px] font-semibold tracking-widest uppercase">Historia list</h2>
    <button
      class="text-red-400/60 text-[12px] cursor-pointer border-none bg-transparent py-1 px-2 active:text-red-400"
      onClick=${onClear}
    >
      Wyczyść
    </button>
  </div>`

  if (!lists.length)
    return html` <div>
      ${header}
      <div class="text-center py-16 px-6 text-muted">
        <div class="text-[48px] mb-3">📭</div>
        <p class="text-[14px] leading-7">
          Brak zapisanych list.<br />Stwórz pierwszą w zakładce "Nowa".
        </p>
      </div>
    </div>`

  return html` <div>
    ${header}
    <div class="md:grid md:grid-cols-2 lg:grid-cols-3 md:gap-4 md:items-start">
      ${lists.map(l => {
        const items = l.categories.flatMap(c => c.items)
        const done = items.filter(i => i.checked).length
        return html` <div
          class="py-3.5 border-b border-fg/[0.07] md:border md:border-fg/10 md:rounded-xl md:p-4 cursor-pointer relative active:opacity-60 transition-opacity"
          onClick=${() => onLoad(l.id)}
          key=${l.id}
        >
          <button
            class="absolute top-3 right-3 bg-transparent border-none text-muted text-[15px] cursor-pointer p-1 active:text-red-400 transition-colors"
            onClick=${(/** @type {Event} */ e) => {
              e.stopPropagation()
              onDelete(l.id)
            }}
          >
            🗑
          </button>
          <div class="text-[11px] text-muted mb-0.5">${fmtDateFull(l.date)}</div>
          <div class="text-[15px] font-semibold text-fg/90 mb-2">${l.title}</div>
          <div class="flex flex-wrap gap-1.5">
            <span class="text-[11px] px-2 py-0.5 bg-fg/[0.06] rounded-full text-muted"
              >📦 ${items.length} produktów</span
            >
            <span class="text-[11px] px-2 py-0.5 bg-fg/[0.06] rounded-full text-muted"
              >✓ ${done} kupionych</span
            >
            ${l.categories.map(
              c => html`
                <span class="text-[11px] px-2 py-0.5 bg-fg/[0.06] rounded-full text-muted"
                  >${emojiFor(c.name)} ${c.name}</span
                >
              `,
            )}
          </div>
        </div>`
      })}
    </div>
  </div>`
}

// ── TemplatesChips island ─────────────────────────────────────────────────────
/**
 * @param {{ templates: Template[], onPick: (id: number) => void, onManage: () => void }} props
 * @returns {import('preact').VNode | null}
 */
function TemplatesChips({ templates, onPick, onManage }) {
  if (!templates.length) return null
  return html` <div class="flex gap-2 overflow-x-auto mt-3 pb-1 -mx-1 px-1">
    ${templates.map(
      t => html`
        <button
          key=${t.id}
          class="shrink-0 bg-surface border border-fg/10 text-fg/80 text-[13px] px-3 py-2 rounded-full cursor-pointer active:opacity-70 whitespace-nowrap"
          onClick=${() => onPick(t.id)}
        >
          📌 ${t.name}
          <span class="text-muted">(${t.categories.reduce((n, c) => n + c.items.length, 0)})</span>
        </button>
      `,
    )}
    <button
      class="shrink-0 bg-transparent border border-fg/10 text-muted text-[13px] px-3 py-2 rounded-full cursor-pointer active:opacity-70"
      onClick=${onManage}
      title="Zarządzaj szablonami"
      aria-label="Zarządzaj szablonami"
    >
      ⚙️
    </button>
  </div>`
}

// ── TemplateList island (manage) ──────────────────────────────────────────────
/**
 * @param {{ templates: Template[], onDelete: (id: number) => void }} props
 * @returns {import('preact').VNode}
 */
function TemplateList({ templates, onDelete }) {
  const header = html` <div class="flex justify-between items-center mb-4">
    <h2 class="text-fg/60 text-[12px] font-semibold tracking-widest uppercase">Szablony</h2>
  </div>`

  if (!templates.length)
    return html` <div>
      ${header}
      <div class="text-center py-16 px-6 text-muted">
        <div class="text-[48px] mb-3">📌</div>
        <p class="text-[14px] leading-7">
          Brak szablonów.<br />Zapisz listę jako szablon z menu ⋮ w widoku listy.
        </p>
      </div>
    </div>`

  // Rename templates: future (issue #9 leaves rename as a seam) — add an edit affordance here.
  return html` <div>
    ${header}
    <div class="md:grid md:grid-cols-2 lg:grid-cols-3 md:gap-4 md:items-start">
      ${templates.map(
        t => html` <div
          class="py-3.5 border-b border-fg/[0.07] md:border md:border-fg/10 md:rounded-xl md:p-4 relative"
          key=${t.id}
        >
          <button
            class="absolute top-3 right-3 bg-transparent border-none text-muted text-[15px] cursor-pointer p-1 active:text-red-400 transition-colors"
            onClick=${() => onDelete(t.id)}
            aria-label="Usuń szablon"
          >
            🗑
          </button>
          <div class="text-[15px] font-semibold text-fg/90 mb-2 pr-8">${t.name}</div>
          <div class="flex flex-wrap gap-1.5">
            ${t.categories.map(
              c => html`
                <span class="text-[11px] px-2 py-0.5 bg-fg/[0.06] rounded-full text-muted"
                  >${emojiFor(c.name)} ${c.name} (${c.items.length})</span
                >
              `,
            )}
          </div>
        </div>`,
      )}
    </div>
  </div>`
}

// ── Island mount lifecycle ────────────────────────────────────────────────────
function mountListIsland() {
  const el = document.getElementById('categories-container')
  if (el)
    render(html`<${ShoppingList} onSave=${saveCurrentList} onDiscard=${discardCurrentList} />`, el)
}

async function mountHistoryIsland() {
  const el = document.getElementById('history-container')
  if (!el) return
  const lists = await DB.getAll()
  render(
    html`<${HistoryList}
      lists=${lists}
      onLoad=${loadHistory}
      onDelete=${delHistory}
      onClear=${clearAllHistory}
    />`,
    el,
  )
}

async function mountTemplatesIsland() {
  const el = document.getElementById('templates-container')
  if (!el) return
  const templates = await DB.getAllTemplates()
  render(html`<${TemplateList} templates=${templates} onDelete=${removeTemplate} />`, el)
}

/** @param {number} id */
async function removeTemplate(id) {
  if (!confirm('Usunąć ten szablon?')) return
  await DB.delTemplate(id)
  await mountTemplatesIsland()
  toast('Szablon usunięty')
}

async function mountTemplatesChips() {
  const el = document.getElementById('templates-chips')
  if (!el) return
  const templates = await DB.getAllTemplates()
  render(
    html`<${TemplatesChips}
      templates=${templates}
      onPick=${pickTemplate}
      onManage=${() => navigateTo('templates')}
    />`,
    el,
  )
}

/** @param {number} id */
async function pickTemplate(id) {
  const templates = await DB.getAllTemplates()
  const t = templates.find(t => t.id === id)
  if (!t) return
  if (!confirm(`Utworzyć listę z szablonu „${t.name}”?`)) return
  const now = Date.now()
  const list = templateToList(t, now, t.name + ' ' + fmtDate(now))
  await DB.save(list)
  currentList.value = list
  navigateTo('list')
}

document.addEventListener('htmx:afterSwap', async e => {
  if (/** @type {CustomEvent} */ (e).detail.target.id !== 'main-content') return
  if (currentView === 'input') await mountTemplatesChips()
  if (currentView === 'list') mountListIsland()
  if (currentView === 'history') await mountHistoryIsland()
  if (currentView === 'templates') await mountTemplatesIsland()
})

function hideBootLoader() {
  document.getElementById('boot-loader')?.classList.add('hidden')
}

// ── Utils ─────────────────────────────────────────────────────────────────────
/**
 * @param {string} type
 * @param {string} text
 */
function setStatus(type, text) {
  const badge = document.getElementById('status-badge')
  if (!badge) return
  badge.className = `status-badge ${type}`
  const textEl = document.getElementById('status-text')
  if (textEl) textEl.textContent = text
}
/** @param {string} [t] */
function showLoading(t) {
  const el = document.getElementById('loading-overlay')
  if (!el) return
  el.classList.remove('hidden')
  const loadingText = /** @type {HTMLElement} */ (document.getElementById('loading-text'))
  loadingText.textContent = t || 'Ładuję…'
}
function hideLoading() {
  document.getElementById('loading-overlay')?.classList.add('hidden')
}

/** @type {ReturnType<typeof setTimeout>} */
let _toastTimer
/**
 * @param {string} msg
 * @param {number} [dur]
 * @param {boolean} [isError]
 */
function toast(msg, dur = 2500, isError = false) {
  const el = /** @type {HTMLElement} */ (document.getElementById('toast'))
  el.textContent = msg
  el.classList.toggle('error', isError)
  el.classList.add('show')
  clearTimeout(_toastTimer)
  _toastTimer = setTimeout(() => el.classList.remove('show'), dur)
}
/**
 * @param {number} ts
 * @returns {string}
 */
function fmtDate(ts) {
  return new Date(ts).toLocaleDateString('pl-PL', { day: 'numeric', month: 'short' })
}
/**
 * @param {number} ts
 * @returns {string}
 */
function fmtDateFull(ts) {
  return new Date(ts).toLocaleString('pl-PL', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

// ── Share state ───────────────────────────────────────────────────────────────
/** @param {ShoppingListData} list */
async function shareList(list) {
  try {
    const encoded = await encodeState(list)
    const url = `${location.origin}/?state=${encoded}`
    if (navigator.share) {
      await navigator.share({ title: list.title, url })
    } else if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(url)
      toast('Link skopiowany 🔗')
    } else {
      toast('Link: ' + url, 6000)
    }
  } catch (e) {
    if (/** @type {Error} */ (e).name !== 'AbortError')
      toast('Nie udało się udostępnić', 4000, true)
  }
}

/** @returns {Promise<boolean>} */
async function handleSharedState() {
  const state = new URLSearchParams(location.search).get('state')
  if (!state) return false
  try {
    const payload = await decodeState(state)
    currentList.value = /** @type {ShoppingListData} */ ({
      id: Date.now(),
      title: payload.title,
      date: payload.date,
      saved: true,
      model: '',
      categories: payload.categories.map(c => ({
        name: c.name,
        collapsed: false,
        manualExpand: false,
        items: c.items.map(i => ({ name: i.name, checked: i.checked })),
      })),
    })
    await DB.save(/** @type {ShoppingListData} */ (currentList.value))
    history.replaceState(null, '', '/')
    return true
  } catch {
    toast('Nieprawidłowy link', 4000, true)
    return false
  }
}

function toggleTheme() {
  const light = document.documentElement.classList.toggle('light')
  localStorage.setItem('theme', light ? 'light' : 'dark')
  const meta = document.querySelector('meta[name=theme-color]')
  if (meta) meta.setAttribute('content', light ? '#ffffff' : '#1a1a2e')
  syncThemeButton()
}

function syncThemeButton() {
  const btn = document.getElementById('theme-toggle')
  if (!btn) return
  btn.textContent = document.documentElement.classList.contains('light') ? '🌙' : '☀️'
}

function toggleFontSize() {
  const large = document.documentElement.classList.toggle('large')
  localStorage.setItem('fontSize', large ? 'large' : 'regular')
  syncFontSizeButton()
}

function syncFontSizeButton() {
  const btn = document.getElementById('font-size-toggle')
  if (!btn) return
  btn.textContent = document.documentElement.classList.contains('large') ? 'A⁻' : 'A⁺'
}

// ── window.App namespace ──────────────────────────────────────────────────────
window.App = {
  processWithMistral,
  handleNavClick,
  saveCurrentList,
  discardCurrentList,
  clearAllHistory,
  openAmendModal,
  closeAmendModal,
  handleAmendOverlayClick,
  amendCurrentList,
  toggleTheme,
  toggleFontSize,
}

syncThemeButton()
syncFontSizeButton()

// ── Boot ──────────────────────────────────────────────────────────────────────
if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {})

// Safety net: never leave the user staring at the boot loader. If any async boot
// step wedges (e.g. htmx not yet ready when navigateTo fires, so its swap and
// afterSwap never happen), force the loader off after a grace period. This is the
// bug behind "first load stuck, refresh fixes it": hiding was coupled to a single
// htmx:afterSwap event with no fallback.
const bootLoaderSafety = setTimeout(hideBootLoader, 4000)

async function boot() {
  try {
    const wasShared = await handleSharedState()
    if (wasShared) {
      showBottomNav()
      // await so the loader hides only after the swap settles (no view flash),
      // and — crucially — hides even if the swap rejects (finally below).
      await navigateTo('list')
    } else {
      const todays = findTodaysList(await DB.getAll())
      if (todays) {
        todays.categories.forEach(c => {
          c.collapsed ??= false
          c.manualExpand ??= false
        })
        currentList.value = todays
        showBottomNav()
        await navigateTo('list')
      } else {
        showMainApp()
        await mountTemplatesChips()
      }
    }
  } catch {
    // Never trap the user behind the boot loader if init/navigation fails.
    showMainApp()
  } finally {
    clearTimeout(bootLoaderSafety)
    hideBootLoader()
  }
}

DB.init().then(boot, boot)
