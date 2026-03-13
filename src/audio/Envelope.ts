import type { EnvelopeConfig } from '../types'

// AudioParam.cancelAndHoldAtTime is in the Web Audio spec but missing from TS DOM lib
type AudioParamWithHold = AudioParam & {
  cancelAndHoldAtTime?: (cancelTime: number) => AudioParam
}

// Minimum times to prevent audible clicks from zero-length ramps
const MIN_ATTACK_S = 0.003
const MIN_DECAY_S = 0.005
const MIN_RELEASE_S = 0.01
// Floor used for exponential ramps (can't ramp to/from exactly 0)
const FLOOR = 0.0001
// Short linear tail appended after the exponential release — brings gain to
// absolute zero so the oscillator can stop at a perfect silence point.
const LINEAR_TAIL_S = 0.005

/**
 * ADSR envelope applied to a GainNode.
 * Uses exponential ramps for natural-sounding attack/decay/release curves.
 * Release ends with a brief linear tail to true 0 so oscillators can be
 * stopped without any audible click at the cut-off point.
 */
export class Envelope {
  readonly gainNode: GainNode
  private context: AudioContext
  private config: EnvelopeConfig

  constructor(context: AudioContext, config: EnvelopeConfig, destination: AudioNode) {
    this.context = context
    this.config = { ...config }
    this.gainNode = context.createGain()
    this.gainNode.gain.value = FLOOR
    this.gainNode.connect(destination)
  }

  noteOn(startTime: number = this.context.currentTime): void {
    const { attack, decay, sustain } = this.config
    const safeAttack = Math.max(attack, MIN_ATTACK_S)
    const safeDecay = Math.max(decay, MIN_DECAY_S)
    const safeSustain = Math.max(sustain, FLOOR)
    const g = this.gainNode.gain as AudioParamWithHold

    g.cancelScheduledValues(startTime)
    g.setValueAtTime(FLOOR, startTime)
    g.exponentialRampToValueAtTime(1, startTime + safeAttack)
    g.exponentialRampToValueAtTime(safeSustain, startTime + safeAttack + safeDecay)
  }

  /**
   * Begin the release phase. Returns the time at which the gain reaches
   * absolute silence (gain = 0) — this is the correct time to stop oscillators
   * so they cut off at a zero-crossing with no click.
   */
  noteOff(stopTime: number = this.context.currentTime): number {
    const { release } = this.config
    const safeRelease = Math.max(release, MIN_RELEASE_S)
    const endTime = stopTime + safeRelease
    // Brief linear ramp from FLOOR→0 appended after the exponential decay.
    // This brings the gain to absolute zero so the oscillator stops silently.
    const silenceTime = endTime + LINEAR_TAIL_S
    const g = this.gainNode.gain as AudioParamWithHold

    // cancelAndHoldAtTime freezes the currently-scheduled automation value at
    // stopTime, preventing a click when interrupting an in-progress attack or
    // decay ramp.
    if (typeof g.cancelAndHoldAtTime === 'function') {
      g.cancelAndHoldAtTime(stopTime)
    } else {
      g.cancelScheduledValues(stopTime)
      g.setValueAtTime(Math.max(g.value, FLOOR), stopTime)
    }
    g.exponentialRampToValueAtTime(FLOOR, endTime)
    // Linear tail: FLOOR → 0. Linear ramps can target true zero (unlike
    // exponential), so this guarantees silence at the oscillator stop point.
    g.linearRampToValueAtTime(0, silenceTime)

    return silenceTime
  }

  setConfig(partial: Partial<EnvelopeConfig>): void {
    this.config = { ...this.config, ...partial }
  }

  get currentConfig(): Readonly<EnvelopeConfig> {
    return { ...this.config }
  }
}
