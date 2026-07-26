import { T } from '../world/texture-atlas'
import type { DragonBoss } from '../entities/dragon-boss'
import type { Inventory } from '../player/inventory'
import type { PlayerController } from '../player/player-controller'
import { LAIR_CENTER_X, LAIR_CENTER_Z } from '../world/lair-generator'

const ATLAS_GRID = 16
const ICON_PX = 16

/** In-game DOM HUD: hearts, hotbar, boss bar, quest banner, damage vignette. */
export class Hud {
  private readonly root: HTMLDivElement
  private readonly hearts: HTMLDivElement[] = []
  private heartsRow!: HTMLDivElement
  private lastBannerText = ''
  private readonly hotbarSlots: Array<{ icon: HTMLDivElement; count: HTMLSpanElement; el: HTMLDivElement }> = []
  private readonly bossBar: HTMLDivElement
  private readonly bossFill: HTMLDivElement
  private readonly banner: HTMLDivElement
  private readonly bannerText: HTMLSpanElement
  private readonly compass: HTMLSpanElement
  private readonly vignette: HTMLDivElement
  private readonly atlasUrl: string
  private vignetteStrength = 0
  private hotbarDirty = true

  constructor(
    ui: HTMLElement,
    atlasCanvas: HTMLCanvasElement,
    private readonly inventory: Inventory,
  ) {
    this.atlasUrl = atlasCanvas.toDataURL()
    this.root = document.createElement('div')
    this.root.className = 'hud'
    ui.appendChild(this.root)

    this.vignette = this.div('vignette')

    this.heartsRow = this.div('hearts')
    const heartsRow = this.heartsRow
    for (let i = 0; i < 10; i++) {
      const heart = document.createElement('div')
      heart.className = 'heart'
      this.applyIcon(heart, T.HEART_EMPTY)
      const fill = document.createElement('div')
      fill.className = 'heart-fill'
      this.applyIcon(fill, T.HEART_FULL)
      heart.appendChild(fill)
      heartsRow.appendChild(heart)
      this.hearts.push(fill)
    }

    const hotbar = this.div('hotbar')
    this.inventory.slots.forEach(() => {
      const slot = document.createElement('div')
      slot.className = 'hotbar-slot'
      const icon = document.createElement('div')
      icon.className = 'hotbar-icon'
      const count = document.createElement('span')
      count.className = 'hotbar-count'
      slot.append(icon, count)
      hotbar.appendChild(slot)
      this.hotbarSlots.push({ icon, count, el: slot })
    })
    this.inventory.onChanged = () => {
      this.hotbarDirty = true
    }

    this.bossBar = this.div('boss-bar')
    this.bossBar.innerHTML = '<span class="boss-name">Fire Dragon</span>'
    this.bossFill = document.createElement('div')
    this.bossFill.className = 'boss-fill'
    this.bossBar.appendChild(this.bossFill)
    this.bossBar.style.display = 'none'

    this.banner = this.div('quest-banner')
    this.compass = document.createElement('span')
    this.compass.className = 'compass'
    this.compass.textContent = '➤'
    this.bannerText = document.createElement('span')
    this.banner.append(this.compass, this.bannerText)
  }

  private div(className: string): HTMLDivElement {
    const el = document.createElement('div')
    el.className = className
    this.root.appendChild(el)
    return el
  }

  private applyIcon(el: HTMLElement, tile: number): void {
    const col = tile % ATLAS_GRID
    const row = Math.floor(tile / ATLAS_GRID)
    el.style.backgroundImage = `url(${this.atlasUrl})`
    el.style.backgroundSize = `${ATLAS_GRID * ICON_PX * 2}px`
    el.style.backgroundPosition = `-${col * ICON_PX * 2}px -${row * ICON_PX * 2}px`
  }

  flashDamage(): void {
    this.vignetteStrength = 1
  }

  setQuestText(text: string, showCompass: boolean): void {
    if (text !== this.lastBannerText) {
      this.lastBannerText = text
      this.bannerText.textContent = text
      // Restart the pop animation so quest changes catch the eye.
      this.banner.classList.remove('quest-banner-pop')
      void this.banner.offsetWidth
      this.banner.classList.add('quest-banner-pop')
    }
    this.compass.style.display = showCompass ? 'inline-block' : 'none'
  }

  update(dt: number, player: PlayerController, dragon: DragonBoss): void {
    // Hearts (2 HP per heart, half-heart via clip width).
    const hp = Math.max(0, player.hp)
    this.hearts.forEach((fill, i) => {
      const heartHp = hp - i * 2
      fill.style.width = heartHp >= 2 ? '100%' : heartHp >= 1 ? '50%' : '0%'
    })
    this.heartsRow.classList.toggle('low', hp > 0 && hp <= 6)

    if (this.hotbarDirty) {
      this.hotbarDirty = false
      this.inventory.slots.forEach((slot, i) => {
        const ui = this.hotbarSlots[i]
        if (!ui) return
        this.applyIcon(ui.icon, slot.icon)
        ui.count.textContent = slot.count !== null && slot.count > 0 ? String(slot.count) : ''
        ui.icon.style.opacity = slot.count === 0 ? '0.35' : '1'
      })
    }
    this.hotbarSlots.forEach((slot, i) => {
      slot.el.classList.toggle('selected', i === this.inventory.selected)
    })

    // Boss bar while the dragon fight is live.
    const bossVisible = dragon.engaged && !dragon.defeated
    this.bossBar.style.display = bossVisible ? 'block' : 'none'
    if (bossVisible) {
      this.bossFill.style.width = `${Math.max(0, (dragon.hp / dragon.maxHp) * 100)}%`
    }

    // Compass arrow points at the lair relative to view direction.
    const dx = LAIR_CENTER_X - player.position.x
    const dz = LAIR_CENTER_Z - player.position.z
    const bearing = Math.atan2(-dx, -dz)
    const angle = bearing - player.yaw
    this.compass.style.transform = `rotate(${-angle}rad)`

    // Damage vignette + low HP pulse.
    this.vignetteStrength = Math.max(0, this.vignetteStrength - dt * 1.8)
    const lowHp = player.hp <= 6 && player.hp > 0
      ? 0.25 + Math.sin(performance.now() / 250) * 0.12
      : 0
    this.vignette.style.opacity = String(Math.min(1, this.vignetteStrength * 0.85 + lowHp))
  }
}
