import { cloudflareTest } from '@cloudflare/vitest-pool-workers'
import { defineProject, defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    projects: [
      defineProject({
        test: {
          name: 'unit',
          include: ['tests/**/*.test.{js,ts}'],
        },
      }),
      defineProject({
        plugins: [
          cloudflareTest({
            wrangler: { configPath: './wrangler.test.jsonc' },
          }),
        ],
        test: {
          name: 'workers',
          include: ['src/**/*.test.{ts,tsx}'],
        },
      }),
    ],
  },
})
