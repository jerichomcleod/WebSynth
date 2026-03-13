import type { NoteName, ScaleType } from '../types'
import { NOTE_NAMES } from '../sequencer/KeyHelper'

export type KeySelectorState = {
  root: NoteName
  scale: ScaleType
  minOctave: number
  maxOctave: number
}

export type KeyChangeCallback = (state: KeySelectorState) => void

const DEFAULT_STATE: KeySelectorState = {
  root: 'C',
  scale: 'major',
  minOctave: 3,
  maxOctave: 5,
}

export class KeySelector {
  private container: HTMLElement
  private state: KeySelectorState
  private onChange?: KeyChangeCallback

  constructor(container: HTMLElement, initialState: KeySelectorState = DEFAULT_STATE) {
    this.container = container
    this.state = { ...initialState }
  }

  setOnChange(cb: KeyChangeCallback): void {
    this.onChange = cb
  }

  getState(): Readonly<KeySelectorState> {
    return { ...this.state }
  }

  /** Programmatically update the octave range (used by piano roll +/- buttons). */
  setOctaveRange(minOctave: number, maxOctave: number): void {
    this.state.minOctave = Math.max(0, Math.min(minOctave, 8))
    this.state.maxOctave = Math.max(0, Math.min(maxOctave, 8))
    // Ensure min <= max
    if (this.state.minOctave > this.state.maxOctave) {
      this.state.maxOctave = this.state.minOctave
    }
    this.emit()
  }

  mount(): void {
    this.container.innerHTML = this.buildHTML()
    this.container.addEventListener('click', this.handleClick)
  }

  // ─── Rendering ──────────────────────────────────────────────────────────────

  private buildHTML(): string {
    const noteButtons = NOTE_NAMES.map(n => {
      const isSharp = n.includes('#')
      const isActive = n === this.state.root
      return `<button
        class="ks-note-btn${isSharp ? ' sharp' : ''}${isActive ? ' active' : ''}"
        data-action="set-root" data-note="${n}">${n}</button>`
    }).join('')

    return `
      <div class="ks-root-row">${noteButtons}</div>
      <div class="ks-controls">
        <div class="ks-scale-toggle">
          <button class="ks-scale-btn${this.state.scale === 'major' ? ' active' : ''}"
            data-action="set-scale" data-scale="major">Major</button>
          <button class="ks-scale-btn${this.state.scale === 'minor' ? ' active' : ''}"
            data-action="set-scale" data-scale="minor">Minor</button>
        </div>
      </div>
    `
  }

  // ─── Event handlers ──────────────────────────────────────────────────────────

  private handleClick = (e: Event): void => {
    const target = e.target as HTMLElement
    const action = target.dataset['action']

    if (action === 'set-root') {
      this.state.root = target.dataset['note'] as NoteName
      this.container.querySelectorAll<HTMLElement>('[data-action="set-root"]').forEach(btn => {
        btn.classList.toggle('active', btn.dataset['note'] === this.state.root)
      })
      this.emit()
    } else if (action === 'set-scale') {
      this.state.scale = target.dataset['scale'] as ScaleType
      this.container.querySelectorAll<HTMLElement>('[data-action="set-scale"]').forEach(btn => {
        btn.classList.toggle('active', btn.dataset['scale'] === this.state.scale)
      })
      this.emit()
    }
  }

  private emit(): void {
    this.onChange?.({ ...this.state })
  }
}
