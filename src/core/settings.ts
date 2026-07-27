import { clamp } from './math-utils'

/**
 * Player-tunable game settings. Persisted to localStorage so preferences
 * survive reloads. Every value is validated on load — corrupt or out-of-range
 * storage is clamped back to a safe value rather than crashing gameplay.
 */
export interface GameSettings {
  /** Master volume gain, 0 (silent) .. 1 (full). */
  volume: number
  /** Look sensitivity multiplier applied to the base mouse-turn rate. */
  sensitivity: number
  /** Vertical field of view in degrees, matching Three.js PerspectiveCamera. */
  fov: number
}

const STORAGE_KEY = 'mcadv-settings'

/** Enforced bounds; out-of-range storage is clamped, never dropped. */
const VOLUME_MIN = 0
const VOLUME_MAX = 1
const SENSITIVITY_MIN = 0.25
const SENSITIVITY_MAX = 3
const FOV_MIN = 60
const FOV_MAX = 100

/** Defaults match the pre-settings hardcoded values so existing players see no change. */
export const DEFAULT_SETTINGS: GameSettings = {
  volume: 0.45,
  sensitivity: 1,
  fov: 75,
}

/** Clamp every field, filling missing ones with the defaults. */
function normalize(partial: Partial<GameSettings>): GameSettings {
  return {
    volume: clampNumber(partial.volume, DEFAULT_SETTINGS.volume, VOLUME_MIN, VOLUME_MAX),
    sensitivity: clampNumber(
      partial.sensitivity,
      DEFAULT_SETTINGS.sensitivity,
      SENSITIVITY_MIN,
      SENSITIVITY_MAX,
    ),
    fov: clampNumber(partial.fov, DEFAULT_SETTINGS.fov, FOV_MIN, FOV_MAX),
  }
}

function clampNumber(value: unknown, fallback: number, min: number, max: number): number {
  return clamp(
    typeof value === 'number' && Number.isFinite(value) ? value : fallback,
    min,
    max,
  )
}

export class SettingsStore {
  private settings: GameSettings
  /** Fired after any validated change with the new full settings. */
  onChanged: ((settings: GameSettings) => void) | null = null

  constructor(private readonly storageKey = STORAGE_KEY) {
    this.settings = this.read()
  }

  get current(): GameSettings {
    return this.settings
  }

  /** Validate, merge, persist and notify. A no-op when nothing actually changed. */
  update(patch: Partial<GameSettings>): void {
    const next = normalize({ ...this.settings, ...patch })
    if (
      next.volume === this.settings.volume &&
      next.sensitivity === this.settings.sensitivity &&
      next.fov === this.settings.fov
    ) {
      return
    }
    this.settings = next
    this.persist()
    this.onChanged?.(next)
  }

  private read(): GameSettings {
    try {
      const raw = localStorage.getItem(this.storageKey)
      if (!raw) return { ...DEFAULT_SETTINGS }
      return normalize(JSON.parse(raw) as Partial<GameSettings>)
    } catch {
      // Corrupt or unavailable storage: fall back to defaults.
      return { ...DEFAULT_SETTINGS }
    }
  }

  private persist(): void {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(this.settings))
    } catch {
      // Quota or privacy mode: preferences are session-only.
    }
  }
}
