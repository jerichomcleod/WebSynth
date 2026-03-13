/**
 * AudioEngine — singleton wrapper around AudioContext.
 * Manages the master gain node, dynamics compressor, and context lifecycle.
 */
export class AudioEngine {
  private static instance: AudioEngine | null = null

  readonly context: AudioContext
  readonly masterGain: GainNode
  private compressor: DynamicsCompressorNode
  private streamDest: MediaStreamAudioDestinationNode | null = null

  private constructor() {
    this.context = new AudioContext()
    this.masterGain = this.context.createGain()
    this.masterGain.gain.value = 0.8

    // Limiter/compressor prevents polyphony clipping (the main source of pops
    // when multiple notes are playing simultaneously).
    this.compressor = this.context.createDynamicsCompressor()
    this.compressor.threshold.value = -18   // dBFS — start compressing here
    this.compressor.knee.value = 8          // soft-knee width
    this.compressor.ratio.value = 6         // 6:1 limiting ratio
    this.compressor.attack.value = 0.003    // 3 ms attack
    this.compressor.release.value = 0.1     // 100 ms release

    this.masterGain.connect(this.compressor)
    this.compressor.connect(this.context.destination)
  }

  static getInstance(): AudioEngine {
    if (!AudioEngine.instance) {
      AudioEngine.instance = new AudioEngine()
    }
    return AudioEngine.instance
  }

  /** Resume a suspended context (required by browser autoplay policy). */
  async resume(): Promise<void> {
    if (this.context.state === 'suspended') {
      await this.context.resume()
    }
  }

  async suspend(): Promise<void> {
    if (this.context.state === 'running') {
      await this.context.suspend()
    }
  }

  setMasterVolume(value: number): void {
    this.masterGain.gain.setValueAtTime(
      Math.max(0, Math.min(1, value)),
      this.context.currentTime,
    )
  }

  get state(): AudioContextState {
    return this.context.state
  }

  /**
   * Returns a MediaStream from the audio output — used for recording/export.
   * The stream captures the post-compressor signal.
   * Lazily created on first call.
   */
  getDestinationStream(): MediaStream {
    if (!this.streamDest) {
      this.streamDest = this.context.createMediaStreamDestination()
      this.compressor.connect(this.streamDest)
    }
    return this.streamDest.stream
  }

  /** Reset singleton — only used in tests. */
  static _reset(): void {
    AudioEngine.instance = null
  }
}
