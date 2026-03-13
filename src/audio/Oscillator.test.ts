import { describe, it, expect, vi } from 'vitest'
import { createAudioContextMock } from '../test-utils/audioMocks'
import { SynthOscillator } from './Oscillator'

function setup(overrides: Partial<Parameters<typeof SynthOscillator>[1]> = {}) {
  const ctx = createAudioContextMock() as unknown as AudioContext
  const destination = { connect: vi.fn() } as unknown as AudioNode
  const config = { type: 'sine' as const, detune: 0, volume: 0.8, ...overrides }
  const osc = new SynthOscillator(ctx, config, destination)
  const mock = ctx as unknown as ReturnType<typeof createAudioContextMock>
  return { ctx, osc, config, mock }
}

describe('SynthOscillator', () => {
  it('creates a gain node connected to destination', () => {
    const { mock } = setup()
    expect(mock._gainNode.connect).toHaveBeenCalled()
  })

  it('is not playing initially', () => {
    const { osc } = setup()
    expect(osc.isPlaying).toBe(false)
  })

  it('start() creates and starts an oscillator node', () => {
    const { osc, mock } = setup()
    osc.start(440)
    expect(mock._oscillatorNode.start).toHaveBeenCalledWith(0)
    expect(osc.isPlaying).toBe(true)
  })

  it('start() sets frequency and detune', () => {
    const { osc, mock } = setup({ detune: 10 })
    osc.start(440)
    expect(mock._oscillatorNode.frequency.setValueAtTime).toHaveBeenCalledWith(440, 0)
    expect(mock._oscillatorNode.detune.setValueAtTime).toHaveBeenCalledWith(10, 0)
  })

  it('start() sets oscillator type', () => {
    const { osc, mock } = setup({ type: 'square' })
    osc.start(440)
    expect(mock._oscillatorNode.type).toBe('square')
  })

  it('stop() stops and disconnects the oscillator', () => {
    const { osc, mock } = setup()
    osc.start(440)
    osc.stop()
    expect(mock._oscillatorNode.stop).toHaveBeenCalled()
    expect(osc.isPlaying).toBe(false)
  })

  it('stop() is a no-op when not playing', () => {
    const { osc, mock } = setup()
    expect(() => osc.stop()).not.toThrow()
    expect(mock._oscillatorNode.stop).not.toHaveBeenCalled()
  })

  it('setVolume clamps to 0–1', () => {
    const { osc, mock } = setup()
    osc.setVolume(1.5)
    expect(mock._gainNode.gain.setValueAtTime).toHaveBeenCalledWith(1, 0)
    osc.setVolume(-1)
    expect(mock._gainNode.gain.setValueAtTime).toHaveBeenCalledWith(0, 0)
  })

  it('start() stops any existing oscillator before starting a new one', () => {
    const { osc, mock } = setup()
    osc.start(440)
    osc.start(880)
    // stop should have been called once on the first oscillator before second start
    expect(mock._oscillatorNode.stop).toHaveBeenCalledTimes(1)
  })
})
