import type { FC } from 'hono/jsx'

export const InputView: FC = () => (
  <div class="p-4" style="padding-bottom:calc(80px + env(safe-area-inset-bottom,0px))">
    <div id="status-badge" class="status-badge idle">
      <div class="sdot" />
      <span id="status-text">Gotowy — wpisz listę zakupów</span>
    </div>

    <textarea id="shopping-input"
      class="w-full h-[190px] resize-none border-2 border-gray-200 rounded-2xl p-3.5 text-[15px] outline-none bg-white text-gray-900 focus:border-indigo-400"
      placeholder={'Wklej lub wpisz listę zakupów…\n\nNp:\nMleko\nJogurt grecki\nChleb\nFilet z kurczaka\nPomidory 600g'}
    />

    <button id="process-btn"
      class="block w-full bg-navy text-white py-4 rounded-[14px] text-[15px] font-semibold cursor-pointer mt-3 border-none active:scale-[0.98] active:opacity-85"
      onclick="App.processWithMistral()">
      ✨ Zrób listę z AI
    </button>
  </div>
)
