export interface TransportOptions {
  bpm: number
  bars: number
  stepsPerBar: number
}

export interface TransportCallbacks {
  onPlay: () => void
  onStop: () => void
  onBpmChange: (bpm: number) => void
  onBarsChange: (bars: number) => void
  onStepsChange: (stepsPerBar: number) => void
  onExport: () => void
}

const STEP_OPTIONS = [8, 16, 32] as const
const BAR_OPTIONS = [1, 2, 4, 8] as const

export class TransportBar {
  private container: HTMLElement
  private options: TransportOptions
  private callbacks: Partial<TransportCallbacks> = {}
  private playing = false
  private exporting = false

  constructor(container: HTMLElement, options: TransportOptions = { bpm: 120, bars: 2, stepsPerBar: 16 }) {
    this.container = container
    this.options = { ...options }
  }

  setCallbacks(cbs: Partial<TransportCallbacks>): void {
    this.callbacks = { ...this.callbacks, ...cbs }
  }

  setPlaying(playing: boolean): void {
    this.playing = playing
    const btn = this.container.querySelector<HTMLButtonElement>('[data-action="play-stop"]')
    if (btn) {
      btn.textContent = playing ? '■ Stop' : '▶ Play'
      btn.classList.toggle('active', playing)
    }
  }

  getOptions(): Readonly<TransportOptions> {
    return { ...this.options }
  }

  mount(): void {
    this.container.innerHTML = this.buildHTML()
    this.container.addEventListener('click', this.handleClick)
    this.container.addEventListener('change', this.handleChange)
    this.container.addEventListener('input', this.handleInput)
  }

  // ─── Rendering ──────────────────────────────────────────────────────────────

  private buildHTML(): string {
    const { bpm, bars, stepsPerBar } = this.options
    return `
      <div class="tb-controls">
        <button class="tb-play-btn${this.playing ? ' active' : ''}" data-action="play-stop">
          ${this.playing ? '■ Stop' : '▶ Play'}
        </button>
        <label class="tb-label">
          BPM
          <input type="number" class="tb-input" min="40" max="240" value="${bpm}"
            data-action="bpm" />
        </label>
        <label class="tb-label">
          Bars
          <select class="tb-select" data-action="bars">
            ${BAR_OPTIONS.map(b => `<option value="${b}" ${b === bars ? 'selected' : ''}>${b}</option>`).join('')}
          </select>
        </label>
        <label class="tb-label">
          Steps
          <select class="tb-select" data-action="steps">
            ${STEP_OPTIONS.map(s => `<option value="${s}" ${s === stepsPerBar ? 'selected' : ''}>${s}</option>`).join('')}
          </select>
        </label>
        <button class="tb-export-btn${this.exporting ? ' active' : ''}" data-action="export"
          ${this.exporting ? 'disabled' : ''}>
          ${this.exporting ? '⏺ Recording…' : '⬇ Export'}
        </button>
      </div>
    `
  }

  // ─── Event handlers ──────────────────────────────────────────────────────────

  setExporting(exporting: boolean): void {
    this.exporting = exporting
    const btn = this.container.querySelector<HTMLButtonElement>('[data-action="export"]')
    if (btn) {
      btn.textContent = exporting ? '⏺ Recording…' : '⬇ Export'
      btn.classList.toggle('active', exporting)
      btn.disabled = exporting
    }
  }

  private handleClick = (e: Event): void => {
    const target = e.target as HTMLElement
    const action = target.dataset['action']
    if (action === 'play-stop') {
      if (this.playing) {
        this.callbacks.onStop?.()
      } else {
        this.callbacks.onPlay?.()
      }
    } else if (action === 'export' && !this.exporting) {
      this.callbacks.onExport?.()
    }
  }

  private handleChange = (e: Event): void => {
    const target = e.target as HTMLSelectElement
    const action = target.dataset['action']
    const value = parseInt(target.value, 10)

    if (action === 'bars') {
      this.options.bars = value
      this.callbacks.onBarsChange?.(value)
    } else if (action === 'steps') {
      this.options.stepsPerBar = value
      this.callbacks.onStepsChange?.(value)
    }
  }

  private handleInput = (e: Event): void => {
    const target = e.target as HTMLInputElement
    if (target.dataset['action'] !== 'bpm') return
    const value = parseInt(target.value, 10)
    if (isNaN(value)) return
    const clamped = Math.max(40, Math.min(240, value))
    this.options.bpm = clamped
    this.callbacks.onBpmChange?.(clamped)
  }
}
