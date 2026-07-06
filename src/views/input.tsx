import type { FC } from 'hono/jsx'

export const InputView: FC = () => (
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

    <a
      href="/privacy"
      class="block text-center text-[12px] text-muted mt-3 hover:text-fg/60 active:text-fg/60"
    >
      Polityka prywatności
    </a>
  </div>
)
