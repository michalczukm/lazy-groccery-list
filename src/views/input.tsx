import type { FC } from 'hono/jsx'
import { Icon } from '../icon'

interface InputViewProps {
  integrationUrl?: string
}

export const InputView: FC<InputViewProps> = ({ integrationUrl = '/integrations' }) => {
  const integrationPrompt = `Przeczytaj instrukcje integracji Lazy List pod adresem ${integrationUrl} i użyj ich, żeby przygotować dla mnie gotowy link do listy zakupów na podstawie mojej wiadomości.`

  return (
    <div class="input-view view-content">
      <label class="lazy-label input-label" for="shopping-input">
        Produkty do kupienia
      </label>
      <textarea
        id="shopping-input"
        class="lazy-field shopping-input"
        placeholder={
          'Wklej lub wpisz listę zakupów…\n\nNp:\nMleko\nJogurt grecki\nChleb\nFilet z kurczaka\nPomidory 600g'
        }
      />

      <button
        id="process-btn"
        class="lazy-button lazy-button--primary generate-button"
        onclick="App.processWithMistral()"
      >
        Generuj listę <Icon name="arrow-right" />
      </button>

      <div id="templates-chips" />

      <div class="mt-3 flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
        <button
          type="button"
          class="lazy-button lazy-button--text"
          onclick={`navigator.clipboard.writeText(${JSON.stringify(integrationPrompt)})`}
        >
          Kopiuj prompt
        </button>
        <a href="/privacy" class="lazy-button lazy-button--text">
          Polityka prywatności
        </a>
      </div>
    </div>
  )
}
