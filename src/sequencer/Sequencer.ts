import type { Pattern, TransportState } from '../types'

/** scheduledTime is the AudioContext time at which this step should play. */
export type StepCallback = (bar: number, step: number, scheduledTime: number) => void

const LOOKAHEAD_MS = 25
const SCHEDULE_AHEAD_TIME = 0.1 // seconds

/**
 * Web Audio clock-based step sequencer.
 * Uses AudioContext.currentTime for drift-free scheduling with a
 * setTimeout lookahead loop (standard pattern from Chris Wilson's article).
 */
export class Sequencer {
  private context: AudioContext
  private transport: TransportState = { bpm: 120, playing: false }
  private pattern: Pattern
  private onStep: StepCallback

  private currentBar = 0
  private currentStep = 0
  private nextStepTime = 0
  private timerId: ReturnType<typeof setTimeout> | null = null

  constructor(context: AudioContext, pattern: Pattern, onStep: StepCallback) {
    this.context = context
    this.pattern = pattern
    this.onStep = onStep
  }

  get stepDuration(): number {
    // Duration of one step in seconds (quarter note / stepsPerBar at current BPM)
    const beatsPerStep = 1 / (this.pattern.stepsPerBar / 4)
    return (60 / this.transport.bpm) * beatsPerStep
  }

  start(): void {
    if (this.transport.playing) return
    this.transport.playing = true
    this.currentBar = 0
    this.currentStep = 0
    this.nextStepTime = this.context.currentTime
    this.schedule()
  }

  stop(): void {
    this.transport.playing = false
    if (this.timerId !== null) {
      clearTimeout(this.timerId)
      this.timerId = null
    }
  }

  setBpm(bpm: number): void {
    this.transport.bpm = Math.max(40, Math.min(240, bpm))
  }

  setPattern(pattern: Pattern): void {
    this.pattern = pattern
  }

  get isPlaying(): boolean {
    return this.transport.playing
  }

  get bpm(): number {
    return this.transport.bpm
  }

  private schedule(): void {
    while (
      this.nextStepTime <
      this.context.currentTime + SCHEDULE_AHEAD_TIME
    ) {
      this.onStep(this.currentBar, this.currentStep, this.nextStepTime)
      this.advance()
    }

    if (this.transport.playing) {
      this.timerId = setTimeout(() => this.schedule(), LOOKAHEAD_MS)
    }
  }

  private advance(): void {
    this.nextStepTime += this.stepDuration
    this.currentStep++
    if (this.currentStep >= this.pattern.stepsPerBar) {
      this.currentStep = 0
      this.currentBar = (this.currentBar + 1) % this.pattern.bars
    }
  }
}
