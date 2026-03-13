import type { InstrumentConfig, FilterConfig } from '../types'
import { SynthOscillator } from './Oscillator'
import { NoiseGenerator } from './NoiseGenerator'
import { Envelope } from './Envelope'

const DEFAULT_CONFIG: InstrumentConfig = {
  oscillators: [{ type: 'sine', detune: 0, volume: 0.8 }],
  noise: { enabled: false, type: 'white', volume: 0.3 },
  envelope: { attack: 0.01, decay: 0.1, sustain: 0.7, release: 0.3 },
  filter: { lpfEnabled: false, lpfFreq: 2000, lpfResonance: 1, hpfEnabled: false, hpfFreq: 80, hpfResonance: 1 },
  lfo: { enabled: false, rate: 5, depth: 0.5, target: 'amplitude', shape: 'sine' },
  effects: {
    reverb: { enabled: false, decay: 2, wet: 0.3 },
    delay: { enabled: false, time: 0.25, feedback: 0.3, wet: 0.3 },
    distortion: { enabled: false, amount: 0.3, wet: 0.5 },
  },
}

/**
 * Composes oscillators + noise + ADSR envelope into a playable voice.
 *
 * Signal chain:
 *   oscillators/noise → envelope.gain → HPF → LPF → outGain → destination
 *                                                        ↑
 *                                         LFO → lfoDepth → [target param]
 */
export class Instrument {
  private context: AudioContext
  private config: InstrumentConfig
  private oscillators: SynthOscillator[] = []
  private noise: NoiseGenerator
  private envelope: Envelope
  private hpf: BiquadFilterNode
  private lpf: BiquadFilterNode
  private outGain: GainNode
  private lfoNode: OscillatorNode | null = null
  private lfoDepth: GainNode | null = null

  constructor(
    context: AudioContext,
    destination: AudioNode,
    config: InstrumentConfig = DEFAULT_CONFIG,
  ) {
    this.context = context
    this.config = JSON.parse(JSON.stringify(config)) as InstrumentConfig

    // Build signal chain: envelope → HPF → LPF → outGain → destination
    this.outGain = context.createGain()
    this.outGain.gain.value = 1
    this.outGain.connect(destination)

    this.lpf = context.createBiquadFilter()
    this.lpf.type = 'lowpass'
    this.lpf.connect(this.outGain)

    this.hpf = context.createBiquadFilter()
    this.hpf.type = 'highpass'
    this.hpf.connect(this.lpf)

    // Envelope connects its gainNode to HPF
    this.envelope = new Envelope(context, config.envelope, this.hpf)

    // Oscillators and noise connect to envelope's gain node
    this.noise = new NoiseGenerator(context, config.noise, this.envelope.gainNode)
    for (const oscConfig of config.oscillators) {
      this.oscillators.push(
        new SynthOscillator(context, oscConfig, this.envelope.gainNode),
      )
    }

    this.applyFilterConfig(config.filter)
  }

  noteOn(frequency: number, startTime: number = this.context.currentTime): void {
    for (const osc of this.oscillators) {
      osc.start(frequency, startTime)
    }
    this.noise.start(startTime)
    this.envelope.noteOn(startTime)
    this.startLFO(startTime)
  }

  noteOff(stopTime: number = this.context.currentTime): void {
    const silenceTime = this.envelope.noteOff(stopTime)
    for (const osc of this.oscillators) {
      osc.stop(silenceTime)
    }
    this.noise.stop(silenceTime)
    if (this.lfoNode) {
      try { this.lfoNode.stop(silenceTime) } catch { /* ignore */ }
      this.lfoNode = null
      this.lfoDepth = null
    }
  }

  updateConfig(partial: Partial<InstrumentConfig>): void {
    this.config = { ...this.config, ...partial }
    if (partial.envelope) {
      this.envelope.setConfig(partial.envelope)
    }
    if (partial.filter) {
      this.applyFilterConfig(partial.filter)
    }
  }

  get currentConfig(): Readonly<InstrumentConfig> {
    return JSON.parse(JSON.stringify(this.config)) as InstrumentConfig
  }

  // ─── Private helpers ────────────────────────────────────────────────────────

  private applyFilterConfig(filter: FilterConfig): void {
    if (filter.hpfEnabled) {
      this.hpf.frequency.value = filter.hpfFreq
      this.hpf.Q.value = filter.hpfResonance
    } else {
      this.hpf.frequency.value = 20    // effectively bypassed
      this.hpf.Q.value = 0.1
    }
    if (filter.lpfEnabled) {
      this.lpf.frequency.value = filter.lpfFreq
      this.lpf.Q.value = filter.lpfResonance
    } else {
      this.lpf.frequency.value = 20000  // effectively bypassed
      this.lpf.Q.value = 0.1
    }
  }

  private startLFO(startTime: number): void {
    const { lfo, filter } = this.config
    if (!lfo.enabled) return

    this.lfoNode = this.context.createOscillator()
    this.lfoDepth = this.context.createGain()

    this.lfoNode.type = lfo.shape
    this.lfoNode.frequency.value = lfo.rate
    this.lfoNode.connect(this.lfoDepth)

    switch (lfo.target) {
      case 'amplitude':
        // Tremolo: center outGain at (1 - depth/2), modulate by ±(depth/2)
        this.outGain.gain.value = 1 - lfo.depth * 0.5
        this.lfoDepth.gain.value = lfo.depth * 0.5
        this.lfoDepth.connect(this.outGain.gain)
        break

      case 'lpf-freq': {
        const base = filter.lpfEnabled ? filter.lpfFreq : 5000
        this.lpf.frequency.value = base
        this.lfoDepth.gain.value = lfo.depth * 4000  // ±4000 Hz swing
        this.lfoDepth.connect(this.lpf.frequency)
        break
      }

      case 'hpf-freq': {
        const base = filter.hpfEnabled ? filter.hpfFreq : 200
        this.hpf.frequency.value = base
        this.lfoDepth.gain.value = lfo.depth * 2000  // ±2000 Hz swing
        this.lfoDepth.connect(this.hpf.frequency)
        break
      }

      case 'pitch':
        // Vibrato: ±100 cents (one semitone) at full depth
        this.lfoDepth.gain.value = lfo.depth * 100
        for (const osc of this.oscillators) {
          const dp = osc.detuneParam
          if (dp) this.lfoDepth.connect(dp)
        }
        break
    }

    this.lfoNode.start(startTime)
  }
}
