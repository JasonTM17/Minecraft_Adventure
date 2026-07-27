import { DEFAULT_SETTINGS, type GameSettings } from '../core/settings'

export interface SettingsPanelCallbacks {
  /** Fired with the full settings whenever any slider moves. */
  onChange: (settings: GameSettings) => void
  /** Fired when the player clicks Back. */
  onBack: () => void
}

/**
 * Interactive settings overlay: master volume, mouse sensitivity and field of
 * view. Reuses the `.screen` base styling so it matches the menu/pause look.
 * Sliders emit live changes so the game reacts immediately (volume, FOV).
 */
export class SettingsPanel {
  private readonly root: HTMLDivElement
  private readonly volumeSlider: HTMLInputElement
  private readonly sensitivitySlider: HTMLInputElement
  private readonly fovSlider: HTMLInputElement
  private readonly volumeLabel: HTMLSpanElement
  private readonly sensitivityLabel: HTMLSpanElement
  private readonly fovLabel: HTMLSpanElement

  constructor(ui: HTMLElement, callbacks: SettingsPanelCallbacks) {
    this.root = document.createElement('div')
    this.root.className = 'screen screen-settings'
    this.root.style.display = 'none'
    ui.appendChild(this.root)

    this.root.innerHTML = `
      <h2 class="settings-title">Settings</h2>
      <div class="settings-rows">
        <label class="settings-row">
          <span class="settings-label">Master Volume</span>
          <input class="settings-slider" data-setting="volume" type="range" min="0" max="1" step="0.01" />
          <span class="settings-value" data-value="volume"></span>
        </label>
        <label class="settings-row">
          <span class="settings-label">Mouse Sensitivity</span>
          <input class="settings-slider" data-setting="sensitivity" type="range" min="0.25" max="3" step="0.05" />
          <span class="settings-value" data-value="sensitivity"></span>
        </label>
        <label class="settings-row">
          <span class="settings-label">Field of View</span>
          <input class="settings-slider" data-setting="fov" type="range" min="60" max="100" step="1" />
          <span class="settings-value" data-value="fov"></span>
        </label>
      </div>
      <button data-action="back">Back</button>
    `

    this.volumeSlider = this.slider('volume')
    this.sensitivitySlider = this.slider('sensitivity')
    this.fovSlider = this.slider('fov')
    this.volumeLabel = this.label('volume')
    this.sensitivityLabel = this.label('sensitivity')
    this.fovLabel = this.label('fov')

    const emit = (): void => callbacks.onChange(this.read())
    this.volumeSlider.addEventListener('input', () => {
      this.refreshLabels()
      emit()
    })
    this.sensitivitySlider.addEventListener('input', () => {
      this.refreshLabels()
      emit()
    })
    this.fovSlider.addEventListener('input', () => {
      this.refreshLabels()
      emit()
    })

    this.root.addEventListener('click', (e) => {
      const action = (e.target as HTMLElement).dataset['action']
      if (action === 'back') callbacks.onBack()
    })
  }

  /** Populate sliders from current settings and reveal the panel. */
  show(settings: GameSettings): void {
    this.volumeSlider.value = String(settings.volume)
    this.sensitivitySlider.value = String(settings.sensitivity)
    this.fovSlider.value = String(settings.fov)
    this.refreshLabels()
    this.root.style.display = 'flex'
  }

  hide(): void {
    this.root.style.display = 'none'
  }

  private slider(name: keyof GameSettings): HTMLInputElement {
    return this.root.querySelector(`[data-setting="${name}"]`) as HTMLInputElement
  }

  private label(name: keyof GameSettings): HTMLSpanElement {
    return this.root.querySelector(`[data-value="${name}"]`) as HTMLSpanElement
  }

  private read(): GameSettings {
    return {
      volume: this.parse(this.volumeSlider.value, DEFAULT_SETTINGS.volume),
      sensitivity: this.parse(this.sensitivitySlider.value, DEFAULT_SETTINGS.sensitivity),
      fov: this.parse(this.fovSlider.value, DEFAULT_SETTINGS.fov),
    }
  }

  /** Parse a slider value; falls back only on a genuinely empty/NaN string. */
  private parse(raw: string, fallback: number): number {
    const v = Number.parseFloat(raw)
    return Number.isNaN(v) ? fallback : v
  }

  private refreshLabels(): void {
    this.volumeLabel.textContent = `${Math.round(this.parse(this.volumeSlider.value, 0) * 100)}%`
    this.sensitivityLabel.textContent = `${this.parse(this.sensitivitySlider.value, 1).toFixed(2)}×`
    this.fovLabel.textContent = `${Math.round(this.parse(this.fovSlider.value, 75))}°`
  }
}
