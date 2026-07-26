import { Block } from '../world/block-registry'
import { T } from '../world/texture-atlas'

export type SlotKind = 'sword' | 'bow' | 'food' | 'block'

export interface HotbarSlot {
  kind: SlotKind
  label: string
  /** Atlas tile index used for the HUD icon. */
  icon: number
  blockId?: number
  /** null = tool without ammo; number = stack count. */
  count: number | null
}

/** Adventure loadout: fixed 9-slot hotbar with counted block stacks. */
export class Inventory {
  readonly slots: HotbarSlot[] = [
    { kind: 'sword', label: 'Sword', icon: T.SWORD_ICON, count: null },
    { kind: 'bow', label: 'Bow', icon: T.BOW_ICON, count: null },
    { kind: 'food', label: 'Meat', icon: T.MEAT_ICON, count: 3 },
    { kind: 'block', label: 'Dirt', icon: T.DIRT, blockId: Block.DIRT, count: 0 },
    { kind: 'block', label: 'Cobblestone', icon: T.COBBLE, blockId: Block.COBBLESTONE, count: 0 },
    { kind: 'block', label: 'Planks', icon: T.PLANKS, blockId: Block.PLANKS, count: 16 },
    { kind: 'block', label: 'Sand', icon: T.SAND, blockId: Block.SAND, count: 0 },
    { kind: 'block', label: 'Log', icon: T.LOG_SIDE, blockId: Block.LOG, count: 0 },
    { kind: 'block', label: 'Glowstone', icon: T.GLOWSTONE, blockId: Block.GLOWSTONE, count: 0 },
  ]
  selected = 0
  onChanged: (() => void) | null = null

  get selectedSlot(): HotbarSlot {
    return this.slots[this.selected] as HotbarSlot
  }

  select(index: number): void {
    if (index >= 0 && index < this.slots.length && index !== this.selected) {
      this.selected = index
      this.onChanged?.()
    }
  }

  scroll(steps: number): void {
    const n = this.slots.length
    this.select((((this.selected + steps) % n) + n) % n)
  }

  /** Store a mined block. Unknown block types are silently discarded. */
  addBlock(blockId: number, amount = 1): void {
    if (blockId === Block.AIR) return
    const slot = this.slots.find((s) => s.kind === 'block' && s.blockId === blockId)
    if (!slot || slot.count === null) return
    slot.count += amount
    this.onChanged?.()
  }

  /** Consume one block from the selected slot for placement. */
  consumeSelectedBlock(): number | null {
    const slot = this.selectedSlot
    if (slot.kind !== 'block' || slot.blockId === undefined) return null
    if (slot.count === null || slot.count <= 0) return null
    slot.count--
    this.onChanged?.()
    return slot.blockId
  }

  get foodCount(): number {
    return this.foodSlot.count ?? 0
  }

  private get foodSlot(): HotbarSlot {
    return this.slots.find((s) => s.kind === 'food') as HotbarSlot
  }

  addFood(amount = 1): void {
    const slot = this.foodSlot
    slot.count = (slot.count ?? 0) + amount
    this.onChanged?.()
  }

  /** Returns true when a meat was consumed. */
  eatFood(): boolean {
    const slot = this.foodSlot
    if ((slot.count ?? 0) <= 0) return false
    slot.count = (slot.count ?? 0) - 1
    this.onChanged?.()
    return true
  }
}
