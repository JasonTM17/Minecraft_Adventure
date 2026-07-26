import * as THREE from 'three'
import './style.css'
import { Game } from './core/game'
import { buildAtlas, tileUV, T } from './world/texture-atlas'

// Temporary bootstrap: proves the engine loop and atlas render correctly.
// Replaced by the full world bootstrap as systems come online.
const app = document.querySelector<HTMLDivElement>('#app')
if (!app) throw new Error('Missing #app mount point')

const game = new Game(app)
game.scene.background = new THREE.Color(0x87b8e8)

const atlas = buildAtlas()
const material = new THREE.MeshLambertMaterial({ map: atlas.texture })

const geometry = new THREE.BoxGeometry(1, 1, 1)
const [u0, v0, u1, v1] = tileUV(T.GRASS_SIDE)
const uvAttr = geometry.getAttribute('uv') as THREE.BufferAttribute
for (let i = 0; i < uvAttr.count; i++) {
  uvAttr.setXY(i, uvAttr.getX(i) < 0.5 ? u0 : u1, uvAttr.getY(i) < 0.5 ? v0 : v1)
}
uvAttr.needsUpdate = true

const cube = new THREE.Mesh(geometry, material)
game.scene.add(cube)

const sun = new THREE.DirectionalLight(0xffffff, 2.2)
sun.position.set(3, 5, 2)
game.scene.add(sun, new THREE.AmbientLight(0xa0b0d0, 1.2))

game.camera.position.set(0, 0.6, 2.4)
game.camera.lookAt(0, 0, 0)
game.onUpdate((dt) => {
  cube.rotation.y += dt * 0.8
  cube.rotation.x += dt * 0.3
})
game.start()
