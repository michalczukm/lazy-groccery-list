import type { FC, PropsWithChildren } from 'hono/jsx'

const TURNSTILE_PRIVACY_URL = 'https://www.cloudflare.com/en-gb/turnstile-privacy-policy/'

const Section: FC<{ title: string } & PropsWithChildren> = ({ title, children }) => (
  <section class="mt-6">
    <h2 class="text-[16px] font-semibold text-accent mb-1.5">{title}</h2>
    <div class="text-[14px] leading-relaxed text-white/70 space-y-2">{children}</div>
  </section>
)

export const PrivacyView: FC = () => (
  <html lang="pl" class="h-full">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>Polityka prywatności — Lazy List</title>
      <link rel="icon" href="/icon.svg" />
      <meta name="theme-color" content="#1a1a2e" />
      <meta name="robots" content="noindex, nofollow, noarchive, nosnippet" />
      <script src="https://cdn.tailwindcss.com" />
      <script
        dangerouslySetInnerHTML={{
          __html: `tailwind.config = {
          theme: { extend: { colors: {
            navy: '#1a1a2e',
            'navy-dark': '#0f0f1a',
            accent: '#a8edea',
          }}}
        }`,
        }}
      />
    </head>

    <body class="font-sans bg-navy-dark text-white min-h-full">
      <main class="max-w-[640px] mx-auto px-5 py-8">
        <a href="/" class="inline-block text-[13px] text-accent/80 hover:text-accent mb-6">
          ← Wróć
        </a>

        <h1 class="text-[22px] font-bold tracking-tight">🔒 Polityka prywatności</h1>
        <p class="text-[13px] text-white/45 mt-1">Lazy List — prosta apka do list zakupów.</p>

        <Section title="W skrócie">
          <p>
            Nie zakładasz konta, nie zbieramy danych do śledzenia, nie ma reklam. Twoje listy
            zakupów żyją w Twojej przeglądarce. Wysyłamy do przetworzenia tylko tekst, który sam
            wpiszesz, i tylko po to, żeby go pokategoryzować.
          </p>
        </Section>

        <Section title="Dane przechowywane lokalnie">
          <p>
            Twoje listy zakupów zapisujemy w pamięci przeglądarki (IndexedDB) na Twoim urządzeniu.
            Nie trafiają na nasz serwer i zostają u Ciebie, dopóki ich nie usuniesz.
          </p>
        </Section>

        <Section title="Co wysyłamy do przetworzenia">
          <p>
            Gdy generujesz listę, wpisany przez Ciebie tekst trafia do naszego serwera, który
            przekazuje go do <strong>Mistral AI</strong> w celu pokategoryzowania produktów. Nie
            zapisujemy tego tekstu na serwerze — jest przetwarzany i odsyłany jako gotowa lista.
          </p>
        </Section>

        <Section title="Ochrona przed botami — Cloudflare Turnstile">
          <p>
            Żeby chronić apkę przed nadużyciami, używamy mechanizmu Cloudflare Turnstile. Przetwarza
            on m.in. Twój adres IP oraz informacje o przeglądarce. Szczegóły opisuje{' '}
            <a
              href={TURNSTILE_PRIVACY_URL}
              target="_blank"
              rel="noopener noreferrer"
              class="text-accent underline underline-offset-2 break-words"
            >
              polityka prywatności Cloudflare Turnstile
            </a>
            .
          </p>
        </Section>

        <Section title="Adres IP">
          <p>
            Adres IP wykorzystujemy doraźnie — do ograniczania liczby zapytań (ochrona przed
            nadużyciami) oraz do weryfikacji Turnstile. Nie przechowujemy go na stałe.
          </p>
        </Section>

        <Section title="Cookies">
          <p>
            Używamy jednego niezbędnego ciasteczka{' '}
            <code class="text-accent/90">lazy_list_session</code> (httpOnly, podpisanego, ważnego 24
            godziny), które pozwala korzystać z kategoryzacji bez ponownego rozwiązywania wyzwania.
            Nie zawiera danych osobowych. Nie używamy ciasteczek analitycznych ani śledzących.
          </p>
        </Section>

        <Section title="Udostępnianie list">
          <p>
            Gdy tworzysz link do udostępnienia listy, jej zawartość jest zakodowana bezpośrednio w
            adresie URL. Udostępniasz ją dobrowolnie i to Ty decydujesz, komu wyślesz link.
          </p>
        </Section>

        <Section title="Hosting">
          <p>Apka działa na Cloudflare Workers.</p>
        </Section>

        <Section title="Twoja kontrola nad danymi">
          <p>
            Dane usuniesz w każdej chwili — kasując historię w apce albo czyszcząc dane przeglądarki
            dla tej strony.
          </p>
        </Section>

        <Section title="Kod źródłowy">
          <p>
            Sprawdź{' '}
            <a
              href="https://github.com/michalczukm/lazy-groccery-list"
              target="_blank"
              rel="noopener noreferrer"
              class="text-accent underline underline-offset-2 break-words"
            >
              github.com/michalczukm/lazy-groccery-list
            </a>
          </p>
        </Section>

        <p class="text-[12px] text-white/35 mt-10 border-t border-white/10 pt-4">
          Ostatnia aktualizacja: 23 czerwca 2026
        </p>
      </main>
    </body>
  </html>
)
