const MODEL = 'mistral-small-latest'
const MISTRAL_URL = 'https://api.mistral.ai/v1/chat/completions'

const CATEGORIES: Record<string, { emoji: string; description: string }> = {
  'nabiał': { emoji: '🥛', description: 'mleko, jogurty, sery, twarogi, jajka, śmietana, masło, skyr, serek, actimel' },
  'mięso i wędliny': { emoji: '🥩', description: 'mięso surowe, kurczak, wędlina, parówki, kiełbasa, szynka' },
  'warzywa': { emoji: '🥦', description: 'wszystkie warzywa świeże, włoszczyzna, cukinia, papryka' },
  'owoce': { emoji: '🍎', description: 'wszystkie owoce świeże' },
  'pieczywo': { emoji: '🍞', description: 'chleb, bułki, bagietki, tortille' },
  'napoje': { emoji: '🥤', description: 'sosy, octy, musztarda' },
  'suche produkty': { emoji: '🌾', description: 'płatki, ryż, makaron, kasza, mąka, orzechy' },
  'przyprawy i sosy': { emoji: '🧂', description: 'oleje, oliwy, sosy, octy, musztarda' },
  'gotowe dania': { emoji: '🍱', description: 'gotowe sałatki, dania gotowe, mrożonki' },
  'chemia i higiena': { emoji: '🧴', description: 'środki czystości, kosmetyki, artykuły higieny' },
  'inne': { emoji: '🛒', description: 'wszystko co nie pasuje do powyższych' },
} as const

const SYSTEM = `Jesteś asystentem do kategoryzowania list zakupów po polsku.
Dostajesz surową listę produktów (mogą być po jednym na linię, mogą być notatki w nawiasach, niektóre mogą być łączone np przez "i" albo "oraz").
Przypisz każdy produkt do odpowiedniej kategorii. Zachowaj ORYGINALNE nazwy produktów razem z uwagami w nawiasach.

Dostępne kategorie (użyj tylko tych, które mają produkty):
${JSON.stringify(CATEGORIES, null, 2)}`

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
} as const

export type Category = { name: string; emoji: string; items: string[] }
export type CategorizeResult =
  | { ok: true; categories: Category[] }
  | { ok: false; reason: 'upstream' | 'parse' }

export const categorize = async (
  rawText: string,
  apiKey: string,
): Promise<CategorizeResult> => {
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

  const data = await res.json().catch(() => null) as { choices?: Array<{ message?: { content?: string } }> } | null
  const content = data?.choices?.[0]?.message?.content ?? ''
  try {
    const parsed = JSON.parse(content) as { categories?: Category[] }
    if (!Array.isArray(parsed?.categories)) return { ok: false, reason: 'parse' }
    return { ok: true, categories: parsed.categories }
  } catch {
    return { ok: false, reason: 'parse' }
  }
}
