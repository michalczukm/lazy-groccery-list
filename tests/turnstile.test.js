import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { executeTurnstile } from '../public/turnstile.js'

/**
 * @typedef {{ container: string, opts: any, id: string }} RenderCall
 */

function fakeTurnstile() {
  /** @type {RenderCall[]} */
  const renders = []
  /** @type {string[]} */
  const removed = []
  /** @type {string[]} */
  const executed = []
  let n = 0
  const api = {
    /**
     * @param {string} container
     * @param {any} opts
     */
    render(container, opts) {
      const id = `w${++n}`
      renders.push({ container, opts, id })
      return id
    },
    /** @param {string} id */
    remove(id) {
      removed.push(id)
    },
    /** @param {string} id */
    execute(id) {
      executed.push(id)
    },
  }
  return { api, renders, removed, executed }
}

/** @param {ReturnType<typeof fakeTurnstile>} t */
function last(t) {
  return t.renders[t.renders.length - 1]
}

/** @type {ReturnType<typeof fakeTurnstile>} */
let t

beforeEach(() => {
  vi.useFakeTimers()
  t = fakeTurnstile()
  globalThis.window = /** @type {any} */ ({ turnstile: t.api })
})

afterEach(() => {
  vi.useRealTimers()
  // @ts-expect-error test teardown
  delete globalThis.window
})

describe('executeTurnstile', () => {
  it('resolves with the token from the silent widget', async () => {
    const onChallengeVisible = vi.fn()
    const p = executeTurnstile('site-key', { onChallengeVisible })
    await vi.advanceTimersByTimeAsync(0)

    const silent = last(t)
    expect(silent.container).toBe('#turnstile-widget')
    expect(silent.opts.appearance).toBe('interaction-only')
    expect(silent.opts.execution).toBe('execute')
    expect(silent.opts.size).toBe('flexible')
    expect(t.executed).toEqual([silent.id])

    silent.opts.callback('tok-1')
    await expect(p).resolves.toBe('tok-1')
    expect(onChallengeVisible).not.toHaveBeenCalled()
    expect(t.removed).toContain(silent.id)
  })

  it.each([['error-callback'], ['timeout-callback'], ['unsupported-callback']])(
    'falls back to a visible challenge on %s',
    async cb => {
      const onChallengeVisible = vi.fn()
      const onChallengeHidden = vi.fn()
      const p = executeTurnstile('site-key', { onChallengeVisible, onChallengeHidden })
      await vi.advanceTimersByTimeAsync(0)

      const silent = last(t)
      silent.opts[cb]()
      await vi.advanceTimersByTimeAsync(0)

      expect(t.removed).toContain(silent.id)
      expect(onChallengeVisible).toHaveBeenCalledTimes(1)

      const visible = last(t)
      expect(visible.container).toBe('#turnstile-challenge-widget')
      expect(visible.opts.appearance).toBe('always')
      expect(visible.opts.execution).toBeUndefined()
      expect(t.executed).toEqual([silent.id])

      visible.opts.callback('tok-2')
      await expect(p).resolves.toBe('tok-2')
      expect(onChallengeHidden).toHaveBeenCalledTimes(1)
      expect(t.removed).toContain(visible.id)
    },
  )

  it('falls back when the silent widget never calls back', async () => {
    const onChallengeVisible = vi.fn()
    const p = executeTurnstile('site-key', { onChallengeVisible, timeoutMs: 8000 })
    await vi.advanceTimersByTimeAsync(0)

    expect(onChallengeVisible).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(8000)
    expect(onChallengeVisible).toHaveBeenCalledTimes(1)
    expect(last(t).container).toBe('#turnstile-challenge-widget')

    last(t).opts.callback('tok-3')
    await expect(p).resolves.toBe('tok-3')
  })

  it('rejects when the visible challenge errors', async () => {
    const onChallengeHidden = vi.fn()
    const p = executeTurnstile('site-key', { onChallengeHidden })
    await vi.advanceTimersByTimeAsync(0)

    const silent = last(t)
    silent.opts['error-callback']('600010')
    await vi.advanceTimersByTimeAsync(0)

    const visible = last(t)
    visible.opts['error-callback']('600010')
    await expect(p).rejects.toThrow('captcha-failed')
    expect(onChallengeHidden).toHaveBeenCalledTimes(1)
    expect(t.removed).toEqual(expect.arrayContaining([silent.id, visible.id]))
  })

  it('rejects when the user cancels the visible challenge', async () => {
    const onChallengeHidden = vi.fn()
    /** @type {() => void} */
    let cancel = () => {}
    const p = executeTurnstile('site-key', {
      onChallengeHidden,
      onCancel: fn => {
        cancel = fn
      },
    })
    await vi.advanceTimersByTimeAsync(0)

    last(t).opts['error-callback']()
    await vi.advanceTimersByTimeAsync(0)
    const visible = last(t)

    cancel()
    await expect(p).rejects.toThrow('captcha-failed')
    expect(onChallengeHidden).toHaveBeenCalledTimes(1)
    expect(t.removed).toContain(visible.id)
  })

  it('enters the visible stage at most once', async () => {
    const onChallengeVisible = vi.fn()
    const p = executeTurnstile('site-key', { onChallengeVisible, timeoutMs: 8000 })
    await vi.advanceTimersByTimeAsync(0)

    const silent = last(t)
    silent.opts['error-callback']()
    await vi.advanceTimersByTimeAsync(0)
    silent.opts['timeout-callback']()
    await vi.advanceTimersByTimeAsync(8000)

    expect(onChallengeVisible).toHaveBeenCalledTimes(1)
    expect(t.renders).toHaveLength(2)

    last(t).opts.callback('tok-4')
    await expect(p).resolves.toBe('tok-4')
  })

  it('does not fire the watchdog after the silent widget resolves', async () => {
    const onChallengeVisible = vi.fn()
    const p = executeTurnstile('site-key', { onChallengeVisible, timeoutMs: 8000 })
    await vi.advanceTimersByTimeAsync(0)

    last(t).opts.callback('tok-5')
    await expect(p).resolves.toBe('tok-5')

    await vi.advanceTimersByTimeAsync(20000)
    expect(onChallengeVisible).not.toHaveBeenCalled()
    expect(t.renders).toHaveLength(1)
  })
})
