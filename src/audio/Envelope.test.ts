import { describe, it, expect, vi } from 'vitest'
import { createAudioContextMock } from '../test-utils/audioMocks'
import { Envelope } from './Envelope'

function setup(overrides: Partial<ConstructorParameters<typeof Envelope>[1]> = {}) {
  const ctx = createAudioContextMock() as unknown as AudioContext
  const destination = { connect: vi.fn() } as unknown as AudioNode
  const config = {
    attack: 0.01,
    decay: 0.1,
    sustain: 0.7,
    release: 0.3,
    ...overrides,
  }
  const env = new Envelope(ctx, config, destination)
  const mock = ctx as unknown as ReturnType<typeof createAudioContextMock>
  return { ctx, env, config, gain: mock._gainNode.gain }
}

describe('Envelope', () => {
  it('connects gain node to destination', () => {
    const { ctx } = setup()
    const mock = ctx as unknown as ReturnType<typeof createAudioContextMock>
    expect(mock._gainNode.connect).toHaveBeenCalled()
  })

  it('initialises gain to floor (0.0001), not 0', () => {
    const { gain } = setup()
    // Gain starts at floor to allow exponential ramps
    expect(gain.value).toBe(0.0001)
  })

  describe('noteOn', () => {
    it('cancels any scheduled values at startTime', () => {
      const { env, gain } = setup()
      env.noteOn(0)
      expect(gain.cancelScheduledValues).toHaveBeenCalledWith(0)
    })

    it('sets gain to floor before ramping', () => {
      const { env, gain } = setup()
      env.noteOn(0)
      expect(gain.setValueAtTime).toHaveBeenCalledWith(0.0001, 0)
    })

    it('uses exponential ramp to peak (1) for attack', () => {
      const { env, gain } = setup({ attack: 0.1 })
      env.noteOn(0)
      expect(gain.exponentialRampToValueAtTime).toHaveBeenCalledWith(1, 0.1)
    })

    it('enforces minimum attack of 3ms to prevent clicks', () => {
      const { env, gain } = setup({ attack: 0 })
      env.noteOn(0)
      // Should ramp to 1 at 0.003s minimum, not 0
      expect(gain.exponentialRampToValueAtTime).toHaveBeenCalledWith(1, 0.003)
    })

    it('uses exponential ramp to sustain after attack+decay', () => {
      const { env, gain } = setup({ attack: 0.1, decay: 0.2, sustain: 0.5 })
      env.noteOn(0)
      expect(gain.exponentialRampToValueAtTime).toHaveBeenCalledWith(0.5, 0.1 + 0.2)
    })

    it('clamps sustain to floor when sustain is 0', () => {
      const { env, gain } = setup({ sustain: 0 })
      env.noteOn(0)
      // Can't exponentially ramp to 0 — uses floor
      const calls = (gain.exponentialRampToValueAtTime as ReturnType<typeof vi.fn>).mock.calls
      const sustainCall = calls.find((c: unknown[]) => (c[0] as number) < 0.1)
      expect(sustainCall?.[0]).toBeGreaterThan(0)
    })
  })

  describe('noteOff', () => {
    it('returns silenceTime = stopTime + release + 5ms linear tail', () => {
      const { env } = setup({ release: 0.5 })
      const silenceTime = env.noteOff(1)
      // 1 + 0.5 (release) + 0.005 (linear tail) = 1.505
      expect(silenceTime).toBeCloseTo(1.505, 5)
    })

    it('enforces minimum release of 10ms (returned time >= 0.015)', () => {
      const { env } = setup({ release: 0 })
      const silenceTime = env.noteOff(0)
      // MIN_RELEASE_S(0.01) + LINEAR_TAIL_S(0.005) = 0.015
      expect(silenceTime).toBeGreaterThanOrEqual(0.015)
    })

    it('exponentially ramps gain to FLOOR at end of release phase', () => {
      const { env, gain } = setup({ release: 0.3 })
      env.noteOff(0)
      expect(gain.exponentialRampToValueAtTime).toHaveBeenCalledWith(0.0001, 0.3)
    })

    it('then linearly ramps gain to 0 at silenceTime', () => {
      const { env, gain } = setup({ release: 0.3 })
      env.noteOff(0)
      // silenceTime = 0.3 + 0.005 = 0.305
      expect(gain.linearRampToValueAtTime).toHaveBeenCalledWith(0, 0.305)
    })

    it('cancels previously scheduled values at stopTime via cancelAndHoldAtTime or cancelScheduledValues', () => {
      const { env, gain } = setup()
      env.noteOff(2)
      // The implementation prefers cancelAndHoldAtTime when available (our mock has it)
      const holdCalled = (gain.cancelAndHoldAtTime as ReturnType<typeof vi.fn>).mock.calls
        .some((c: unknown[]) => c[0] === 2)
      const cancelCalled = (gain.cancelScheduledValues as ReturnType<typeof vi.fn>).mock.calls
        .some((c: unknown[]) => c[0] === 2)
      expect(holdCalled || cancelCalled).toBe(true)
    })
  })

  describe('setConfig', () => {
    it('updates individual fields', () => {
      const { env } = setup()
      env.setConfig({ attack: 0.5, sustain: 0.3 })
      expect(env.currentConfig.attack).toBe(0.5)
      expect(env.currentConfig.sustain).toBe(0.3)
      expect(env.currentConfig.decay).toBe(0.1) // unchanged
    })

    it('currentConfig returns a copy — mutations do not affect internal state', () => {
      const { env } = setup()
      const cfg = env.currentConfig as { attack: number }
      cfg.attack = 99
      expect(env.currentConfig.attack).toBe(0.01)
    })
  })
})
