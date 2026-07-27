import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS, SettingsStore } from '../../src/core/settings'

/**
 * Vitest's node environment has no localStorage. SettingsStore only needs
 * getItem/setItem, so a minimal in-memory stub exercises real save/load.
 */
class MemoryStorage implements Storage {
  private readonly map = new Map<string, string>()

  get length(): number {
    return this.map.size
  }

  clear(): void {
    this.map.clear()
  }

  getItem(key: string): string | null {
    return this.map.has(key) ? (this.map.get(key) as string) : null
  }

  key(index: number): string | null {
    return [...this.map.keys()][index] ?? null
  }

  removeItem(key: string): void {
    this.map.delete(key)
  }

  setItem(key: string, value: string): void {
    this.map.set(key, value)
  }
}

let originalLocalStorage: Storage | undefined

beforeEach(() => {
  originalLocalStorage = (globalThis as { localStorage?: Storage }).localStorage
  ;(globalThis as { localStorage?: Storage }).localStorage = new MemoryStorage()
})

afterEach(() => {
  if (originalLocalStorage === undefined) {
    delete (globalThis as { localStorage?: Storage }).localStorage
  } else {
    ;(globalThis as { localStorage?: Storage }).localStorage = originalLocalStorage
  }
})

describe('SettingsStore defaults', () => {
  it('returns the default settings when nothing is saved', () => {
    const store = new SettingsStore('empty-key')

    expect(store.current).toEqual(DEFAULT_SETTINGS)
  })
})

describe('SettingsStore persistence', () => {
  it('round-trips saved settings into a new store', () => {
    const writer = new SettingsStore('round-trip-key')
    writer.update({ volume: 0.2, sensitivity: 1.5, fov: 90 })

    const reader = new SettingsStore('round-trip-key')

    expect(reader.current).toEqual({ volume: 0.2, sensitivity: 1.5, fov: 90 })
  })

  it('persists a partial update without losing the other fields', () => {
    const store = new SettingsStore('partial-key')
    store.update({ volume: 0.7 })
    store.update({ fov: 95 })

    const reader = new SettingsStore('partial-key')

    expect(reader.current).toEqual({ volume: 0.7, sensitivity: 1, fov: 95 })
  })
})

describe('SettingsStore validation', () => {
  it('clamps an out-of-range volume back into bounds on load', () => {
    ;(globalThis.localStorage as Storage).setItem(
      'clamp-volume',
      JSON.stringify({ volume: 5, sensitivity: 1, fov: 75 }),
    )
    const store = new SettingsStore('clamp-volume')

    expect(store.current.volume).toBe(1)
  })

  it('clamps out-of-range sensitivity and fov on load', () => {
    ;(globalThis.localStorage as Storage).setItem(
      'clamp-other',
      JSON.stringify({ volume: 0.5, sensitivity: 99, fov: 10 }),
    )
    const store = new SettingsStore('clamp-other')

    expect(store.current.sensitivity).toBe(3)
    expect(store.current.fov).toBe(60)
  })

  it('falls back to defaults on malformed JSON instead of throwing', () => {
    ;(globalThis.localStorage as Storage).setItem('malformed', '{not valid json::')
    const store = new SettingsStore('malformed')

    expect(store.current).toEqual(DEFAULT_SETTINGS)
  })

  it('keeps a valid volume of zero (not replaced by the default)', () => {
    ;(globalThis.localStorage as Storage).setItem(
      'zero-volume',
      JSON.stringify({ volume: 0, sensitivity: 1, fov: 75 }),
    )
    const store = new SettingsStore('zero-volume')

    expect(store.current.volume).toBe(0)
  })

  it('falls back to defaults for values with an invalid runtime type', () => {
    ;(globalThis.localStorage as Storage).setItem(
      'invalid-types',
      JSON.stringify({ volume: false, sensitivity: {}, fov: '90' }),
    )

    const store = new SettingsStore('invalid-types')

    expect(store.current).toEqual(DEFAULT_SETTINGS)
  })
})

describe('SettingsStore change notification', () => {
  it('fires onChanged with the new settings after a real change', () => {
    const store = new SettingsStore('notify-key')
    let received: ReturnType<typeof store.current.valueOf> | null = null
    store.onChanged = (s) => {
      received = s
    }

    store.update({ fov: 88 })

    expect(received).toEqual({ volume: 0.45, sensitivity: 1, fov: 88 })
  })

  it('does not fire onChanged when the clamped result is unchanged', () => {
    const store = new SettingsStore('no-notify-key')
    let calls = 0
    store.onChanged = () => {
      calls++
    }

    // 200 fov clamps to 100, but the default is 75 — that IS a change.
    store.update({ fov: 200 })
    expect(calls).toBe(1)

    // Same effective value (already clamped to 100) must not re-notify.
    store.update({ fov: 250 })
    expect(calls).toBe(1)
  })

  it('rejects non-finite runtime update values', () => {
    const store = new SettingsStore('invalid-update-key')

    store.update({ fov: Number.NaN })

    expect(store.current.fov).toBe(DEFAULT_SETTINGS.fov)
  })
})
