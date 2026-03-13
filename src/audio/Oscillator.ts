import type { OscillatorConfig } from '../types'

/**
 * Wraps a Web Audio OscillatorNode with gain/detune control.
 * Output connects to the provided destination node.
 */
export class SynthOscillator {
  private oscillatorNode: OscillatorNode | null = null
  private gainNode: GainNode
  private context: AudioContext
  private config: OscillatorConfig

  constructor(context: AudioContext, config: OscillatorConfig, destination: AudioNode) {
    this.context = context
    this.config = { ...config }
    this.gainNode = context.createGain()
    this.gainNode.gain.value = config.volume
    this.gainNode.connect(destination)
  }

  start(frequency: number, startTime: number = this.context.currentTime): void {
    this.stop()
    this.oscillatorNode = this.context.createOscillator()
    this.oscillatorNode.type = this.config.type
    this.oscillatorNode.frequency.setValueAtTime(frequency, startTime)
    this.oscillatorNode.detune.setValueAtTime(this.config.detune, startTime)
    this.oscillatorNode.connect(this.gainNode)
    this.oscillatorNode.start(startTime)
  }

  stop(stopTime: number = this.context.currentTime): void {
    if (this.oscillatorNode) {
      const node = this.oscillatorNode
      this.oscillatorNode = null
      try {
        node.stop(stopTime)
        // Defer disconnect until the node has actually finished playing.
        // Calling disconnect() immediately would sever the signal path while
        // the envelope release ramp is still running, causing an audible pop.
        node.onended = () => { try { node.disconnect() } catch { /* ignore */ } }
      } catch {
        try { node.disconnect() } catch { /* ignore */ }
      }
    }
  }

  setType(type: OscillatorConfig['type']): void {
    this.config.type = type
    if (this.oscillatorNode) {
      this.oscillatorNode.type = type
    }
  }

  setDetune(cents: number): void {
    this.config.detune = cents
    if (this.oscillatorNode) {
      this.oscillatorNode.detune.setValueAtTime(cents, this.context.currentTime)
    }
  }

  setVolume(value: number): void {
    this.config.volume = Math.max(0, Math.min(1, value))
    this.gainNode.gain.setValueAtTime(this.config.volume, this.context.currentTime)
  }

  get isPlaying(): boolean {
    return this.oscillatorNode !== null
  }

  /** Returns the live detune AudioParam for LFO connection (null if not started). */
  get detuneParam(): AudioParam | null {
    return this.oscillatorNode?.detune ?? null
  }
}
