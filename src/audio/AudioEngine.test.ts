import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { installAudioContextMock } from '../test-utils/audioMocks'
import { AudioEngine } from './AudioEngine'

describe('AudioEngine', () => {
  const { getCtx } = installAudioContextMock()

  beforeEach(() => {
    AudioEngine._reset()
  })

  it('is a singleton — returns same instance', () => {
    const a = AudioEngine.getInstance()
    const b = AudioEngine.getInstance()
    expect(a).toBe(b)
  })

  it('creates a master gain node routed through a compressor to destination', () => {
    const engine = AudioEngine.getInstance()
    const ctx = getCtx()
    expect(ctx.createGain).toHaveBeenCalled()
    expect(ctx.createDynamicsCompressor).toHaveBeenCalled()
    // Chain: masterGain → compressor → destination
    expect(ctx._gainNode.connect).toHaveBeenCalledWith(ctx._compressor)
    expect(ctx._compressor.connect).toHaveBeenCalledWith(ctx.destination)
    expect(engine.masterGain).toBeDefined()
  })

  it('sets initial master gain to 0.8', () => {
    AudioEngine.getInstance()
    const ctx = getCtx()
    expect(ctx._gainNode.gain.value).toBe(0.8)
  })

  it('resume() calls context.resume when suspended', async () => {
    const ctx = getCtx()
    ctx.state = 'suspended'
    const engine = AudioEngine.getInstance()
    await engine.resume()
    expect(ctx.resume).toHaveBeenCalled()
  })

  it('resume() is a no-op when already running', async () => {
    const ctx = getCtx()
    ctx.state = 'running'
    const engine = AudioEngine.getInstance()
    await engine.resume()
    expect(ctx.resume).not.toHaveBeenCalled()
  })

  it('suspend() calls context.suspend when running', async () => {
    const ctx = getCtx()
    ctx.state = 'running'
    const engine = AudioEngine.getInstance()
    await engine.suspend()
    expect(ctx.suspend).toHaveBeenCalled()
  })

  it('setMasterVolume clamps value to 0–1', () => {
    const engine = AudioEngine.getInstance()
    const ctx = getCtx()
    engine.setMasterVolume(1.5)
    expect(ctx._gainNode.gain.setValueAtTime).toHaveBeenCalledWith(1, 0)
    engine.setMasterVolume(-0.5)
    expect(ctx._gainNode.gain.setValueAtTime).toHaveBeenCalledWith(0, 0)
  })

  it('exposes context state', () => {
    const engine = AudioEngine.getInstance()
    expect(engine.state).toBe('running')
  })
})
