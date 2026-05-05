import { render } from 'preact'
import { useState, useEffect, useRef } from 'preact/hooks'
import { html } from 'htm/preact'
import confetti from 'canvas-confetti'

// CONFIG
const LS_KEY = 'zakupy_api_key'
const MODEL  = 'mistral-small-latest'

const getKey = () => localStorage.getItem(LS_KEY) || ''

// ── IndexedDB ──────────────────────────────────────────────────────────────────
const DB = (() => {
  let db
  const open = () => new Promise((res, rej) => {
    const r = indexedDB.open('LazyGrocceryList', 1)
    r.onupgradeneeded = e => e.target.result.createObjectStore('lists', { keyPath: 'id' })
    r.onsuccess = e => { db = e.target.result; res() }
    r.onerror   = () => rej(r.error)
  })
  const tx   = m => db.transaction('lists', m).objectStore('lists')
  const wrap = r => new Promise((res, rej) => {
    r.onsuccess = () => res(r.result)
    r.onerror   = () => rej(r.error)
  })
  return {
    init:   open,
    save:   l  => wrap(tx('readwrite').put(l)),
    getAll: () => wrap(tx('readonly').getAll()).then(a => a.sort((a, b) => b.date - a.date)),
    del:    id => wrap(tx('readwrite').delete(id)),
    clear:  () => wrap(tx('readwrite').clear()),
  }
})()

// ── State ─────────────────────────────────────────────────────────────────────
let currentList = null
let currentView = 'input'

// ── Modal ─────────────────────────────────────────────────────────────────────
function openModal() {
  document.getElementById('key-input').value = getKey()
  document.getElementById('modal-overlay').classList.remove('hidden')
}
function closeModal() {
  document.getElementById('modal-overlay').classList.add('hidden')
}
function handleOverlayClick(e) {
  if (e.target.id === 'modal-overlay') closeModal()
}
function toggleReveal(inputId, btn) {
  const inp = document.getElementById(inputId)
  inp.type = inp.type === 'password' ? 'text' : 'password'
  btn.textContent = inp.type === 'password' ? 'Pokaż' : 'Ukryj'
}
function saveSettings() {
  const key = document.getElementById('key-input').value.trim()
  if (!key) { toast('Wpisz klucz API'); return }
  localStorage.setItem(LS_KEY, key)
  updateKeyIndicator()
  closeModal()
  toast('Ustawienia zapisane ✓')
  showMainApp()
}
function saveFromSetup() {
  const key = document.getElementById('setup-key-input').value.trim()
  if (!key) { toast('Wpisz klucz API'); return }
  localStorage.setItem(LS_KEY, key)
  updateKeyIndicator()
  showMainApp()
  toast('Klucz zapisany ✓')
}
function clearApiKey() {
  if (!confirm('Usunąć zapisany klucz API?')) return
  localStorage.removeItem(LS_KEY)
  updateKeyIndicator()
  closeModal()
  checkKeyAndRoute()
  toast('Klucz usunięty')
}
function updateKeyIndicator() {
  const has = !!getKey()
  const dot = document.getElementById('key-dot')
  if (dot) dot.className = `w-2 h-2 rounded-full ${has ? 'bg-emerald-500' : 'bg-amber-400'}`
  const label = document.getElementById('key-btn-label')
  if (label) label.textContent = has ? 'Mistral' : 'Klucz API'
}

// ── Routing ───────────────────────────────────────────────────────────────────
function checkKeyAndRoute() {
  if (getKey()) {
    showMainApp()
  } else {
    document.getElementById('bottom-nav').style.display = 'none'
    currentView = 'setup'
    htmx.ajax('GET', '/views/setup', { target: '#main-content', swap: 'innerHTML' })
  }
}
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
  input:   { title: '🛒 Lazy List', sub: 'Nowa lista' },
  list:    { title: '📋 Lista',     sub: '' },
  history: { title: '📚 Historia',  sub: 'Poprzednie listy' },
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
  const subEl   = document.getElementById('header-sub')
  if (titleEl) titleEl.textContent = m.title
  if (subEl)   subEl.textContent   = (name === 'list' && currentList) ? currentList.title : m.sub
}

// ── Mistral API ───────────────────────────────────────────────────────────────
const SYSTEM = `Jesteś asystentem do kategoryzowania list zakupów po polsku.
Dostajesz surową listę produktów (mogą być po jednym na linię, mogą być notatki w nawiasach, niektóre mogą być łączone np przez "i" albo "oraz").
Przypisz każdy produkt do odpowiedniej kategorii. Zachowaj ORYGINALNE nazwy produktów razem z uwagami w nawiasach.

Dostępne kategorie (użyj tylko tych, które mają produkty):
- nabiał 🥛 : mleko, jogurty, sery, twarogi, jajka, śmietana, masło, skyr, serek, actimel
- mięso i wędliny 🥩 : mięso surowe, kurczak, wędlina, parówki, kiełbasa, szynka
- warzywa 🥦 : wszystkie warzywa świeże, włoszczyzna, cukinia, papryka
- owoce 🍎 : wszystkie owoce świeże
- pieczywo 🍞 : chleb, bułki, bagietki, tortille
- napoje 🥤 : soki, woda, napoje gazowane
- suche produkty 🌾 : płatki, ryż, makaron, kasza, mąka, orzechy
- przyprawy i sosy 🧂 : oleje, oliwy, sosy, octy, musztarda
- gotowe dania 🍱 : gotowe sałatki, dania gotowe, mrożonki
- chemia i higiena 🧴 : środki czystości, kosmetyki, artykuły higieny
- inne 🛒 : wszystko co nie pasuje do powyższych`

const RESPONSE_SCHEMA = {
  type: 'json_schema',
  json_schema: {
    name: 'shopping_categories',
    strict: true,
    schema: {
      type: 'object',
      properties: {
        categories: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              name:  { type: 'string' },
              emoji: { type: 'string' },
              items: { type: 'array', items: { type: 'string' } },
            },
            required: ['name', 'emoji', 'items'],
            additionalProperties: false,
          },
        },
      },
      required: ['categories'],
      additionalProperties: false,
    },
  },
}

async function processWithMistral() {
  const raw = document.getElementById('shopping-input').value.trim()
  if (!raw)     { toast('Wpisz listę zakupów 📝'); return }
  if (!getKey()) { openModal(); return }

  setStatus('idle', 'Wysyłam…')
  showLoading('Kategoryzuję listę…')

  try {
    const res = await fetch('https://api.mistral.ai/v1/chat/completions', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getKey()}` },
      body: JSON.stringify({
        model: MODEL, max_tokens: 1000, temperature: 0.1,
        response_format: RESPONSE_SCHEMA,
        messages: [
          { role: 'system', content: SYSTEM },
          { role: 'user',   content: `Skategoryzuj tę listę zakupów:\n${raw}` },
        ],
      }),
    })

    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      if (res.status === 401) throw new Error('Nieprawidłowy klucz API. Sprawdź ustawienia.')
      if (res.status === 429) throw new Error('Limit zapytań przekroczony. Spróbuj za chwilę.')
      throw new Error(err?.message || `Błąd API (${res.status})`)
    }

    const data    = await res.json()
    const content = data.choices?.[0]?.message?.content || ''

    let parsed
    try { parsed = JSON.parse(content) }
    catch { throw new Error('AI zwróciło niepoprawny JSON. Spróbuj ponownie.') }
    if (!Array.isArray(parsed?.categories)) throw new Error('Brak kategorii w odpowiedzi AI.')

    currentList = {
      id: Date.now(), title: 'Zakupy ' + fmtDate(Date.now()),
      date: Date.now(), saved: true, model: MODEL,
      categories: parsed.categories
        .filter(c => c.items?.length)
        .map(c => ({
          name: c.name || 'inne', emoji: c.emoji || '📦',
          collapsed: false, manualExpand: false,
          items: c.items.map(n => ({ name: n, checked: false })),
        })),
    }
    await DB.save(currentList)

    hideLoading()
    setStatus('ready', 'Gotowe — Mistral Small')
    navigateTo('list')
  } catch (e) {
    hideLoading()
    setStatus('error', e.message)
    toast(e.message, 4000)
  }
}

// ── List actions ──────────────────────────────────────────────────────────────
async function saveCurrentList() {
  currentList.saved = true
  await DB.save(currentList)
  toast('Lista zapisana 💾')
}

function discardCurrentList() {
  if (!confirm('Odrzucić bieżącą listę?')) return
  currentList = null
  navigateTo('input')
}

// ── History actions ───────────────────────────────────────────────────────────
async function loadHistory(id) {
  const lists = await DB.getAll()
  const l = lists.find(l => l.id === id)
  if (!l) return
  l.categories.forEach(c => { c.collapsed ??= false; c.manualExpand ??= false })
  currentList = l
  navigateTo('list')
}

async function delHistory(id) {
  if (!confirm('Usunąć tę listę?')) return
  await DB.del(id)
  if (currentList?.id === id) currentList = null
  await mountHistoryIsland()
  toast('Lista usunięta')
}

async function clearAllHistory() {
  if (!confirm('Usunąć WSZYSTKIE zapisane listy?')) return
  await DB.clear()
  if (currentList?.saved) currentList = null
  await mountHistoryIsland()
  toast('Historia wyczyszczona 🗑')
}

// ── ShoppingList island ───────────────────────────────────────────────────────
function ShoppingList({ list, onSave, onDiscard }) {
  const [cats, setCats] = useState(list ? list.categories : [])
  const [isSaved, setIsSaved] = useState(list ? list.saved : false)
  const collapseRef = useRef(null)
  const prevAllDone = useRef(false)

  const allItems = cats.flatMap(c => c.items)
  const done = allItems.filter(i => i.checked).length
  const allDone = allItems.length > 0 && allItems.every(i => i.checked)

  useEffect(() => {
    if (allDone && !prevAllDone.current) confetti({ particleCount: 120, spread: 70, origin: { y: 0.6 } })
    prevAllDone.current = allDone
  }, [allDone])

  if (!list) return html`
    <div class="text-center py-16 px-6 text-white/45">
      <div class="text-[48px] mb-3">📝</div>
      <p class="text-[14px] leading-7">Brak aktywnej listy.<br>Stwórz nową w zakładce "Nowa".</p>
    </div>`

  function toggleItem(ci, ii) {
    let willCollapse = false
    const next = cats.map((c, catIdx) => {
      if (catIdx !== ci) return c
      const newItems = c.items.map((item, itemIdx) =>
        itemIdx !== ii ? item : { ...item, checked: !item.checked }
      )
      const nowChecked = newItems[ii].checked
      if (!nowChecked) return { ...c, items: newItems, collapsed: false, manualExpand: false }
      if (newItems.every(i => i.checked) && !c.manualExpand) willCollapse = true
      return { ...c, items: newItems }
    })
    setCats(next)
    if (willCollapse) {
      clearTimeout(collapseRef.current)
      collapseRef.current = setTimeout(() => {
        setCats(p => p.map((c, i) => i === ci ? { ...c, collapsed: true } : c))
      }, 450)
    }
    if (isSaved) {
      currentList.categories = next
      DB.save(currentList).catch(e => console.error('Auto-save failed', e))
    }
  }

  function toggleCat(ci) {
    setCats(p => p.map((c, i) =>
      i !== ci ? c : { ...c, collapsed: !c.collapsed, manualExpand: c.collapsed }
    ))
  }

  async function handleSave() {
    currentList.categories = cats
    await onSave()
    setIsSaved(true)
  }

  return html`
    <div>
      <div class="mb-5 pt-1">
        <div class="flex items-baseline justify-between mb-2">
          <div class="text-[17px] font-semibold text-white/90 truncate pr-3">${list.title}</div>
          <div class="text-[12px] text-white/50 shrink-0">${done} / ${allItems.length}</div>
        </div>
        <div class="h-[2px] bg-white/[0.07] rounded-full overflow-hidden">
          <div class="progress-fill h-full rounded-full"
            style=${{ width: allItems.length ? `${done / allItems.length * 100}%` : '0%' }} />
        </div>
      </div>

      ${cats.map((cat, ci) => {
        const catDone = cat.items.filter(i => i.checked).length
        const catAllDone = catDone === cat.items.length && cat.items.length > 0
        return html`
          <div class="border-t border-white/[0.07] pt-1 mb-1" key=${cat.name + ci}>
            <div class="flex items-center justify-between py-2 px-1 cursor-pointer select-none"
              onClick=${() => toggleCat(ci)}>
              <div class="flex items-center gap-2 text-[11px] tracking-widest uppercase text-white/55">
                <span>${cat.emoji}</span>
                <span>${cat.name}</span>
                <span class="opacity-60">(${catDone}/${cat.items.length})</span>
                ${catAllDone && html`<span class="bg-accent/20 text-accent text-[10px] px-2 py-0.5 rounded-full">✓ gotowe</span>`}
              </div>
              <span class="cat-chevron text-white/45 text-[11px] ${cat.collapsed ? 'up' : ''}">▼</span>
            </div>
            <div class="cat-grid ${cat.collapsed ? 'collapsed' : ''}">
              <div class="cat-grid-inner">
                <div>
                  ${cat.items.map((item, ii) => html`
                    <div class="flex items-center px-1 py-[13px] border-b border-white/[0.07] last:border-0 cursor-pointer active:opacity-70"
                      onClick=${() => toggleItem(ci, ii)} key=${ii}>
                      <div class="w-5 h-5 rounded-[6px] border shrink-0 mr-3 flex items-center justify-center transition-all ${item.checked ? 'bg-accent border-accent' : 'border-white/30'}">
                        ${item.checked && html`<svg width="11" height="8" viewBox="0 0 13 10" fill="none">
                          <path d="M1 5L5 9L12 1" stroke="#0f0f1a" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
                        </svg>`}
                      </div>
                      <span class="text-[15px] ${item.checked ? 'text-white/40 line-through' : 'text-white/90'}">${item.name}</span>
                    </div>
                  `)}
                </div>
              </div>
            </div>
          </div>`
      })}
    </div>`
}

// ── HistoryList island ────────────────────────────────────────────────────────
function HistoryList({ lists, onLoad, onDelete, onClear }) {
  const header = html`
    <div class="flex justify-between items-center mb-4">
      <h2 class="text-white/60 text-[12px] font-semibold tracking-widest uppercase">Historia list</h2>
      <button class="text-red-400/60 text-[12px] cursor-pointer border-none bg-transparent py-1 px-2 active:text-red-400"
        onClick=${onClear}>Wyczyść</button>
    </div>`

  if (!lists.length) return html`
    <div>
      ${header}
      <div class="text-center py-16 px-6 text-white/45">
        <div class="text-[48px] mb-3">📭</div>
        <p class="text-[14px] leading-7">Brak zapisanych list.<br>Stwórz pierwszą w zakładce "Nowa".</p>
      </div>
    </div>`

  return html`
    <div>
      ${header}
      ${lists.map(l => {
        const items = l.categories.flatMap(c => c.items)
        const done  = items.filter(i => i.checked).length
        return html`
          <div class="py-3.5 border-b border-white/[0.07] cursor-pointer relative active:opacity-60 transition-opacity"
            onClick=${() => onLoad(l.id)} key=${l.id}>
            <button class="absolute top-3 right-3 bg-transparent border-none text-white/35 text-[15px] cursor-pointer p-1 active:text-red-400 transition-colors"
              onClick=${e => { e.stopPropagation(); onDelete(l.id) }}>🗑</button>
            <div class="text-[11px] text-white/45 mb-0.5">${fmtDateFull(l.date)}</div>
            <div class="text-[15px] font-semibold text-white/90 mb-2">${l.title}</div>
            <div class="flex flex-wrap gap-1.5">
              <span class="text-[11px] px-2 py-0.5 bg-white/[0.06] rounded-full text-white/50">📦 ${items.length} produktów</span>
              <span class="text-[11px] px-2 py-0.5 bg-white/[0.06] rounded-full text-white/50">✓ ${done} kupionych</span>
              ${l.categories.map(c => html`
                <span class="text-[11px] px-2 py-0.5 bg-white/[0.06] rounded-full text-white/50">${c.emoji} ${c.name}</span>
              `)}
            </div>
          </div>`
      })}
    </div>`
}

// ── Island mount lifecycle ────────────────────────────────────────────────────
function mountListIsland() {
  const el = document.getElementById('categories-container')
  if (el) render(
    html`<${ShoppingList} list=${currentList} onSave=${saveCurrentList} onDiscard=${discardCurrentList} />`,
    el
  )
}

async function mountHistoryIsland() {
  const el = document.getElementById('history-container')
  if (!el) return
  const lists = await DB.getAll()
  render(
    html`<${HistoryList} lists=${lists} onLoad=${loadHistory} onDelete=${delHistory} onClear=${clearAllHistory} />`,
    el
  )
}

document.addEventListener('htmx:afterSwap', async (e) => {
  if (e.detail.target.id !== 'main-content') return
  if (currentView === 'list')    mountListIsland()
  if (currentView === 'history') await mountHistoryIsland()
})

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
function toast(msg, dur = 2500) {
  const el = document.getElementById('toast')
  el.textContent = msg
  el.classList.add('show')
  clearTimeout(_toastTimer)
  _toastTimer = setTimeout(() => el.classList.remove('show'), dur)
}
function fmtDate(ts) {
  return new Date(ts).toLocaleDateString('pl-PL', { day: 'numeric', month: 'short' })
}
function fmtDateFull(ts) {
  return new Date(ts).toLocaleString('pl-PL', {
    day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

// ── window.App namespace ──────────────────────────────────────────────────────
window.App = {
  openModal, closeModal, handleOverlayClick, toggleReveal,
  saveSettings, saveFromSetup, clearApiKey,
  processWithMistral, handleNavClick,
  saveCurrentList, discardCurrentList, clearAllHistory,
}

// ── Invite ────────────────────────────────────────────────────────────────────
async function handleInviteToken() {
  const params = new URLSearchParams(window.location.search)
  const token = params.get('token')
  if (!token) return
  try {
    const res = await fetch(`/api/invite?token=${encodeURIComponent(token)}`)
    if (!res.ok) { toast('Nieprawidłowy link zaproszenia'); return }
    const { key } = await res.json()
    localStorage.setItem(LS_KEY, key)
    history.replaceState(null, '', window.location.pathname)
    updateKeyIndicator()
    toast('Klucz API ustawiony ✓ Możesz korzystać z aplikacji', 4000)
  } catch {
    toast('Nieprawidłowy link zaproszenia')
  }
}

// ── Boot ──────────────────────────────────────────────────────────────────────
if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {})

DB.init().then(async () => {
  updateKeyIndicator()
  await handleInviteToken()
  checkKeyAndRoute()
})
