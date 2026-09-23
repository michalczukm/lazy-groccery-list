import { describe, expect, it } from 'vitest'
import {
  createPreviewConfig,
  previewVars,
  previewWorkerName,
} from '../scripts/pr-preview-config.js'

describe('previewWorkerName', () => {
  it('builds deterministic per-PR worker names', () => {
    expect(previewWorkerName('42')).toBe('lazy-shopping-list-pr-42')
  })
})

describe('createPreviewConfig', () => {
  it('removes production routes and enables workers.dev while keeping Durable Object config', () => {
    const source = {
      name: 'lazy-shopping-list',
      main: 'src/index.tsx',
      workers_dev: false,
      routes: [{ pattern: 'lazy-shopping.michalczukm.xyz', custom_domain: true }],
      durable_objects: {
        bindings: [{ name: 'LIST_SYNC_ROOMS', class_name: 'ListSyncRoom' }],
      },
      migrations: [{ tag: 'v1', new_sqlite_classes: ['ListSyncRoom'] }],
    }

    expect(createPreviewConfig(source, 42)).toEqual({
      name: 'lazy-shopping-list-pr-42',
      main: 'src/index.tsx',
      workers_dev: true,
      durable_objects: {
        bindings: [{ name: 'LIST_SYNC_ROOMS', class_name: 'ListSyncRoom' }],
      },
      migrations: [{ tag: 'v1', new_sqlite_classes: ['ListSyncRoom'] }],
    })
  })

  it('copies preview vars into new preview workers', () => {
    const source = {
      name: 'lazy-shopping-list',
      main: 'src/index.tsx',
      workers_dev: false,
      vars: { POSTHOG_HOST: 'https://basket.example.com' },
    }

    expect(
      createPreviewConfig(source, 57, {
        vars: { TURNSTILE_SITE_KEY: '0xpreview-site-key' },
      }),
    ).toMatchObject({
      name: 'lazy-shopping-list-pr-57',
      workers_dev: true,
      vars: {
        POSTHOG_HOST: 'https://basket.example.com',
        TURNSTILE_SITE_KEY: '0xpreview-site-key',
      },
    })
  })
})

describe('previewVars', () => {
  it('uses Cloudflare Turnstile test keys for previews without GitHub secrets', () => {
    expect(previewVars(57, {})).toEqual({
      TURNSTILE_SITE_KEY: '1x00000000000000000000BB',
      TURNSTILE_SECRET: '1x0000000000000000000000000000000AA',
      SESSION_HMAC_SECRET: 'preview-session-secret-pr-57',
    })
  })

  it('allows GitHub-provided preview bindings to override defaults', () => {
    expect(
      previewVars(57, {
        TURNSTILE_SITE_KEY: '0xpreview-site-key',
        TURNSTILE_SECRET: '0xpreview-secret',
        SESSION_HMAC_SECRET: 'preview-session-secret',
      }),
    ).toEqual({
      TURNSTILE_SITE_KEY: '0xpreview-site-key',
      TURNSTILE_SECRET: '0xpreview-secret',
      SESSION_HMAC_SECRET: 'preview-session-secret',
    })
  })
})
