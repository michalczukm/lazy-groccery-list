const MODEL = 'mistral-small-latest'
const MISTRAL_URL = 'https://api.mistral.ai/v1/chat/completions'

const SYSTEM = `Jesteś asystentem do kategoryzowania list zakupów po polsku.
Dostajesz surową listę produktów (mogą być po jednym na linię, mogą być notatki w nawiasach, niektóre mogą być łączone np przez "i" albo "oraz").
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
} as const

export type Category = { name: string; emoji: string; items: string[] }
export type CategorizeResult =
  | { ok: true; categories: Category[] }
  | { ok: false; reason: 'upstream' | 'parse' }

export const categorize = async (
  rawText: string,
  apiKey: string,
  fetchImpl: typeof fetch = fetch,
): Promise<CategorizeResult> => {
  const res = await fetchImpl(MISTRAL_URL, {
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
