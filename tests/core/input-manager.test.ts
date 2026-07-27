import { afterEach, describe, expect, it, vi } from 'vitest'
import { InputManager } from '../../src/core/input-manager'

type Listener = (event: Event) => void

interface RegisteredListener {
  listener: Listener
  options?: AddEventListenerOptions | boolean
}

const originalDocument = globalThis.document
const originalWindow = globalThis.window

afterEach(() => {
  globalThis.document = originalDocument
  globalThis.window = originalWindow
  vi.restoreAllMocks()
})

function createInput(): {
  input: InputManager
  wheel: (deltaY: number) => boolean
  wheelOptions: AddEventListenerOptions | boolean | undefined
} {
  const listeners = new Map<string, RegisteredListener>()
  const documentStub = {
    addEventListener(type: string, listener: Listener, options?: AddEventListenerOptions | boolean) {
      listeners.set(type, { listener, options })
    },
  }
  globalThis.document = documentStub as unknown as Document
  globalThis.window = { addEventListener() {} } as unknown as Window & typeof globalThis

  const input = new InputManager({ requestPointerLock() {} } as HTMLElement)
  const wheelRegistration = listeners.get('wheel')
  if (!wheelRegistration) throw new Error('Wheel listener was not registered')

  return {
    input,
    wheelOptions: wheelRegistration.options,
    wheel(deltaY: number): boolean {
      let prevented = false
      wheelRegistration.listener({ deltaY, preventDefault: () => { prevented = true } } as unknown as Event)
      return prevented
    },
  }
}

describe('InputManager wheel input', () => {
  it('registers a non-passive listener so browser scrolling can be cancelled', () => {
    const { wheelOptions } = createInput()

    expect(wheelOptions).toEqual({ passive: false })
  })

  it('coalesces a same-direction trackpad burst into one hotbar step', () => {
    const now = vi.spyOn(performance, 'now')
    now.mockReturnValueOnce(100).mockReturnValueOnce(150)
    const { input, wheel } = createInput()
    input.captureUnlocked = true

    expect(wheel(4)).toBe(true)
    expect(wheel(4)).toBe(true)
    expect(input.consumeWheel()).toBe(1)
  })

  it('accepts an immediate scroll in the opposite direction', () => {
    const now = vi.spyOn(performance, 'now')
    now.mockReturnValueOnce(100).mockReturnValueOnce(110)
    const { input, wheel } = createInput()
    input.captureUnlocked = true

    wheel(4)
    wheel(-4)

    expect(input.consumeWheel()).toBe(-1)
  })

  it('ignores wheel input outside gameplay capture', () => {
    const { input, wheel } = createInput()

    expect(wheel(4)).toBe(false)
    expect(input.consumeWheel()).toBe(0)
  })
})
