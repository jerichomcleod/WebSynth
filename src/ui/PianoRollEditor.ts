import type { Pattern, NoteEvent } from '../types'
import { addNote, removeNote, resizeNote, totalSteps } from '../sequencer/Pattern'

const ROW_HEIGHT = 22  // px per note row
const STEP_WIDTH = 28  // px per step column
const KEY_WIDTH = 64   // px for the keys sidebar

export type PatternChangeCallback = (pattern: Pattern) => void
export type NotePreviewCallback = (note: NoteEvent) => void

type PlaceDrag = {
  type: 'place'
  startCol: number
  row: number
  note: NoteEvent
  currentDuration: number
}

type ResizeDrag = {
  type: 'resize'
  id: string
  startX: number
  originalDuration: number
  currentDuration: number
}

type DragState = PlaceDrag | ResizeDrag

export class PianoRollEditor {
  private container: HTMLElement
  /** Scale notes sorted high→low (top of grid = highest pitch) */
  private scaleNotes: NoteEvent[] = []
  private pattern: Pattern | null = null
  private onChange?: PatternChangeCallback
  private onPreview?: NotePreviewCallback
  private onOctaveUp?: () => void
  private onOctaveDown?: () => void
  private dragState: DragState | null = null

  private keysEl: HTMLElement | null = null
  private gridScrollEl: HTMLElement | null = null
  private gridInnerEl: HTMLElement | null = null
  private notesLayerEl: HTMLElement | null = null
  private playheadEl: HTMLElement | null = null

  constructor(container: HTMLElement) {
    this.container = container
  }

  setOnPatternChange(cb: PatternChangeCallback): void { this.onChange = cb }
  setOnNotePreview(cb: NotePreviewCallback): void { this.onPreview = cb }
  setOnOctaveUp(cb: () => void): void { this.onOctaveUp = cb }
  setOnOctaveDown(cb: () => void): void { this.onOctaveDown = cb }

  setNotes(notes: NoteEvent[]): void {
    this.scaleNotes = [...notes].sort((a, b) => b.midi - a.midi)
    this.render()
  }

  setPattern(pattern: Pattern): void {
    this.pattern = pattern
    this.renderGridBg()
    this.renderNotes()
    this.updateGridSize()
  }

  getPattern(): Pattern | null {
    return this.pattern
  }

  mount(): void {
    this.container.innerHTML = `
      <div class="pre-wrap">
        <div class="pre-oct-bar pre-oct-top">
          <button class="pre-oct-btn" data-action="oct-up" title="Add octave above">▲ Oct</button>
          <button class="pre-oct-btn pre-oct-shrink" data-action="oct-shrink-top" title="Remove top octave">−</button>
        </div>
        <div class="pre-editor">
          <div class="pre-keys" data-region="keys"></div>
          <div class="pre-grid-scroll" data-region="grid-scroll">
            <div class="pre-grid-inner" data-region="grid-inner">
              <div class="pre-grid-bg" data-region="grid-bg"></div>
              <div class="pre-notes-layer" data-region="notes"></div>
              <div class="pre-playhead" data-region="playhead"></div>
            </div>
          </div>
        </div>
        <div class="pre-oct-bar pre-oct-bottom">
          <button class="pre-oct-btn pre-oct-shrink" data-action="oct-shrink-bot" title="Remove bottom octave">−</button>
          <button class="pre-oct-btn" data-action="oct-down" title="Add octave below">▼ Oct</button>
        </div>
      </div>
    `
    this.keysEl = this.container.querySelector('[data-region="keys"]')
    this.gridScrollEl = this.container.querySelector('[data-region="grid-scroll"]')
    this.gridInnerEl = this.container.querySelector('[data-region="grid-inner"]')
    this.notesLayerEl = this.container.querySelector('[data-region="notes"]')
    this.playheadEl = this.container.querySelector('[data-region="playhead"]')

    // Sync vertical scroll: grid drives keys column
    this.gridScrollEl?.addEventListener('scroll', () => {
      if (this.keysEl && this.gridScrollEl) {
        this.keysEl.scrollTop = this.gridScrollEl.scrollTop
      }
    })

    this.container.addEventListener('click', this.handleOctaveBtns)
    this.keysEl?.addEventListener('pointerdown', this.handleKeyPointerDown)
    this.gridScrollEl?.addEventListener('pointerdown', this.handleGridPointerDown)

    this.render()
  }

  advancePlayhead(bar: number, step: number): void {
    if (!this.pattern || !this.playheadEl) return
    const absoluteStep = bar * this.pattern.stepsPerBar + step
    this.playheadEl.style.transform = `translateX(${absoluteStep * STEP_WIDTH}px)`
    this.playheadEl.style.display = 'block'
  }

  clearPlayhead(): void {
    if (this.playheadEl) this.playheadEl.style.display = 'none'
  }

  // ─── Rendering ──────────────────────────────────────────────────────────────

  private render(): void {
    this.renderKeys()
    this.renderGridBg()
    this.renderNotes()
    this.updateGridSize()
  }

  private renderKeys(): void {
    if (!this.keysEl) return
    if (this.scaleNotes.length === 0) {
      this.keysEl.innerHTML = '<span class="pre-empty">Select a key &amp; scale above</span>'
      return
    }
    this.keysEl.innerHTML = this.scaleNotes
      .map(n => {
        const isSharp = n.note.includes('#')
        return `<div
          class="pre-key-row${isSharp ? ' sharp' : ''}"
          data-midi="${n.midi}"
          style="height:${ROW_HEIGHT}px;min-height:${ROW_HEIGHT}px"
          title="${n.note} — ${n.frequency.toFixed(1)} Hz">
          <span class="pre-key-label">${n.note}</span>
        </div>`
      })
      .join('')
  }

  private renderGridBg(): void {
    const bgEl = this.container.querySelector<HTMLElement>('[data-region="grid-bg"]')
    if (!bgEl || !this.pattern) return
    const total = totalSteps(this.pattern)
    const numRows = this.scaleNotes.length
    const { stepsPerBar } = this.pattern

    // Row stripes
    const rowBgs = this.scaleNotes
      .map((n, i) => {
        const isSharp = n.note.includes('#')
        return `<div
          class="pre-row-bg${isSharp ? ' sharp' : ''}"
          style="top:${i * ROW_HEIGHT}px;width:${total * STEP_WIDTH}px;height:${ROW_HEIGHT}px">
        </div>`
      })
      .join('')

    // Vertical column lines: beat lines every 4 steps, bar lines every stepsPerBar
    const colLines: string[] = []
    for (let col = 1; col < total; col++) {
      const isBar = col % stepsPerBar === 0
      const isBeat = col % 4 === 0
      if (isBar) {
        colLines.push(
          `<div class="pre-col-bar" style="left:${col * STEP_WIDTH}px;height:${numRows * ROW_HEIGHT}px"></div>`,
        )
      } else if (isBeat) {
        colLines.push(
          `<div class="pre-col-beat" style="left:${col * STEP_WIDTH}px;height:${numRows * ROW_HEIGHT}px"></div>`,
        )
      }
    }

    bgEl.innerHTML = rowBgs + colLines.join('')
  }

  private renderNotes(): void {
    if (!this.notesLayerEl || !this.pattern) return
    this.notesLayerEl.innerHTML = this.pattern.notes
      .map(pn => {
        const rowIndex = this.scaleNotes.findIndex(n => n.midi === pn.note.midi)
        if (rowIndex === -1) return ''
        const top = rowIndex * ROW_HEIGHT
        const left = pn.startStep * STEP_WIDTH
        const width = pn.durationSteps * STEP_WIDTH
        return `<div
          class="pre-note"
          data-id="${pn.id}"
          style="top:${top}px;left:${left}px;width:${width}px;height:${ROW_HEIGHT}px"
          title="${pn.note.note}">
          <span class="pre-note-label">${pn.note.note}</span>
          <div class="pre-resize-handle"></div>
        </div>`
      })
      .join('')
  }

  private updateGridSize(): void {
    if (!this.gridInnerEl || !this.pattern) return
    const total = totalSteps(this.pattern)
    const numRows = Math.max(this.scaleNotes.length, 1)
    this.gridInnerEl.style.width = `${total * STEP_WIDTH}px`
    this.gridInnerEl.style.height = `${numRows * ROW_HEIGHT}px`
    if (this.playheadEl) {
      this.playheadEl.style.height = `${numRows * ROW_HEIGHT}px`
    }
  }

  // ─── Event handlers ──────────────────────────────────────────────────────────

  private handleOctaveBtns = (e: Event): void => {
    const target = (e.target as HTMLElement).closest<HTMLElement>('[data-action]')
    if (!target) return
    const action = target.dataset['action']
    if (action === 'oct-up') this.onOctaveUp?.()
    else if (action === 'oct-down') this.onOctaveDown?.()
    else if (action === 'oct-shrink-top') this.onOctaveShrinkTop?.()
    else if (action === 'oct-shrink-bot') this.onOctaveShrinkBot?.()
  }

  // These optional callbacks let main.ts shrink the octave range from either end
  onOctaveShrinkTop?: () => void
  onOctaveShrinkBot?: () => void

  private handleKeyPointerDown = (e: PointerEvent): void => {
    const target = (e.target as HTMLElement).closest<HTMLElement>('[data-midi]')
    if (!target) return
    const midi = parseInt(target.dataset['midi']!, 10)
    const note = this.scaleNotes.find(n => n.midi === midi)
    if (note) this.onPreview?.(note)
  }

  private handleGridPointerDown = (e: PointerEvent): void => {
    if (!this.pattern || !this.gridScrollEl || !this.gridInnerEl) return
    e.preventDefault()

    const resizeHandle = (e.target as HTMLElement).closest<HTMLElement>('.pre-resize-handle')
    const noteEl = (e.target as HTMLElement).closest<HTMLElement>('.pre-note')

    if (resizeHandle && noteEl) {
      const id = noteEl.dataset['id']!
      const placed = this.pattern.notes.find(n => n.id === id)
      if (!placed) return
      this.dragState = {
        type: 'resize',
        id,
        startX: e.clientX,
        originalDuration: placed.durationSteps,
        currentDuration: placed.durationSteps,
      }
      try { this.gridScrollEl.setPointerCapture(e.pointerId) } catch { /* jsdom */ }
      this.gridScrollEl.addEventListener('pointermove', this.handlePointerMove)
      this.gridScrollEl.addEventListener('pointerup', this.handlePointerUp)
    } else if (noteEl) {
      const id = noteEl.dataset['id']!
      this.pattern = removeNote(this.pattern, id)
      this.renderNotes()
      this.onChange?.(this.pattern)
    } else {
      const rect = this.gridScrollEl.getBoundingClientRect()
      const x = e.clientX - rect.left + this.gridScrollEl.scrollLeft
      const y = e.clientY - rect.top + this.gridScrollEl.scrollTop
      const col = Math.floor(x / STEP_WIDTH)
      const row = Math.floor(y / ROW_HEIGHT)
      const note = this.scaleNotes[row]
      if (!note || col < 0 || col >= totalSteps(this.pattern)) return
      this.dragState = { type: 'place', startCol: col, row, note, currentDuration: 1 }
      try { this.gridScrollEl.setPointerCapture(e.pointerId) } catch { /* jsdom */ }
      this.gridScrollEl.addEventListener('pointermove', this.handlePointerMove)
      this.gridScrollEl.addEventListener('pointerup', this.handlePointerUp)
      this.showGhost(row, col, 1)
    }
  }

  private handlePointerMove = (e: PointerEvent): void => {
    if (!this.dragState || !this.pattern || !this.gridScrollEl) return

    if (this.dragState.type === 'place') {
      const rect = this.gridScrollEl.getBoundingClientRect()
      const x = e.clientX - rect.left + this.gridScrollEl.scrollLeft
      const col = Math.floor(x / STEP_WIDTH)
      const duration = Math.max(1, col - this.dragState.startCol + 1)
      this.dragState.currentDuration = duration
      this.showGhost(this.dragState.row, this.dragState.startCol, duration)
    } else if (this.dragState.type === 'resize') {
      const deltaX = e.clientX - this.dragState.startX
      const deltaCols = Math.round(deltaX / STEP_WIDTH)
      const newDuration = Math.max(1, this.dragState.originalDuration + deltaCols)
      this.dragState.currentDuration = newDuration
      const noteEl = this.notesLayerEl?.querySelector<HTMLElement>(
        `[data-id="${this.dragState.id}"]`,
      )
      if (noteEl) noteEl.style.width = `${newDuration * STEP_WIDTH}px`
    }
  }

  private handlePointerUp = (e: PointerEvent): void => {
    if (!this.dragState || !this.pattern) return
    this.gridScrollEl?.removeEventListener('pointermove', this.handlePointerMove)
    this.gridScrollEl?.removeEventListener('pointerup', this.handlePointerUp)
    try { this.gridScrollEl?.releasePointerCapture(e.pointerId) } catch { /* jsdom */ }

    if (this.dragState.type === 'place') {
      this.removeGhost()
      this.pattern = addNote(
        this.pattern,
        this.dragState.note,
        this.dragState.startCol,
        this.dragState.currentDuration,
      )
      this.renderNotes()
      this.onChange?.(this.pattern)
    } else if (this.dragState.type === 'resize') {
      this.pattern = resizeNote(this.pattern, this.dragState.id, this.dragState.currentDuration)
      this.renderNotes()
      this.onChange?.(this.pattern)
    }
    this.dragState = null
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────────

  private showGhost(row: number, col: number, duration: number): void {
    let ghost = this.notesLayerEl?.querySelector<HTMLElement>('.pre-ghost')
    if (!ghost && this.notesLayerEl) {
      ghost = document.createElement('div')
      ghost.className = 'pre-ghost'
      this.notesLayerEl.appendChild(ghost)
    }
    if (!ghost) return
    ghost.style.top = `${row * ROW_HEIGHT}px`
    ghost.style.left = `${col * STEP_WIDTH}px`
    ghost.style.width = `${duration * STEP_WIDTH}px`
    ghost.style.height = `${ROW_HEIGHT}px`
  }

  private removeGhost(): void {
    this.notesLayerEl?.querySelector('.pre-ghost')?.remove()
  }
}

// Re-export constants for tests
export { KEY_WIDTH, ROW_HEIGHT, STEP_WIDTH }
