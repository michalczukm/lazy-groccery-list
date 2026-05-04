import type { FC } from 'hono/jsx'

export const SetupView: FC = () => (
  <div class="flex flex-col items-center justify-center min-h-[80vh] p-6 text-center">
    <div class="text-[60px] mb-5">🔑</div>
    <div class="text-[22px] font-bold text-white mb-2">Potrzebny klucz API</div>
    <div class="text-[14px] text-white/45 leading-7 mb-7">
      Podaj klucz Mistral API — AI skategoryzuje Twoje listy zakupów lokalnie, bez serwera pośredniego.
    </div>

    <div class="bg-white rounded-[20px] p-6 w-full text-left">
      <div class="text-[12px] text-gray-400 uppercase tracking-wider mb-1.5">Klucz API Mistral</div>
      <div class="relative mb-4">
        <input type="password" id="setup-key-input"
          class="w-full py-3 px-4 border-2 border-gray-200 rounded-xl text-[15px] outline-none text-gray-900 focus:border-indigo-400"
          placeholder="••••••••••••••••••••••••"
          style="padding-right:72px" />
        <button class="absolute right-2.5 top-1/2 -translate-y-1/2 bg-transparent border-none text-gray-400 text-[12px] cursor-pointer px-2 py-1"
          onclick="App.toggleReveal('setup-key-input',this)">Pokaż</button>
      </div>
      <div class="bg-yellow-50 border border-yellow-200 rounded-xl py-3 px-3.5 text-[12px] text-yellow-900 leading-relaxed">
        Klucz wygenerujesz na <strong>console.mistral.ai</strong> → API Keys.<br />
        Użyj tylko uprawnień <em>Inference</em>.
      </div>
      <button class="block w-full bg-navy text-white py-4 rounded-[14px] text-[15px] font-semibold cursor-pointer mt-3 border-none active:scale-[0.98]"
        onclick="App.saveFromSetup()">Zapisz i zacznij →</button>
    </div>
  </div>
)
