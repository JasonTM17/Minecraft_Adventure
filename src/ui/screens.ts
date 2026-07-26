/** Full-screen DOM overlays: title menu, pause, death and victory screens. */
export interface ScreenCallbacks {
  onPlay: () => void
  onResume: () => void
  onRespawn: () => void
  onPlayAgain: () => void
}

const CONTROLS_HTML = `
  <table class="controls-table">
    <tr><td>W A S D</td><td>Move</td></tr>
    <tr><td>Mouse</td><td>Look</td></tr>
    <tr><td>Space</td><td>Jump / Swim</td></tr>
    <tr><td>Shift</td><td>Sprint</td></tr>
    <tr><td>Left click</td><td>Attack / Mine</td></tr>
    <tr><td>Right click</td><td>Place block / Draw bow / Eat</td></tr>
    <tr><td>1–9 / Wheel</td><td>Select hotbar slot</td></tr>
    <tr><td>M</td><td>Mute sound</td></tr>
    <tr><td>Esc</td><td>Pause</td></tr>
  </table>
`

export class Screens {
  private readonly root: HTMLDivElement
  private readonly screens = new Map<string, HTMLDivElement>()

  constructor(ui: HTMLElement, callbacks: ScreenCallbacks) {
    this.root = document.createElement('div')
    this.root.className = 'screens'
    ui.appendChild(this.root)

    this.build(
      'menu',
      `
      <h1 class="game-title">MINECRAFT<span>ADVENTURE</span></h1>
      <p class="tagline">Explore an endless world. Survive the night.<br/>Find the lair. Slay the fire dragon.</p>
      ${CONTROLS_HTML}
      <button data-action="play">▶ &nbsp;Play</button>
      `,
    )
    this.build(
      'paused',
      `
      <h2>Paused</h2>
      ${CONTROLS_HTML}
      <button data-action="resume">Resume</button>
      `,
    )
    this.build(
      'dead',
      `
      <h2 class="death-title">You Died</h2>
      <p class="death-cause"></p>
      <button data-action="respawn">Respawn</button>
      `,
    )
    this.build(
      'victory',
      `
      <h2 class="victory-title">🐉 Dragon Slain!</h2>
      <p>The fire dragon has fallen and the realm is safe.</p>
      <p class="victory-stats"></p>
      <button data-action="playagain">Keep Exploring</button>
      `,
    )

    this.root.addEventListener('click', (e) => {
      const target = e.target as HTMLElement
      const action = target.dataset['action']
      if (action === 'play') callbacks.onPlay()
      else if (action === 'resume') callbacks.onResume()
      else if (action === 'respawn') callbacks.onRespawn()
      else if (action === 'playagain') callbacks.onPlayAgain()
    })
  }

  private build(name: string, html: string): void {
    const el = document.createElement('div')
    el.className = `screen screen-${name}`
    el.innerHTML = html
    el.style.display = 'none'
    this.root.appendChild(el)
    this.screens.set(name, el)
  }

  /** Show one screen (menu/paused/dead/victory) or null for gameplay. */
  show(name: string | null): void {
    for (const [key, el] of this.screens) {
      el.style.display = key === name ? 'flex' : 'none'
    }
    this.root.style.pointerEvents = name ? 'auto' : 'none'
  }

  setDeathCause(cause: string): void {
    const el = this.screens.get('dead')?.querySelector('.death-cause')
    if (el) el.textContent = cause
  }

  setVictoryStats(text: string): void {
    const el = this.screens.get('victory')?.querySelector('.victory-stats')
    if (el) el.textContent = text
  }
}
