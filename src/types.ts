// ─── Oscillator ──────────────────────────────────────────────────────────────

export type OscillatorType = 'sine' | 'square' | 'sawtooth' | 'triangle'

export interface OscillatorConfig {
  type: OscillatorType
  /** Cents of detune from base pitch (-100 to +100) */
  detune: number
  /** Linear gain multiplier (0–1) */
  volume: number
}

// ─── Noise ───────────────────────────────────────────────────────────────────

export type NoiseType = 'white' | 'pink'

export interface NoiseConfig {
  enabled: boolean
  type: NoiseType
  volume: number
}

// ─── Envelope ────────────────────────────────────────────────────────────────

export interface EnvelopeConfig {
  /** Attack time in seconds (0–5) */
  attack: number
  /** Decay time in seconds (0–5) */
  decay: number
  /** Sustain level (0–1) */
  sustain: number
  /** Release time in seconds (0–10) */
  release: number
}

// ─── Filter ──────────────────────────────────────────────────────────────────

export interface FilterConfig {
  lpfEnabled: boolean
  /** Low-pass cutoff frequency in Hz (20–20000) */
  lpfFreq: number
  /** Low-pass resonance Q factor (0.1–30) */
  lpfResonance: number
  hpfEnabled: boolean
  /** High-pass cutoff frequency in Hz (20–20000) */
  hpfFreq: number
  /** High-pass resonance Q factor (0.1–30) */
  hpfResonance: number
}

// ─── LFO ─────────────────────────────────────────────────────────────────────

export type LFOTarget = 'amplitude' | 'lpf-freq' | 'hpf-freq' | 'pitch'

export interface LFOConfig {
  enabled: boolean
  /** LFO rate in Hz (0.1–20) */
  rate: number
  /** Depth 0–1 (scales to target-appropriate range) */
  depth: number
  target: LFOTarget
  shape: OscillatorType
}

// ─── Effects ─────────────────────────────────────────────────────────────────

export interface ReverbConfig {
  enabled: boolean
  /** IR decay time in seconds (0.1–10) */
  decay: number
  /** Wet mix 0–1 */
  wet: number
}

export interface DelayConfig {
  enabled: boolean
  /** Delay time in seconds (0–1) */
  time: number
  /** Feedback amount 0–0.95 */
  feedback: number
  /** Wet mix 0–1 */
  wet: number
}

export interface DistortionConfig {
  enabled: boolean
  /** Drive amount 0–1 */
  amount: number
  /** Wet mix 0–1 */
  wet: number
}

export interface EffectsConfig {
  reverb: ReverbConfig
  delay: DelayConfig
  distortion: DistortionConfig
}

// ─── Instrument ──────────────────────────────────────────────────────────────

export interface InstrumentConfig {
  oscillators: OscillatorConfig[]
  noise: NoiseConfig
  envelope: EnvelopeConfig
  filter: FilterConfig
  lfo: LFOConfig
  effects: EffectsConfig
}

// ─── Sequencer ───────────────────────────────────────────────────────────────

export type NoteName =
  | 'C' | 'C#' | 'D' | 'D#' | 'E' | 'F'
  | 'F#' | 'G' | 'G#' | 'A' | 'A#' | 'B'

export type ScaleType = 'major' | 'minor'

export interface NoteEvent {
  /** e.g. "C4", "F#3" */
  note: string
  /** MIDI note number */
  midi: number
  /** Frequency in Hz */
  frequency: number
}

export interface PlacedNote {
  id: string
  note: NoteEvent
  /** Absolute step index from start of pattern */
  startStep: number
  /** Duration in steps (min 1) */
  durationSteps: number
}

export interface Pattern {
  bars: number
  stepsPerBar: number
  notes: PlacedNote[]
}

export interface TransportState {
  bpm: number
  playing: boolean
}
