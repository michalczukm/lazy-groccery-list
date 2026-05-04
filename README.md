# 🛒 Zakupy AI — PWA

Inteligentna lista zakupów z Gemini Nano (Chrome Built-in AI).

## Wymagania

- **Chrome 127+** na desktopie lub Android
- Włączony Gemini Nano (patrz niżej)
- Min. 22 GB wolnego miejsca (model AI)

## Włączenie Gemini Nano

1. Wpisz w pasku adresu Chrome:
   `chrome://flags/#optimization-guide-on-device-model`
   → Ustaw: **Enabled BypassPerfRequirement**

2. Następnie:
   `chrome://flags/#prompt-api-for-gemini-nano`
   → Ustaw: **Enabled**

3. Uruchom Chrome ponownie.

4. Odwiedź `chrome://components/` i zaktualizuj **Optimization Guide On Device Model**.

## Uruchomienie lokalne

PWA wymaga serwera HTTP (nie działa z `file://`):

```bash
# Node.js
npx serve .

# Python
python3 -m http.server 8080
```

Otwórz `http://localhost:3000` (lub port z powyższego).

## Deployment

Skopiuj pliki na dowolny statyczny hosting (Netlify, Vercel, S3, GitHub Pages).
Aplikacja działa w pełni offline po pierwszym załadowaniu.

## Pliki

```
index.html       — główna aplikacja
manifest.json    — konfiguracja PWA
sw.js            — service worker (offline cache)
icon.svg         — ikona aplikacji
icon-maskable.svg — ikona do adaptive icons (Android)
```

## Dane

Listy zakupów są przechowywane lokalnie w **IndexedDB** przeglądarki.
Żadne dane nie są wysyłane na zewnętrzne serwery.
