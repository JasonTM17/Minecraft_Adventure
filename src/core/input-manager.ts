/**
 * Keyboard, mouse and pointer-lock state. Widgets read state each frame;
 * edge events (pressed this frame) are cleared by endFrame().
 */
export class InputManager {
  private static readonly WHEEL_STEP_COOLDOWN_MS = 120
  private readonly keys = new Set<string>()
  private readonly pressed = new Set<string>()
  private readonly buttons = [false, false, false]
  private readonly clicked = [false, false, false]
  private mouseDX = 0
  private mouseDY = 0
  wheelDelta = 0
  private lastWheelStepAt = -Infinity
  private lastWheelDirection = 0
  locked = false
  /**
   * When pointer lock is unavailable (some embedded browsers), gameplay still
   * needs clicks and mouse motion; the game sets this while actively playing.
   */
  captureUnlocked = false
  onLockChange: ((locked: boolean) => void) | null = null

  private get capturing(): boolean {
    return this.locked || this.captureUnlocked
  }

  constructor(private readonly lockTarget: HTMLElement) {
    document.addEventListener('keydown', (e) => {
      if (!this.keys.has(e.code)) this.pressed.add(e.code)
      this.keys.add(e.code)
      // Keep browser shortcuts from stealing gameplay keys while locked.
      if (this.locked && (e.code === 'Space' || e.code === 'Tab')) e.preventDefault()
    })
    document.addEventListener('keyup', (e) => this.keys.delete(e.code))
    window.addEventListener('blur', () => {
      this.keys.clear()
      this.buttons.fill(false)
    })

    document.addEventListener('mousedown', (e) => {
      if (e.button >= 0 && e.button < 3) {
        this.buttons[e.button] = true
        if (this.capturing) this.clicked[e.button] = true
      }
    })
    document.addEventListener('mouseup', (e) => {
      if (e.button >= 0 && e.button < 3) this.buttons[e.button] = false
    })
    document.addEventListener('contextmenu', (e) => e.preventDefault())
    document.addEventListener(
      'wheel',
      (e) => {
        if (!this.capturing || e.deltaY === 0) return

        e.preventDefault()
        const now = performance.now()
        const direction = Math.sign(e.deltaY)
        // Trackpads emit several wheel events for one physical gesture. Treat
        // same-direction bursts as one step, while preserving quick corrections.
        if (
          direction === this.lastWheelDirection &&
          now - this.lastWheelStepAt < InputManager.WHEEL_STEP_COOLDOWN_MS
        ) return
        this.wheelDelta = direction
        this.lastWheelStepAt = now
        this.lastWheelDirection = direction
      },
      { passive: false },
    )

    document.addEventListener('mousemove', (e) => {
      if (this.capturing) {
        this.mouseDX += e.movementX
        this.mouseDY += e.movementY
      }
    })
    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === this.lockTarget
      if (!this.locked) {
        this.keys.clear()
        this.buttons.fill(false)
      }
      this.onLockChange?.(this.locked)
    })
  }

  requestLock(): void {
    if (!this.locked) this.lockTarget.requestPointerLock()
  }

  exitLock(): void {
    if (this.locked) document.exitPointerLock()
  }

  isDown(code: string): boolean {
    return this.keys.has(code)
  }

  /** True only on the frame the key transitioned to down. */
  wasPressed(code: string): boolean {
    return this.pressed.has(code)
  }

  isButtonDown(button: number): boolean {
    return this.buttons[button] ?? false
  }

  /** True only on the frame the button was clicked (while locked). */
  wasClicked(button: number): boolean {
    return this.clicked[button] ?? false
  }

  /** Returns accumulated pointer-lock mouse motion and resets it. */
  consumeMouseDelta(): readonly [number, number] {
    const d = [this.mouseDX, this.mouseDY] as const
    this.mouseDX = 0
    this.mouseDY = 0
    return d
  }

  /** Returns accumulated wheel steps and resets them. */
  consumeWheel(): number {
    const w = this.wheelDelta
    this.wheelDelta = 0
    return w
  }

  /** Clear per-frame edge state. Call once at the end of every update. */
  endFrame(): void {
    this.pressed.clear()
    this.clicked.fill(false)
  }
}
