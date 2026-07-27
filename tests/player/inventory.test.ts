import { describe, expect, it } from 'vitest'
import { Inventory } from '../../src/player/inventory'

describe('Inventory scrolling', () => {
  it('moves exactly one slot for a positive scroll value', () => {
    const inventory = new Inventory()

    inventory.scroll(8)

    expect(inventory.selected).toBe(1)
  })

  it('moves exactly one slot backwards and wraps from the first slot', () => {
    const inventory = new Inventory()

    inventory.scroll(-5)

    expect(inventory.selected).toBe(8)
  })

  it('ignores zero and non-finite scroll values', () => {
    const inventory = new Inventory()

    inventory.scroll(0)
    inventory.scroll(Number.NaN)
    inventory.scroll(Number.POSITIVE_INFINITY)

    expect(inventory.selected).toBe(0)
  })
})
