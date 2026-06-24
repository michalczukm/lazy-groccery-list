import { render, h } from 'preact'
import { useEffect, useRef } from 'preact/hooks'
import { signal } from '@preact/signals'
import htm from 'htm'
import confetti from 'canvas-confetti'
import { encodeState, decodeState } from './share-state.js'
import { mergeAmendInto } from './merge-amend.js'
import { listToTemplate, templateToList } from './template-shape.js'
import { executeTurnstile } from './turnstile.js'

const html = htm.bind(h)

// Emoji per category name. Keep in sync with CATEGORIES in src/lib/mistral.ts.
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
const emojiFor = name => CATEGORY_EMOJI[name] ?? '📦'

// ── IndexedDB ──────────────────────────────────────────────────────────────────
const DB = (() => {
  let db
  const open = () =>
    new Promise((res, rej) => {
      const r = indexedDB.open('LazyGrocceryList', 2)
      r.onupgradeneeded = e => {
        const d = e.target.result
        if (!d.objectStoreNames.contains('lists')) d.createObjectStore('lists', { keyPath: 'id' })
        if (!d.objectStoreNames.contains('templates'))
          d.createObjectStore('templates', { keyPath: 'id' })
      }
      r.onsuccess = e => {
        db = e.target.result
        res()
      }
      r.onerror = () => rej(r.error)
    })
  const tx = (store, m) => db.transaction(store, m).objectStore(store)
  const wrap = r =>
    new Promise((res, rej) => {
      r.onsuccess = () => res(r.result)
      r.onerror = () => rej(r.error)
    })
  return {
    init: open,
    save: l => wrap(tx('lists', 'readwrite').put(l)),
    getAll: () =>
      wrap(tx('lists', 'readonly').getAll()).then(a => a.sort((a, b) => b.date - a.date)),
    del: id => wrap(tx('lists', 'readwrite').delete(id)),
    clear: () => wrap(tx('lists', 'readwrite').clear()),
    saveTemplate: t => wrap(tx('templates', 'readwrite').put(t)),
    getAllTemplates: () =>
      wrap(tx('templates', 'readonly').getAll()).then(a => a.sort((a, b) => b.date - a.date)),
    delTemplate: id => wrap(tx('templates', 'readwrite').delete(id)),
  }
})()

// ── State ─────────────────────────────────────────────────────────────────────
const currentList = signal(null)
let currentView = 'input'

// ── Modal ─────────────────────────────────────────────────────────────────────
function openAmendModal() {
  if (!currentList.value) {
    toast('Brak aktywnej listy')
    return
  }
  const amendElement = document.getElementById('amend-input')
  if (amendElement) amendElement.value = ''
  document.getElementById('amend-modal-overlay').classList.remove('hidden')
  setTimeout(() => amendElement?.focus(), 50)
}
function closeAmendModal() {
  document.getElementById('amend-modal-overlay').classList.add('hidden')
}
function handleAmendOverlayClick(e) {
  if (e.target.id === 'amend-modal-overlay') closeAmendModal()
}
// ── Routing ───────────────────────────────────────────────────────────────────
function showMainApp() {
  document.getElementById('bottom-nav').style.display = ''
  if (currentView !== 'input') {
    navigateTo('input')
  } else {
    const btn = document.querySelector('[data-view="input"]')
    if (btn) setActiveNav(btn)
    updateHeader('input')
  }
}

// ── Navigation ────────────────────────────────────────────────────────────────
const META = {
  input: { title: '🛒 Lazy List', sub: 'Nowa lista' },
  list: { title: '📋 Lista', sub: '' },
  history: { title: '📚 Historia', sub: 'Poprzednie listy' },
  templates: { title: '📌 Szablony', sub: 'Zapisane szablony' },
}

function navigateTo(name) {
  currentView = name
  const btn = document.querySelector(`[data-view="${name}"]`)
  setActiveNav(btn)
  updateHeader(name)
  htmx.ajax('GET', `/views/${name}`, { target: '#main-content', swap: 'innerHTML' })
}

function handleNavClick(el) {
  const name = el.dataset.view
  currentView = name
  setActiveNav(el)
  updateHeader(name)
}

function setActiveNav(el) {
  document.querySelectorAll('[data-view]').forEach(b => b.classList.remove('active'))
  if (el) el.classList.add('active')
}

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
  const raw = document.getElementById('shopping-input').value.trim()
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
    setStatus('error', e.message)
    toast(e.message, 4000, true)
  }
}

async function amendCurrentList() {
  if (!currentList.value) {
    toast('Brak aktywnej listy')
    return
  }
  const raw = document.getElementById('amend-input').value.trim()
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
    toast(e.message, 4000, true)
  }
}

// ── List actions ──────────────────────────────────────────────────────────────
async function saveCurrentList() {
  const saved = { ...currentList.value, saved: true }
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
function isSameDay(ts, ref = Date.now()) {
  const a = new Date(ts),
    b = new Date(ref)
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

// lists already sorted by date desc (DB.getAll)
function findTodaysList(lists) {
  return lists.find(l => l.saved === true && isSameDay(l.date)) ?? null
}

// ── History actions ───────────────────────────────────────────────────────────
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

async function delHistory(id) {
  if (!confirm('Usunąć tę listę?')) return
  await DB.del(id)
  if (currentList.value?.id === id) currentList.value = null
  await mountHistoryIsland()
  toast('Lista usunięta')
}

async function makeTemplate(id) {
  const lists = await DB.getAll()
  const l = lists.find(l => l.id === id)
  if (!l) return
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
function ShoppingList() {
  const list = currentList.value
  const collapseRef = useRef(null)
  const prevAllDone = useRef(false)

  const categories = list?.categories ?? []
  const allItems = categories.flatMap(c => c.items)
  const done = allItems.filter(i => i.checked).length
  const allDone = allItems.length > 0 && allItems.every(i => i.checked)

  useEffect(() => {
    if (allDone && !prevAllDone.current)
      confetti({ particleCount: 120, spread: 70, origin: { y: 0.6 } })
    prevAllDone.current = allDone
  }, [allDone])

  if (!list)
    return html` <div class="text-center py-16 px-6 text-white/45">
      <div class="text-[48px] mb-3">📝</div>
      <p class="text-[14px] leading-7">Brak aktywnej listy.<br />Stwórz nową w zakładce "Nowa".</p>
    </div>`

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
    currentList.value = { ...list, categories: next }
    if (willCollapse) {
      clearTimeout(collapseRef.current)
      collapseRef.current = setTimeout(() => {
        currentList.value = {
          ...currentList.value,
          categories: currentList.value.categories.map((c, i) =>
            i === ci ? { ...c, collapsed: true } : c,
          ),
        }
      }, 450)
    }
    if (list.saved) {
      DB.save(currentList.value).catch(e => console.error('Auto-save failed', e))
    }
  }

  function toggleCat(ci) {
    currentList.value = {
      ...list,
      categories: list.categories.map((c, i) =>
        i !== ci ? c : { ...c, collapsed: !c.collapsed, manualExpand: c.collapsed },
      ),
    }
  }

  return html` <div>
    <div class="mb-5 pt-1">
      <div class="flex items-center justify-between mb-2">
        <div class="text-[17px] font-semibold text-white/90 truncate pr-3">${list.title}</div>
        <div class="flex items-center gap-3 shrink-0">
          <div class="text-[12px] text-white/50">${done} / ${allItems.length}</div>
          <button
            class="text-white/40 bg-transparent border-none cursor-pointer p-1 active:text-accent transition-colors"
            onClick=${() => window.App.openAmendModal()}
            title="Dodaj do listy"
            aria-label="Dodaj do listy"
          >
            <svg
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
            </svg>
          </button>
          <button
            class="text-white/40 bg-transparent border-none cursor-pointer p-1 active:text-accent transition-colors"
            onClick=${() => shareList(currentList.value)}
            title="Udostępnij listę"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
              <polyline points="16 6 12 2 8 6" />
              <line x1="12" y1="2" x2="12" y2="15" />
            </svg>
          </button>
        </div>
      </div>
      <div class="h-[2px] bg-white/[0.07] rounded-full overflow-hidden">
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
        return html` <div class="border-t border-white/[0.07] pt-1 mb-1" key=${cat.name + ci}>
          <div
            class="flex items-center justify-between py-2 px-1 cursor-pointer select-none"
            onClick=${() => toggleCat(ci)}
          >
            <div
              class="flex items-center gap-2 text-[11px] tracking-widest uppercase text-white/55"
            >
              <span>${emojiFor(cat.name)}</span>
              <span>${cat.name}</span>
              <span class="opacity-60">(${catDone}/${cat.items.length})</span>
              ${catAllDone &&
              html`<span class="bg-accent/20 text-accent text-[10px] px-2 py-0.5 rounded-full"
                >✓ gotowe</span
              >`}
            </div>
            <span class="cat-chevron text-white/45 text-[11px] ${cat.collapsed ? 'up' : ''}"
              >▼</span
            >
          </div>
          <div class="cat-grid ${cat.collapsed ? 'collapsed' : ''}">
            <div class="cat-grid-inner">
              <div>
                ${cat.items.map(
                  (item, ii) => html`
                    <div
                      class="flex items-center px-1 py-[13px] border-b border-white/[0.07] last:border-0 cursor-pointer active:opacity-70"
                      onClick=${() => toggleItem(ci, ii)}
                      key=${ii}
                    >
                      <div
                        class="w-5 h-5 rounded-[6px] border shrink-0 mr-3 flex items-center justify-center transition-all ${item.checked
                          ? 'bg-accent border-accent'
                          : 'border-white/30'}"
                      >
                        ${item.checked &&
                        html`<svg width="11" height="8" viewBox="0 0 13 10" fill="none">
                          <path
                            d="M1 5L5 9L12 1"
                            stroke="#0f0f1a"
                            stroke-width="2.5"
                            stroke-linecap="round"
                            stroke-linejoin="round"
                          />
                        </svg>`}
                      </div>
                      <span
                        class="text-[15px] ${item.checked
                          ? 'text-white/40 line-through'
                          : 'text-white/90'}"
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
function HistoryList({ lists, onLoad, onDelete, onClear, onMakeTemplate }) {
  const header = html` <div class="flex justify-between items-center mb-4">
    <h2 class="text-white/60 text-[12px] font-semibold tracking-widest uppercase">Historia list</h2>
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
      <div class="text-center py-16 px-6 text-white/45">
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
          class="py-3.5 border-b border-white/[0.07] md:border md:border-white/10 md:rounded-xl md:p-4 cursor-pointer relative active:opacity-60 transition-opacity"
          onClick=${() => onLoad(l.id)}
          key=${l.id}
        >
          <button
            class="absolute top-3 right-10 bg-transparent border-none text-white/35 text-[15px] cursor-pointer p-1 active:text-accent transition-colors"
            onClick=${e => {
              e.stopPropagation()
              onMakeTemplate(l.id)
            }}
            title="Zapisz jako szablon"
            aria-label="Zapisz jako szablon"
          >
            📌
          </button>
          <button
            class="absolute top-3 right-3 bg-transparent border-none text-white/35 text-[15px] cursor-pointer p-1 active:text-red-400 transition-colors"
            onClick=${e => {
              e.stopPropagation()
              onDelete(l.id)
            }}
          >
            🗑
          </button>
          <div class="text-[11px] text-white/45 mb-0.5">${fmtDateFull(l.date)}</div>
          <div class="text-[15px] font-semibold text-white/90 mb-2">${l.title}</div>
          <div class="flex flex-wrap gap-1.5">
            <span class="text-[11px] px-2 py-0.5 bg-white/[0.06] rounded-full text-white/50"
              >📦 ${items.length} produktów</span
            >
            <span class="text-[11px] px-2 py-0.5 bg-white/[0.06] rounded-full text-white/50"
              >✓ ${done} kupionych</span
            >
            ${l.categories.map(
              c => html`
                <span class="text-[11px] px-2 py-0.5 bg-white/[0.06] rounded-full text-white/50"
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
function TemplatesChips({ templates, onPick, onManage }) {
  if (!templates.length) return null
  return html` <div class="flex gap-2 overflow-x-auto mt-3 pb-1 -mx-1 px-1">
    ${templates.map(
      t => html`
        <button
          key=${t.id}
          class="shrink-0 bg-navy border border-white/10 text-white/80 text-[13px] px-3 py-2 rounded-full cursor-pointer active:opacity-70 whitespace-nowrap"
          onClick=${() => onPick(t.id)}
        >
          📌 ${t.name}
          <span class="text-white/40"
            >(${t.categories.reduce((n, c) => n + c.items.length, 0)})</span
          >
        </button>
      `,
    )}
    <button
      class="shrink-0 bg-transparent border border-white/10 text-white/50 text-[13px] px-3 py-2 rounded-full cursor-pointer active:opacity-70"
      onClick=${onManage}
      title="Zarządzaj szablonami"
      aria-label="Zarządzaj szablonami"
    >
      ⚙️
    </button>
  </div>`
}

// ── TemplateList island (manage) ──────────────────────────────────────────────
function TemplateList({ templates, onDelete }) {
  const header = html` <div class="flex justify-between items-center mb-4">
    <h2 class="text-white/60 text-[12px] font-semibold tracking-widest uppercase">Szablony</h2>
  </div>`

  if (!templates.length)
    return html` <div>
      ${header}
      <div class="text-center py-16 px-6 text-white/45">
        <div class="text-[48px] mb-3">📌</div>
        <p class="text-[14px] leading-7">
          Brak szablonów.<br />Zapisz listę jako szablon w zakładce "Historia".
        </p>
      </div>
    </div>`

  // Rename templates: future (issue #9 leaves rename as a seam) — add an edit affordance here.
  return html` <div>
    ${header}
    <div class="md:grid md:grid-cols-2 lg:grid-cols-3 md:gap-4 md:items-start">
      ${templates.map(
        t => html` <div
          class="py-3.5 border-b border-white/[0.07] md:border md:border-white/10 md:rounded-xl md:p-4 relative"
          key=${t.id}
        >
          <button
            class="absolute top-3 right-3 bg-transparent border-none text-white/35 text-[15px] cursor-pointer p-1 active:text-red-400 transition-colors"
            onClick=${() => onDelete(t.id)}
            aria-label="Usuń szablon"
          >
            🗑
          </button>
          <div class="text-[15px] font-semibold text-white/90 mb-2 pr-8">${t.name}</div>
          <div class="flex flex-wrap gap-1.5">
            ${t.categories.map(
              c => html`
                <span class="text-[11px] px-2 py-0.5 bg-white/[0.06] rounded-full text-white/50"
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
      onMakeTemplate=${makeTemplate}
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
  if (e.detail.target.id !== 'main-content') return
  if (currentView === 'input') await mountTemplatesChips()
  if (currentView === 'list') mountListIsland()
  if (currentView === 'history') await mountHistoryIsland()
  if (currentView === 'templates') await mountTemplatesIsland()
  hideBootLoader()
})

function hideBootLoader() {
  document.getElementById('boot-loader')?.classList.add('hidden')
}

// ── Utils ─────────────────────────────────────────────────────────────────────
function setStatus(type, text) {
  const badge = document.getElementById('status-badge')
  if (!badge) return
  badge.className = `status-badge ${type}`
  const textEl = document.getElementById('status-text')
  if (textEl) textEl.textContent = text
}
function showLoading(t) {
  const el = document.getElementById('loading-overlay')
  if (!el) return
  el.classList.remove('hidden')
  document.getElementById('loading-text').textContent = t || 'Ładuję…'
}
function hideLoading() {
  document.getElementById('loading-overlay')?.classList.add('hidden')
}

let _toastTimer
function toast(msg, dur = 2500, isError = false) {
  const el = document.getElementById('toast')
  el.textContent = msg
  el.classList.toggle('error', isError)
  el.classList.add('show')
  clearTimeout(_toastTimer)
  _toastTimer = setTimeout(() => el.classList.remove('show'), dur)
}
function fmtDate(ts) {
  return new Date(ts).toLocaleDateString('pl-PL', { day: 'numeric', month: 'short' })
}
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
    if (e.name !== 'AbortError') toast('Nie udało się udostępnić', 4000, true)
  }
}

async function handleSharedState() {
  const state = new URLSearchParams(location.search).get('state')
  if (!state) return false
  try {
    const payload = await decodeState(state)
    currentList.value = {
      id: Date.now(),
      title: payload.title,
      date: payload.date,
      saved: false,
      model: '',
      categories: payload.categories.map(c => ({
        name: c.name,
        collapsed: false,
        manualExpand: false,
        items: c.items.map(i => ({ name: i.name, checked: i.checked })),
      })),
    }
    history.replaceState(null, '', '/')
    return true
  } catch {
    toast('Nieprawidłowy link', 4000, true)
    return false
  }
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
}

// ── Boot ──────────────────────────────────────────────────────────────────────
if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {})

DB.init()
  .then(async () => {
    const wasShared = await handleSharedState()
    if (wasShared) {
      document.getElementById('bottom-nav').style.display = ''
      navigateTo('list')
    } else {
      const todays = findTodaysList(await DB.getAll())
      if (todays) {
        todays.categories.forEach(c => {
          c.collapsed ??= false
          c.manualExpand ??= false
        })
        currentList.value = todays
        document.getElementById('bottom-nav').style.display = ''
        navigateTo('list')
      } else {
        showMainApp()
        await mountTemplatesChips()
        hideBootLoader()
      }
    }
  })
  .catch(() => {
    // Never trap the user behind the boot loader if init fails.
    showMainApp()
    hideBootLoader()
  })
