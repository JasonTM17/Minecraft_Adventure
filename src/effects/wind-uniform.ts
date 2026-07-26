import type * as THREE from 'three'

/**
 * Shared wind clock for vertex-shader motion. Advanced once per frame with
 * raw dt so foliage keeps swaying behind menus (ambient, not gameplay).
 */
export const WIND = { value: 0 }

type SwayKind = 'foliage' | 'water'

const FOLIAGE_SWAY = /* glsl */ `
  vec3 swayWp = (modelMatrix * vec4(position, 1.0)).xyz;
  transformed.x += sin(uWind * 1.6 + swayWp.x * 0.8 + swayWp.y * 0.5) * 0.045;
  transformed.z += cos(uWind * 1.3 + swayWp.z * 0.9 + swayWp.y * 0.4) * 0.045;
`

const WATER_WAVE = /* glsl */ `
  vec3 swayWp = (modelMatrix * vec4(position, 1.0)).xyz;
  transformed.y += sin(swayWp.x * 0.6 + uWind * 1.7) * cos(swayWp.z * 0.5 + uWind * 1.3) * 0.06;
`

/**
 * Injects a wind displacement into a built-in material's vertex shader.
 * Visual-only: physics and raycasts keep using the undisplaced voxel grid.
 */
export function injectWindSway(material: THREE.Material, kind: SwayKind): void {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uWind = WIND
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uWind;')
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>\n${kind === 'water' ? WATER_WAVE : FOLIAGE_SWAY}`,
      )
  }
  // Distinct cache key per variant so three does not reuse the wrong program.
  material.customProgramCacheKey = () => `wind-sway-${kind}`
}
