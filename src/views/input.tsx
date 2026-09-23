import type { FC } from 'hono/jsx'

interface InputViewProps {
  integrationUrl?: string
}

export const InputView: FC<InputViewProps> = ({ integrationUrl = '/integrations' }) => {
  const integrationPrompt = `Przeczytaj instrukcje integracji Lazy List pod adresem ${integrationUrl} i użyj ich, żeby przygotować dla mnie gotowy link do listy zakupów na podstawie mojej wiadomości.`

  return (
    <div class="flex flex-col h-full p-4 md:max-w-2xl md:mx-auto md:w-full">
      <textarea
        id="shopping-input"
        class="w-full flex-1 min-h-0 resize-none border border-fg/10 rounded-xl p-3.5 text-[15px] outline-none bg-surface text-fg/90 placeholder:text-muted focus:border-accent/40"
        placeholder={
          'Wklej lub wpisz listę zakupów…\n\nNp:\nMleko\nJogurt grecki\nChleb\nFilet z kurczaka\nPomidory 600g'
        }
      />

      <button
        id="process-btn"
        class="block w-full bg-surface text-accent py-3.5 rounded-xl text-[15px] font-semibold cursor-pointer mt-3 border border-accent/20 active:scale-[0.98] active:opacity-85"
        onclick="App.processWithMistral()"
      >
        ✨ Generuj listę
      </button>

      <div id="templates-chips" />

      <div class="mt-3 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[12px] text-muted">
        <button
          type="button"
          class="hover:text-fg/60 active:text-fg/60"
          onclick={`navigator.clipboard.writeText(${JSON.stringify(integrationPrompt)})`}
        >
          Kopiuj prompt
        </button>
        <a href="/privacy" class="hover:text-fg/60 active:text-fg/60">
          Polityka prywatności
        </a>
      </div>
    </div>
  )
}
