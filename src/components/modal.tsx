import type { FC } from 'hono/jsx'

export const Modal: FC = () => (
  <div id="modal-overlay" class="hidden fixed inset-0 bg-black/60 z-[300] flex items-end"
    onclick="App.handleOverlayClick(event)">
    <div class="w-full bg-white rounded-t-3xl max-w-[480px] mx-auto max-h-[92vh] overflow-y-auto"
      style="padding:28px 20px calc(24px + env(safe-area-inset-bottom,0px))">

      <div class="w-9 h-1 bg-gray-200 rounded-full mx-auto mb-6" />
      <div class="text-[18px] font-bold mb-1.5">⚙️ Konfiguracja API</div>
      <div class="text-[13px] text-gray-400 mb-4 leading-relaxed">
        Klucz zapisywany w localStorage — nie trafia nigdzie poza Mistral API.
      </div>

      <div class="bg-yellow-50 border border-yellow-200 rounded-xl py-3 px-3.5 text-[12px] text-yellow-900 mb-4 leading-relaxed">
        🔒 localStorage dostępny tylko przez JS z tej samej domeny. Dla osobistej PWA wystarczające — użyj uprawnień <strong>Inference</strong>.
      </div>

      <div class="text-[12px] text-gray-400 uppercase tracking-wider mb-1.5">Klucz API Mistral</div>
      <div class="relative mb-5">
        <input type="password" id="key-input"
          class="w-full py-3 px-4 border-2 border-gray-200 rounded-xl text-[15px] outline-none text-gray-900 focus:border-indigo-400"
          placeholder="••••••••••••••••••••••••"
          style="padding-right:72px" />
        <button class="absolute right-2.5 top-1/2 -translate-y-1/2 bg-transparent border-none text-gray-400 text-[12px] cursor-pointer px-2 py-1"
          onclick="App.toggleReveal('key-input',this)">Pokaż</button>
      </div>

      <button class="block w-full bg-navy text-white py-4 rounded-[14px] text-[15px] font-semibold cursor-pointer mt-3 border-none active:opacity-85"
        onclick="App.saveSettings()">💾 Zapisz ustawienia</button>
      <button class="block w-full bg-transparent text-red-500 text-[13px] cursor-pointer mt-2 border-none py-2.5"
        onclick="App.clearApiKey()">🗑 Usuń klucz API</button>
    </div>
  </div>
)
