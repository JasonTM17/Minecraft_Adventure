export type GameState = 'menu' | 'playing' | 'paused' | 'dead' | 'victory'

/** Central game flow state; systems subscribe to transitions. */
export class GameStateMachine {
  state: GameState = 'menu'
  onChange: ((state: GameState, previous: GameState) => void) | null = null

  set(state: GameState): void {
    if (state === this.state) return
    const previous = this.state
    this.state = state
    this.onChange?.(state, previous)
  }
}
