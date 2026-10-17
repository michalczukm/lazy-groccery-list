import type { FC } from 'hono/jsx'
import { Icon } from '../icon'

interface InputViewProps {
  integrationUrl?: string
}

export const InputView: FC<InputViewProps> = ({ integrationUrl = '/integrations' }) => {
  const integrationPrompt = `Przeczytaj instrukcje integracji Lazy List pod adresem ${integrationUrl} i użyj ich, żeby przygotować dla mnie gotowy link do listy zakupów na podstawie mojej wiadomości.`

  return (
    <div class="input-view view-content">
      <label class="input-label" for="shopping-input">
        Produkty do kupienia
      </label>
      <textarea
        id="shopping-input"
        class="shopping-input"
        placeholder={
          'Wklej lub wpisz listę zakupów…\n\nNp:\nMleko\nJogurt grecki\nChleb\nFilet z kurczaka\nPomidory 600g'
        }
      />

      <button
        id="process-btn"
        class="primary-button generate-button"
        onclick="App.processWithMistral()"
      >
        Generuj listę <Icon name="arrow-right" />
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
