import { describe, expect, it } from 'vitest'
import { createPreviewConfig, previewWorkerName } from '../scripts/pr-preview-config.js'

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
})
