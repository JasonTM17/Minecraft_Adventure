import { T } from './texture-atlas'

/** Numeric block ids stored per-voxel in chunk Uint8Arrays. */
export const Block = {
  AIR: 0,
  GRASS: 1,
  DIRT: 2,
  STONE: 3,
  COBBLESTONE: 4,
  SAND: 5,
  SNOW: 6,
  WATER: 7,
  LOG: 8,
  LEAVES: 9,
  PLANKS: 10,
  OBSIDIAN: 11,
  CRYSTAL_BLOCK: 12,
  GLOWSTONE: 13,
  FLOWER_RED: 14,
  FLOWER_YELLOW: 15,
  TALL_GRASS: 16,
  BEDROCK: 17,
} as const

export type BlockId = (typeof Block)[keyof typeof Block]

export interface BlockDef {
  name: string
  /** Blocks movement (collision). */
  solid: boolean
  /** Hides touching neighbor faces (fully opaque cube). */
  occludes: boolean
  /** Rendered as two crossed quads instead of a cube (plants). */
  cross?: boolean
  fluid?: boolean
  /** Seconds of holding the mouse to break; Infinity = unbreakable. */
  breakTime: number
  /** Block id given to the player when broken; AIR = drops nothing. */
  drops: number
  /** Atlas tiles per face; null = never rendered (air). */
  faces: { top: number; bottom: number; side: number } | null
}

const def = (d: BlockDef): BlockDef => d

export const BLOCKS: readonly BlockDef[] = [
  def({ name: 'air', solid: false, occludes: false, breakTime: Infinity, drops: Block.AIR, faces: null }),
  def({ name: 'grass', solid: true, occludes: true, breakTime: 0.6, drops: Block.DIRT, faces: { top: T.GRASS_TOP, bottom: T.DIRT, side: T.GRASS_SIDE } }),
  def({ name: 'dirt', solid: true, occludes: true, breakTime: 0.5, drops: Block.DIRT, faces: { top: T.DIRT, bottom: T.DIRT, side: T.DIRT } }),
  def({ name: 'stone', solid: true, occludes: true, breakTime: 1.5, drops: Block.COBBLESTONE, faces: { top: T.STONE, bottom: T.STONE, side: T.STONE } }),
  def({ name: 'cobblestone', solid: true, occludes: true, breakTime: 1.6, drops: Block.COBBLESTONE, faces: { top: T.COBBLE, bottom: T.COBBLE, side: T.COBBLE } }),
  def({ name: 'sand', solid: true, occludes: true, breakTime: 0.5, drops: Block.SAND, faces: { top: T.SAND, bottom: T.SAND, side: T.SAND } }),
  def({ name: 'snow', solid: true, occludes: true, breakTime: 0.6, drops: Block.DIRT, faces: { top: T.SNOW, bottom: T.DIRT, side: T.SNOW_SIDE } }),
  def({ name: 'water', solid: false, occludes: false, fluid: true, breakTime: Infinity, drops: Block.AIR, faces: { top: T.WATER, bottom: T.WATER, side: T.WATER } }),
  def({ name: 'log', solid: true, occludes: true, breakTime: 1.0, drops: Block.LOG, faces: { top: T.LOG_TOP, bottom: T.LOG_TOP, side: T.LOG_SIDE } }),
  def({ name: 'leaves', solid: true, occludes: false, breakTime: 0.3, drops: Block.AIR, faces: { top: T.LEAVES, bottom: T.LEAVES, side: T.LEAVES } }),
  def({ name: 'planks', solid: true, occludes: true, breakTime: 1.0, drops: Block.PLANKS, faces: { top: T.PLANKS, bottom: T.PLANKS, side: T.PLANKS } }),
  def({ name: 'obsidian', solid: true, occludes: true, breakTime: 6.0, drops: Block.OBSIDIAN, faces: { top: T.OBSIDIAN, bottom: T.OBSIDIAN, side: T.OBSIDIAN } }),
  def({ name: 'crystal block', solid: true, occludes: true, breakTime: 1.0, drops: Block.AIR, faces: { top: T.CRYSTAL, bottom: T.CRYSTAL, side: T.CRYSTAL } }),
  def({ name: 'glowstone', solid: true, occludes: true, breakTime: 0.8, drops: Block.GLOWSTONE, faces: { top: T.GLOWSTONE, bottom: T.GLOWSTONE, side: T.GLOWSTONE } }),
  def({ name: 'rose', solid: false, occludes: false, cross: true, breakTime: 0.05, drops: Block.AIR, faces: { top: T.FLOWER_RED, bottom: T.FLOWER_RED, side: T.FLOWER_RED } }),
  def({ name: 'dandelion', solid: false, occludes: false, cross: true, breakTime: 0.05, drops: Block.AIR, faces: { top: T.FLOWER_YELLOW, bottom: T.FLOWER_YELLOW, side: T.FLOWER_YELLOW } }),
  def({ name: 'tall grass', solid: false, occludes: false, cross: true, breakTime: 0.05, drops: Block.AIR, faces: { top: T.TALL_GRASS, bottom: T.TALL_GRASS, side: T.TALL_GRASS } }),
  def({ name: 'bedrock', solid: true, occludes: true, breakTime: Infinity, drops: Block.AIR, faces: { top: T.BEDROCK, bottom: T.BEDROCK, side: T.BEDROCK } }),
]

export function blockDef(id: number): BlockDef {
  return BLOCKS[id] ?? (BLOCKS[0] as BlockDef)
}

export function isSolid(id: number): boolean {
  return blockDef(id).solid
}

/** True when this block hides the touching face of its neighbor. */
export function occludes(id: number): boolean {
  return blockDef(id).occludes
}
