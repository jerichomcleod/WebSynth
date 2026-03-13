import type { NoiseConfig } from '../types'

const BUFFER_SIZE = 2 * 44100 // 2 seconds of samples

function buildWhiteNoiseBuffer(context: AudioContext): AudioBuffer {
  const buffer = context.createBuffer(1, BUFFER_SIZE, context.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < BUFFER_SIZE; i++) {
    data[i] = Math.random() * 2 - 1
  }
  return buffer
}

function buildPinkNoiseBuffer(context: AudioContext): AudioBuffer {
  const buffer = context.createBuffer(1, BUFFER_SIZE, context.sampleRate)
  const data = buffer.getChannelData(0)
  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0
  for (let i = 0; i < BUFFER_SIZE; i++) {
    const white = Math.random() * 2 - 1
    b0 = 0.99886 * b0 + white * 0.0555179
    b1 = 0.99332 * b1 + white * 0.0750759
    b2 = 0.96900 * b2 + white * 0.1538520
    b3 = 0.86650 * b3 + white * 0.3104856
    b4 = 0.55000 * b4 + white * 0.5329522
    b5 = -0.7616 * b5 - white * 0.0168980
    data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11
    b6 = white * 0.115926
  }
  return buffer
}

/**
 * Looped noise source with gain control.
 * Output connects to the provided destination node.
 */
export class NoiseGenerator {
  private sourceNode: AudioBufferSourceNode | null = null
  private gainNode: GainNode
  private context: AudioContext
  private config: NoiseConfig

  constructor(context: AudioContext, config: NoiseConfig, destination: AudioNode) {
    this.context = context
    this.config = { ...config }
    this.gainNode = context.createGain()
    this.gainNode.gain.value = config.enabled ? config.volume : 0
    this.gainNode.connect(destination)
  }

  start(startTime: number = this.context.currentTime): void {
    if (!this.config.enabled) return
    this.stop()
    const buffer =
      this.config.type === 'pink'
        ? buildPinkNoiseBuffer(this.context)
        : buildWhiteNoiseBuffer(this.context)

    this.sourceNode = this.context.createBufferSource()
    this.sourceNode.buffer = buffer
    this.sourceNode.loop = true
    this.sourceNode.connect(this.gainNode)
    this.sourceNode.start(startTime)
  }

  stop(stopTime: number = this.context.currentTime): void {
    if (this.sourceNode) {
      const node = this.sourceNode
      this.sourceNode = null
      try {
        node.stop(stopTime)
        // Defer disconnect to onended — same reason as SynthOscillator:
        // immediate disconnect during an active envelope release causes a pop.
        node.onended = () => { try { node.disconnect() } catch { /* ignore */ } }
      } catch {
        try { node.disconnect() } catch { /* ignore */ }
      }
    }
  }

  setEnabled(enabled: boolean): void {
    this.config.enabled = enabled
    this.gainNode.gain.setValueAtTime(
      enabled ? this.config.volume : 0,
      this.context.currentTime,
    )
  }

  setVolume(value: number): void {
    this.config.volume = Math.max(0, Math.min(1, value))
    if (this.config.enabled) {
      this.gainNode.gain.setValueAtTime(this.config.volume, this.context.currentTime)
    }
  }

  get isPlaying(): boolean {
    return this.sourceNode !== null
  }
}
