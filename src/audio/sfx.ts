import type { PassiveSpecies } from '../entities/passive-mobs'

type OscKind = OscillatorType

/** Fully synthesized sound effects — no audio files anywhere. */
export class Sfx {
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  muted = false

  /** Must be called from a user gesture (autoplay policy). */
  unlock(): void {
    if (!this.ctx) {
      this.ctx = new AudioContext()
      this.master = this.ctx.createGain()
      this.master.gain.value = 0.45
      this.master.connect(this.ctx.destination)
    }
    void this.ctx.resume()
  }

  toggleMute(): boolean {
    this.muted = !this.muted
    if (this.master) this.master.gain.value = this.muted ? 0 : 0.45
    return this.muted
  }

  private get ready(): boolean {
    return this.ctx !== null && this.master !== null && !this.muted
  }

  /** Oscillator blip with optional pitch slide. */
  private tone(
    freq: number,
    duration: number,
    kind: OscKind = 'square',
    volume = 0.3,
    slideTo?: number,
    delay = 0,
  ): void {
    if (!this.ready || !this.ctx || !this.master) return
    const t0 = this.ctx.currentTime + delay
    const osc = this.ctx.createOscillator()
    const gain = this.ctx.createGain()
    osc.type = kind
    osc.frequency.setValueAtTime(freq, t0)
    if (slideTo !== undefined) osc.frequency.exponentialRampToValueAtTime(Math.max(30, slideTo), t0 + duration)
    gain.gain.setValueAtTime(volume, t0)
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + duration)
    osc.connect(gain).connect(this.master)
    osc.start(t0)
    osc.stop(t0 + duration + 0.02)
  }

  /** Filtered white-noise burst. */
  private noise(duration: number, filterFreq: number, volume = 0.3, delay = 0): void {
    if (!this.ready || !this.ctx || !this.master) return
    const t0 = this.ctx.currentTime + delay
    const length = Math.max(1, Math.floor(this.ctx.sampleRate * duration))
    const buffer = this.ctx.createBuffer(1, length, this.ctx.sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1
    const src = this.ctx.createBufferSource()
    src.buffer = buffer
    const filter = this.ctx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.value = filterFreq
    const gain = this.ctx.createGain()
    gain.gain.setValueAtTime(volume, t0)
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + duration)
    src.connect(filter).connect(gain).connect(this.master)
    src.start(t0)
  }

  dig(): void {
    this.noise(0.1, 900, 0.25)
  }

  /** Short surface-specific scuff, called every couple meters of walking. */
  footstep(kind: 'grass' | 'sand' | 'stone' | 'wood' | 'snow'): void {
    const jitter = 0.85 + Math.random() * 0.3
    if (kind === 'grass') this.noise(0.06 * jitter, 800, 0.1)
    else if (kind === 'sand') this.noise(0.08 * jitter, 1300, 0.09)
    else if (kind === 'snow') this.noise(0.09 * jitter, 450, 0.1)
    else if (kind === 'wood') {
      this.tone(150 * jitter, 0.05, 'square', 0.09, 95)
      this.noise(0.04, 600, 0.06)
    } else {
      this.noise(0.045 * jitter, 2200, 0.11)
    }
  }

  /** Impact thunk; volume scales down with distance from the player. */
  arrowHit(volume = 1): void {
    this.noise(0.06, 1600, 0.2 * volume)
    this.tone(130, 0.05, 'square', 0.14 * volume, 85)
  }

  cricket(): void {
    for (let i = 0; i < 3; i++) this.tone(4300, 0.03, 'sine', 0.045, 4100, i * 0.08)
  }

  bird(): void {
    this.tone(1900, 0.11, 'sine', 0.06, 2500)
    this.tone(2300, 0.09, 'sine', 0.05, 1700, 0.16)
  }

  wind(): void {
    this.noise(1.6, 280, 0.055)
  }

  place(): void {
    this.tone(170, 0.09, 'square', 0.22, 120)
  }

  hurt(): void {
    this.tone(320, 0.2, 'sawtooth', 0.3, 110)
  }

  eat(): void {
    this.tone(300, 0.07, 'square', 0.2, 220)
    this.tone(260, 0.07, 'square', 0.2, 180, 0.12)
  }

  pickup(): void {
    this.tone(620, 0.07, 'square', 0.18, 900)
  }

  meleeHit(): void {
    this.noise(0.08, 1800, 0.25)
    this.tone(180, 0.08, 'square', 0.2, 90)
  }

  bowShoot(): void {
    this.tone(420, 0.15, 'triangle', 0.25, 90)
    this.noise(0.08, 2400, 0.12)
  }

  mobCall(species: PassiveSpecies): void {
    if (species === 'pig') {
      this.tone(260, 0.1, 'square', 0.14, 170)
      this.tone(230, 0.09, 'square', 0.12, 150, 0.13)
    } else if (species === 'cow') {
      this.tone(140, 0.45, 'sawtooth', 0.14, 90)
    } else if (species === 'sheep') {
      this.tone(220, 0.35, 'square', 0.12, 190)
    } else {
      this.tone(520, 0.06, 'square', 0.1, 480)
      this.tone(560, 0.06, 'square', 0.1, 500, 0.09)
    }
  }

  zombieGroan(): void {
    this.tone(95, 0.55, 'sawtooth', 0.16, 70)
  }

  dragonRoar(): void {
    this.tone(70, 1.2, 'sawtooth', 0.5, 45)
    this.tone(110, 1.0, 'sawtooth', 0.35, 60, 0.1)
    this.noise(1.1, 700, 0.4)
  }

  fireball(): void {
    this.noise(0.5, 1200, 0.35)
    this.tone(150, 0.4, 'sawtooth', 0.2, 70)
  }

  flameBreath(): void {
    this.noise(2.8, 900, 0.35)
    this.noise(2.4, 500, 0.25, 0.3)
  }

  explosion(): void {
    this.noise(0.9, 400, 0.55)
    this.tone(55, 0.7, 'sine', 0.5, 32)
  }

  crystalBreak(): void {
    this.noise(0.25, 6000, 0.3)
    this.tone(1400, 0.3, 'triangle', 0.25, 500)
  }

  questDone(): void {
    this.tone(520, 0.12, 'square', 0.2)
    this.tone(660, 0.12, 'square', 0.2, undefined, 0.13)
    this.tone(880, 0.2, 'square', 0.22, undefined, 0.26)
  }

  death(): void {
    this.tone(300, 0.3, 'sawtooth', 0.3, 220)
    this.tone(220, 0.3, 'sawtooth', 0.3, 150, 0.3)
    this.tone(150, 0.6, 'sawtooth', 0.3, 60, 0.6)
  }

  victory(): void {
    const notes = [523, 659, 784, 1047, 1319]
    notes.forEach((freq, i) => this.tone(freq, 0.28, 'triangle', 0.25, undefined, i * 0.16))
  }
}
