import type { EffectsConfig } from '../types'

/**
 * A parallel effects bus: reverb, delay, distortion.
 * Each effect has a wet/dry mix and can be enabled/disabled.
 *
 * Signal flow:
 *   input → dryGain ────────────────────────────┐
 *         → reverb → reverbWet ─────────────────┤
 *         → delay ← feedbackGain                │
 *                  → delayWet ──────────────────┤ → output → destination
 *         → distortion → distortionWet ─────────┘
 */
export class EffectsChain {
  readonly input: GainNode
  readonly output: GainNode

  private context: AudioContext
  private dryGain: GainNode
  private reverb: ConvolverNode
  private reverbWet: GainNode
  private delay: DelayNode
  private delayFeedback: GainNode
  private delayWet: GainNode
  private distortion: WaveShaperNode
  private distortionWet: GainNode

  private lastDecay = -1
  private lastDistortion = -1

  constructor(context: AudioContext, config: EffectsConfig, destination: AudioNode) {
    this.context = context

    this.input = context.createGain()
    this.output = context.createGain()
    this.output.connect(destination)

    // ── Dry path ────────────────────────────────────────────────────────────
    this.dryGain = context.createGain()
    this.dryGain.gain.value = 1
    this.input.connect(this.dryGain)
    this.dryGain.connect(this.output)

    // ── Reverb ───────────────────────────────────────────────────────────────
    this.reverb = context.createConvolver()
    this.reverbWet = context.createGain()
    this.input.connect(this.reverb)
    this.reverb.connect(this.reverbWet)
    this.reverbWet.connect(this.output)

    // ── Delay ────────────────────────────────────────────────────────────────
    this.delay = context.createDelay(1.0)
    this.delayFeedback = context.createGain()
    this.delayWet = context.createGain()
    this.input.connect(this.delay)
    this.delay.connect(this.delayFeedback)
    this.delayFeedback.connect(this.delay) // feedback loop
    this.delay.connect(this.delayWet)
    this.delayWet.connect(this.output)

    // ── Distortion ───────────────────────────────────────────────────────────
    this.distortion = context.createWaveShaper()
    this.distortion.oversample = '4x'
    this.distortionWet = context.createGain()
    this.input.connect(this.distortion)
    this.distortion.connect(this.distortionWet)
    this.distortionWet.connect(this.output)

    this.applyConfig(config)
  }

  applyConfig(config: EffectsConfig): void {
    const { reverb, delay, distortion } = config

    // Reverb
    this.reverbWet.gain.value = reverb.enabled ? reverb.wet : 0
    if (reverb.enabled && reverb.decay !== this.lastDecay) {
      this.buildReverbIR(reverb.decay)
      this.lastDecay = reverb.decay
    }

    // Delay
    this.delay.delayTime.value = delay.time
    this.delayFeedback.gain.value = delay.feedback
    this.delayWet.gain.value = delay.enabled ? delay.wet : 0

    // Distortion
    this.distortionWet.gain.value = distortion.enabled ? distortion.wet : 0
    if (distortion.amount !== this.lastDistortion) {
      this.buildDistortionCurve(distortion.amount)
      this.lastDistortion = distortion.amount
    }
  }

  private buildReverbIR(decay: number): void {
    const sr = this.context.sampleRate
    const length = Math.max(1, Math.floor(sr * Math.max(0.1, decay)))
    const ir = this.context.createBuffer(2, length, sr)
    for (let ch = 0; ch < 2; ch++) {
      const data = ir.getChannelData(ch)
      for (let i = 0; i < length; i++) {
        const env = Math.pow(1 - i / length, 2)
        data[i] = (Math.random() * 2 - 1) * env
      }
    }
    this.reverb.buffer = ir
  }

  private buildDistortionCurve(amount: number): void {
    const k = amount * 400  // 0–400 drive
    const n = 256
    const curve = new Float32Array(n)
    for (let i = 0; i < n; i++) {
      const x = (i * 2) / n - 1
      curve[i] = k === 0 ? x : ((3 + k) * x) / (3 + k * Math.abs(x))
    }
    this.distortion.curve = curve
  }
}
