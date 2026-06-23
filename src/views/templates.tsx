import type { FC } from 'hono/jsx'

export const TemplatesView: FC = () => (
  <div class="p-4" style="padding-bottom:calc(80px + env(safe-area-inset-bottom,0px))">
    <div id="templates-container" />
  </div>
)
