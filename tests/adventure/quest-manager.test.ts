import { Vector3 } from 'three'
import { describe, expect, it } from 'vitest'
import { QuestManager } from '../../src/adventure/quest-manager'
import { LAIR_CENTER_X, LAIR_CENTER_Z } from '../../src/world/lair-generator'

describe('QuestManager quest chain progression', () => {
  it('starts on the hunt quest', () => {
    const qm = new QuestManager()
    expect(qm.current?.id).toBe('hunt')
    expect(qm.current?.progress).toBe(0)
    expect(qm.completed).toBe(false)
  })

  it('advances from hunt to travel after 3 creature kills, not before', () => {
    const qm = new QuestManager()
    qm.creatureKilled()
    expect(qm.current?.id).toBe('hunt')
    expect(qm.current?.progress).toBe(1)

    qm.creatureKilled()
    expect(qm.current?.id).toBe('hunt')
    expect(qm.current?.progress).toBe(2)

    qm.creatureKilled()
    expect(qm.current?.id).toBe('travel')
    expect(qm.current?.progress).toBe(0)
  })

  it('does not over-count kills once the hunt quest target is reached', () => {
    const qm = new QuestManager()
    qm.creatureKilled()
    qm.creatureKilled()
    qm.creatureKilled()
    qm.creatureKilled() // extra kill after quest already advanced
    expect(qm.current?.id).toBe('travel')
  })

  it('advances the travel quest via update() once near the lair', () => {
    const qm = new QuestManager()
    qm.creatureKilled()
    qm.creatureKilled()
    qm.creatureKilled()
    expect(qm.current?.id).toBe('travel')

    // Far from the lair: no progress.
    qm.update(new Vector3(0, 0, 0))
    expect(qm.current?.id).toBe('travel')
    expect(qm.current?.progress).toBe(0)

    // Within the 60-unit trigger radius of the lair center.
    qm.update(new Vector3(LAIR_CENTER_X + 10, 0, LAIR_CENTER_Z))
    expect(qm.current?.id).toBe('crystals')
  })

  it('advances crystals to dragon after 4 crystal kills reached at the crystal stage', () => {
    const qm = new QuestManager()
    qm.creatureKilled()
    qm.creatureKilled()
    qm.creatureKilled()
    qm.update(new Vector3(LAIR_CENTER_X, 0, LAIR_CENTER_Z))
    expect(qm.current?.id).toBe('crystals')

    qm.crystalDestroyed()
    qm.crystalDestroyed()
    qm.crystalDestroyed()
    expect(qm.current?.id).toBe('crystals')
    expect(qm.current?.progress).toBe(3)

    qm.crystalDestroyed()
    expect(qm.current?.id).toBe('dragon')
  })

  it('dragonSlain force-completes the chain from any step', () => {
    const qm = new QuestManager()
    // Still on the very first quest step.
    qm.dragonSlain()
    expect(qm.completed).toBe(true)
    expect(qm.current).toBeNull()
  })

  it('dragonSlain force-completes even mid-chain', () => {
    const qm = new QuestManager()
    qm.creatureKilled()
    qm.creatureKilled()
    qm.creatureKilled()
    qm.update(new Vector3(LAIR_CENTER_X, 0, LAIR_CENTER_Z))
    expect(qm.current?.id).toBe('crystals')

    qm.dragonSlain()
    expect(qm.completed).toBe(true)
    expect(qm.current).toBeNull()
  })

  it('fires onCompleted exactly once when dragonSlain finishes the chain', () => {
    const qm = new QuestManager()
    let completedCount = 0
    qm.onCompleted = () => {
      completedCount++
    }
    qm.dragonSlain()
    expect(completedCount).toBe(1)
  })

  it('syncCrystals credits crystal kills landed before the crystal quest activates', () => {
    const qm = new QuestManager()
    // Snipe two crystals while still on the hunt quest — they must not be
    // lost, but also must not prematurely advance the unrelated hunt quest.
    qm.crystalDestroyed()
    qm.crystalDestroyed()
    expect(qm.current?.id).toBe('hunt')
    expect(qm.current?.progress).toBe(0)

    qm.creatureKilled()
    qm.creatureKilled()
    qm.creatureKilled()
    expect(qm.current?.id).toBe('travel')

    // Crossing into the crystal quest should immediately reflect the two
    // early kills without requiring crystalDestroyed() calls at this stage.
    qm.update(new Vector3(LAIR_CENTER_X, 0, LAIR_CENTER_Z))
    expect(qm.current?.id).toBe('crystals')
    expect(qm.current?.progress).toBe(2)

    // Only 2 more real kills needed to hit the target of 4.
    qm.crystalDestroyed()
    qm.crystalDestroyed()
    expect(qm.current?.id).toBe('dragon')
  })

  it('syncCrystals immediately completes the crystal quest if enough were sniped early', () => {
    const qm = new QuestManager()
    qm.crystalDestroyed()
    qm.crystalDestroyed()
    qm.crystalDestroyed()
    qm.crystalDestroyed()
    qm.creatureKilled()
    qm.creatureKilled()
    qm.creatureKilled()
    expect(qm.current?.id).toBe('travel')

    qm.update(new Vector3(LAIR_CENTER_X, 0, LAIR_CENTER_Z))
    expect(qm.current?.id).toBe('dragon')
  })
})
