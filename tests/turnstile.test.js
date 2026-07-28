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
  /** @type {string[]} */
  const reset = []
  let n = 0
  /** @type {null | 'throw' | 'empty'} */
  let renderFailure = null
  /** @type {string | null} */
  let failFor = null
  let resetThrows = false
  const api = {
    /**
     * @param {string} container
     * @param {any} opts
     */
    render(container, opts) {
      if (renderFailure && (failFor === null || failFor === container)) {
        const mode = renderFailure
        renderFailure = null
        failFor = null
        if (mode === 'throw') throw new Error('render blew up')
        return undefined
      }
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
    /** @param {string} id */
    reset(id) {
      if (resetThrows) throw new Error('reset blew up')
      reset.push(id)
    },
  }
  return {
    api,
    renders,
    removed,
    executed,
    reset,
    /**
     * @param {'throw' | 'empty'} mode
     * @param {string | null} [container]
     */
    failNextRender(mode, container = null) {
      renderFailure = mode
      failFor = container
    },
    setResetThrows() {
      resetThrows = true
    },
  }
}

function fakeDocument() {
  /** @type {string[]} */
  const wiped = []
  return {
    api: {
      /** @param {string} selector */
      querySelector(selector) {
        return {
          replaceChildren() {
            wiped.push(selector)
          },
        }
      },
    },
    wiped,
  }
}

/** @param {ReturnType<typeof fakeTurnstile>} t */
function last(t) {
  return t.renders[t.renders.length - 1]
}

/** @type {ReturnType<typeof fakeTurnstile>} */
let t
/** @type {ReturnType<typeof fakeDocument>} */
let d

beforeEach(() => {
  vi.useFakeTimers()
  t = fakeTurnstile()
  d = fakeDocument()
  globalThis.window = /** @type {any} */ ({ turnstile: t.api })
  globalThis.document = /** @type {any} */ (d.api)
})

afterEach(() => {
  vi.useRealTimers()
  // @ts-expect-error test teardown
  delete globalThis.window
  // @ts-expect-error test teardown
  delete globalThis.document
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

  it('rejects when the Turnstile script never loads', async () => {
    // @ts-expect-error simulating a blocked challenges.cloudflare.com script
    delete globalThis.window
    const log = vi.fn()
    const p = executeTurnstile('site-key', { scriptTimeoutMs: 10000, log })
    const assertion = expect(p).rejects.toThrow('captcha-unavailable')

    await vi.advanceTimersByTimeAsync(10000)
    await assertion
    expect(log).toHaveBeenCalledWith(
      'script-timeout',
      expect.objectContaining({ scriptTimeoutMs: 10000 }),
    )
  })

  it('logs script-ready and silent-success on the happy path', async () => {
    const log = vi.fn()
    const p = executeTurnstile('site-key', { log })
    await vi.advanceTimersByTimeAsync(0)

    last(t).opts.callback('tok-log')
    await expect(p).resolves.toBe('tok-log')

    const events = log.mock.calls.map(c => c[0])
    expect(events).toEqual(['script-ready', 'silent-render', 'silent-success'])
    expect(log.mock.calls[0][1]).toHaveProperty('elapsedMs')
  })

  it('falls back to the visible challenge when the silent render returns undefined', async () => {
    const onChallengeVisible = vi.fn()
    const log = vi.fn()
    t.failNextRender('empty', '#turnstile-widget')
    const p = executeTurnstile('site-key', { onChallengeVisible, log })
    await vi.advanceTimersByTimeAsync(0)

    expect(onChallengeVisible).toHaveBeenCalledTimes(1)
    expect(last(t).container).toBe('#turnstile-challenge-widget')
    expect(log).toHaveBeenCalledWith(
      'silent-render-failed',
      expect.objectContaining({ reason: 'empty' }),
    )

    last(t).opts.callback('tok-empty')
    await expect(p).resolves.toBe('tok-empty')
  })

  it('falls back to the visible challenge when the silent render throws', async () => {
    const onChallengeVisible = vi.fn()
    const log = vi.fn()
    t.failNextRender('throw', '#turnstile-widget')
    const p = executeTurnstile('site-key', { onChallengeVisible, log })
    await vi.advanceTimersByTimeAsync(0)

    expect(onChallengeVisible).toHaveBeenCalledTimes(1)
    expect(last(t).container).toBe('#turnstile-challenge-widget')
    expect(log).toHaveBeenCalledWith(
      'silent-render-failed',
      expect.objectContaining({ reason: 'threw' }),
    )

    last(t).opts.callback('tok-throw')
    await expect(p).resolves.toBe('tok-throw')
  })

  it('wipes a container before rendering into it', async () => {
    const p = executeTurnstile('site-key')
    await vi.advanceTimersByTimeAsync(0)
    expect(d.wiped).toContain('#turnstile-widget')

    last(t).opts['error-callback']()
    await vi.advanceTimersByTimeAsync(0)
    expect(d.wiped).toContain('#turnstile-challenge-widget')

    last(t).opts.callback('tok-wipe')
    await expect(p).resolves.toBe('tok-wipe')
  })

  it('survives remove() throwing during cleanup', async () => {
    t.api.remove = () => {
      throw new Error('already gone')
    }
    const p = executeTurnstile('site-key')
    await vi.advanceTimersByTimeAsync(0)

    last(t).opts.callback('tok-remove')
    await expect(p).resolves.toBe('tok-remove')
  })
})
