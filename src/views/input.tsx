import type { FC } from 'hono/jsx'

export const InputView: FC = () => (
  <div class="p-4" style="padding-bottom:calc(80px + env(safe-area-inset-bottom,0px))">
    <div id="status-badge" class="status-badge idle">
      <div class="sdot" />
      <span id="status-text">Gotowy — wpisz listę zakupów</span>
    </div>

    <textarea id="shopping-input"
      class="w-full h-[190px] resize-none border border-white/10 rounded-xl p-3.5 text-[15px] outline-none bg-navy text-white/90 placeholder:text-white/20 focus:border-accent/40"
      placeholder={'Wklej lub wpisz listę zakupów…\n\nNp:\nMleko\nJogurt grecki\nChleb\nFilet z kurczaka\nPomidory 600g'}
    />

    <button id="process-btn"
      class="block w-full bg-navy text-accent py-3.5 rounded-xl text-[15px] font-semibold cursor-pointer mt-3 border border-accent/20 active:scale-[0.98] active:opacity-85"
      onclick="App.processWithMistral()">
      ✨ Zrób listę z AI
    </button>
  </div>
)
