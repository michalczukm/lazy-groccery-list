const MODEL = 'mistral-small-latest'
const MISTRAL_URL = 'https://api.mistral.ai/v1/chat/completions'

const CATEGORIES = {
  nabiał: 'mleko, jogurty, sery, twarogi, jajka, śmietana, masło, skyr, serek, actimel',
  'mięso i wędliny': 'mięso surowe, kurczak, wędlina, parówki, kiełbasa, szynka',
  warzywa: 'wszystkie warzywa świeże, włoszczyzna, cukinia, papryka',
  owoce: 'wszystkie owoce świeże',
  pieczywo: 'chleb, bułki, bagietki, tortille',
  napoje: 'sosy, octy, musztarda',
  'suche produkty': 'płatki, ryż, makaron, kasza, mąka, orzechy',
  'przyprawy i sosy': 'oleje, oliwy, sosy, octy, musztarda',
  'gotowe dania': 'gotowe sałatki, dania gotowe, mrożonki',
  'chemia i higiena': 'środki czystości, kosmetyki, artykuły higieny',
  inne: 'wszystko co nie pasuje do powyższych',
} satisfies Record<string, string>

const SYSTEM = `Jesteś asystentem do kategoryzowania list zakupów po polsku.
Dostajesz surową listę produktów (mogą być po jednym na linię, mogą być notatki w nawiasach, niektóre mogą być łączone np przez "i" albo "oraz").
Przypisz każdy produkt do odpowiedniej kategorii. Zachowaj ORYGINALNE nazwy produktów razem z uwagami w nawiasach.

Dostępne kategorie (użyj tylko tych, które mają produkty):
${JSON.stringify(CATEGORIES)}`

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
              name: { type: 'string', enum: Object.keys(CATEGORIES) },
              items: { type: 'array', items: { type: 'string' } },
            },
            required: ['name', 'items'],
            additionalProperties: false,
          },
        },
      },
      required: ['categories'],
      additionalProperties: false,
    },
  },
} as const

const TITLE_SYSTEM = `Jesteś asystentem do nazywania list zakupów po polsku.
Zaproponuj krótką, naturalną nazwę listy na podstawie kategorii i produktów.
Nazwa ma być pomocna, bez cudzysłowów, maksymalnie 5 słów. Nie dodawaj wyjaśnień.`

const TITLE_RESPONSE_SCHEMA = {
  type: 'json_schema',
  json_schema: {
    name: 'shopping_list_title',
    strict: true,
    schema: {
      type: 'object',
      properties: {
        title: { type: 'string' },
      },
      required: ['title'],
      additionalProperties: false,
    },
  },
} as const

export type Category = { name: string; items: string[] }
export type CategorizeResult =
  | { ok: true; categories: Category[] }
  | { ok: false; reason: 'upstream' | 'parse' }
export type SuggestTitleInput = { currentTitle?: string; categories: Category[] }
export type SuggestTitleResult =
  | { ok: true; title: string }
  | { ok: false; reason: 'upstream' | 'parse' }

export const categorize = async (rawText: string, apiKey: string): Promise<CategorizeResult> => {
  const res = await fetch(MISTRAL_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 1000,
      temperature: 0.1,
      response_format: RESPONSE_SCHEMA,
      messages: [
        { role: 'system', content: SYSTEM },
        { role: 'user', content: `Skategoryzuj tę listę zakupów:\n${rawText}` },
      ],
    }),
  })

  if (!res.ok) return { ok: false, reason: 'upstream' }

  const data = (await res.json().catch(() => null)) as {
    choices?: Array<{ message?: { content?: string } }>
  } | null
  const content = data?.choices?.[0]?.message?.content ?? ''
  try {
    const parsed = JSON.parse(content) as { categories?: Category[] }
    if (!Array.isArray(parsed?.categories)) return { ok: false, reason: 'parse' }
    return { ok: true, categories: parsed.categories }
  } catch {
    return { ok: false, reason: 'parse' }
  }
}

export const suggestTitle = async (
  input: SuggestTitleInput,
  apiKey: string,
): Promise<SuggestTitleResult> => {
  const res = await fetch(MISTRAL_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 80,
      temperature: 0.2,
      response_format: TITLE_RESPONSE_SCHEMA,
      messages: [
        { role: 'system', content: TITLE_SYSTEM },
        {
          role: 'user',
          content: JSON.stringify({
            currentTitle: input.currentTitle ?? '',
            categories: input.categories,
          }),
        },
      ],
    }),
  })

  if (!res.ok) return { ok: false, reason: 'upstream' }

  const data = (await res.json().catch(() => null)) as {
    choices?: Array<{ message?: { content?: string } }>
  } | null
  const content = data?.choices?.[0]?.message?.content ?? ''
  try {
    const parsed = JSON.parse(content) as { title?: unknown }
    const title = typeof parsed.title === 'string' ? parsed.title.trim().slice(0, 60) : ''
    if (!title) return { ok: false, reason: 'parse' }
    return { ok: true, title }
  } catch {
    return { ok: false, reason: 'parse' }
  }
}
