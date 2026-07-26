import type * as THREE from 'three'
import { distance2D } from '../core/math-utils'
import { LAIR_CENTER_X, LAIR_CENTER_Z } from '../world/lair-generator'

export interface Quest {
  id: string
  title: string
  target: number
  progress: number
}

/** Linear adventure chain driving the HUD banner and victory flow. */
export class QuestManager {
  private readonly quests: Quest[] = [
    { id: 'hunt', title: 'Hunt creatures for food', target: 3, progress: 0 },
    { id: 'travel', title: "Find the Dragon's Lair", target: 1, progress: 0 },
    { id: 'crystals', title: 'Destroy the healing crystals', target: 4, progress: 0 },
    { id: 'dragon', title: 'Slay the Fire Dragon', target: 1, progress: 0 },
  ]
  private index = 0
  completed = false
  onAdvance: ((quest: Quest | null) => void) | null = null
  onCompleted: (() => void) | null = null

  get current(): Quest | null {
    return this.completed ? null : (this.quests[this.index] ?? null)
  }

  /** HUD banner text, includes live distance during the travel quest. */
  bannerText(playerPos: THREE.Vector3): string {
    const quest = this.current
    if (!quest) return 'Adventure complete — the realm is yours!'
    if (quest.id === 'travel') {
      const d = Math.round(distance2D(playerPos.x, playerPos.z, LAIR_CENTER_X, LAIR_CENTER_Z))
      return `${quest.title} — ${d}m away`
    }
    if (quest.target > 1) return `${quest.title} (${quest.progress}/${quest.target})`
    return quest.title
  }

  /** Compass only matters while searching for (or fighting at) the lair. */
  showCompass(): boolean {
    const quest = this.current
    return quest !== null && quest.id !== 'hunt'
  }

  private bump(id: string, amount = 1): void {
    const quest = this.current
    if (!quest || quest.id !== id) return
    quest.progress = Math.min(quest.target, quest.progress + amount)
    if (quest.progress >= quest.target) {
      this.index++
      if (this.index >= this.quests.length) {
        this.completed = true
        this.onCompleted?.()
      }
      this.onAdvance?.(this.current)
    }
  }

  creatureKilled(): void {
    this.bump('hunt')
  }

  crystalDestroyed(): void {
    this.bump('crystals')
  }

  dragonSlain(): void {
    // Whatever step the player is on, a dead dragon ends the story.
    while (!this.completed && this.current) {
      const quest = this.current
      quest.progress = quest.target
      this.index++
      if (this.index >= this.quests.length) {
        this.completed = true
      }
    }
    this.onCompleted?.()
    this.onAdvance?.(null)
  }

  update(playerPos: THREE.Vector3): void {
    const quest = this.current
    if (quest?.id === 'travel') {
      if (distance2D(playerPos.x, playerPos.z, LAIR_CENTER_X, LAIR_CENTER_Z) < 60) {
        this.bump('travel')
      }
    }
  }
}
