import { describe, it, expect, vi } from 'vitest'
import { PianoRollEditor } from './PianoRollEditor'
import { createPattern, addNote } from '../sequencer/Pattern'
import type { NoteEvent, Pattern } from '../types'

const C4: NoteEvent = { note: 'C4', midi: 60, frequency: 261.63 }
const E4: NoteEvent = { note: 'E4', midi: 64, frequency: 329.63 }
const G4: NoteEvent = { note: 'G4', midi: 67, frequency: 392.0 }

const SCALE_NOTES = [C4, E4, G4]

function makeContainer(): HTMLElement {
  const div = document.createElement('div')
  document.body.appendChild(div)
  return div
}

function makePRE(pattern?: Pattern, notes?: NoteEvent[]): {
  pre: PianoRollEditor
  container: HTMLElement
} {
  const container = makeContainer()
  const pre = new PianoRollEditor(container)
  pre.mount()
  if (notes) pre.setNotes(notes)
  if (pattern) pre.setPattern(pattern)
  return { pre, container }
}

function pointerDown(el: Element, opts: Partial<PointerEventInit> = {}): void {
  el.dispatchEvent(
    new PointerEvent('pointerdown', { bubbles: true, ...opts }),
  )
}

function pointerUp(el: Element, opts: Partial<PointerEventInit> = {}): void {
  el.dispatchEvent(
    new PointerEvent('pointerup', { bubbles: true, ...opts }),
  )
}

// ─── Rendering ───────────────────────────────────────────────────────────────

describe('PianoRollEditor rendering', () => {
  it('renders keys column after setNotes', () => {
    const { container } = makePRE(undefined, SCALE_NOTES)
    const keyRows = container.querySelectorAll('.pre-key-row')
    // sorted descending: G4, E4, C4
    expect(keyRows).toHaveLength(3)
  })

  it('renders keys in descending pitch order', () => {
    const { container } = makePRE(undefined, SCALE_NOTES)
    const labels = Array.from(container.querySelectorAll('.pre-key-label')).map(
      el => el.textContent?.trim(),
    )
    expect(labels[0]).toBe('G4')  // highest first
    expect(labels[2]).toBe('C4')  // lowest last
  })

  it('renders no notes when pattern has none', () => {
    const { container } = makePRE(createPattern(1, 8), SCALE_NOTES)
    expect(container.querySelectorAll('.pre-note')).toHaveLength(0)
  })

  it('renders placed notes', () => {
    let p = createPattern(1, 8)
    p = addNote(p, C4, 0, 2)
    p = addNote(p, G4, 4, 1)
    const { container } = makePRE(p, SCALE_NOTES)
    expect(container.querySelectorAll('.pre-note')).toHaveLength(2)
  })

  it('note width reflects duration in steps', () => {
    let p = createPattern(1, 8)
    p = addNote(p, C4, 0, 4)
    const { container } = makePRE(p, SCALE_NOTES)
    const note = container.querySelector<HTMLElement>('.pre-note')!
    // 4 steps × 28px = 112px
    expect(note.style.width).toBe('112px')
  })

  it('shows empty message when no scale notes set', () => {
    const { container } = makePRE()
    expect(container.querySelector('.pre-empty')).not.toBeNull()
  })

  it('re-renders notes when setPattern is called again', () => {
    const { pre, container } = makePRE(createPattern(1, 8), SCALE_NOTES)
    expect(container.querySelectorAll('.pre-note')).toHaveLength(0)
    let p = createPattern(1, 8)
    p = addNote(p, C4, 0, 1)
    pre.setPattern(p)
    expect(container.querySelectorAll('.pre-note')).toHaveLength(1)
  })
})

// ─── Key preview ─────────────────────────────────────────────────────────────

describe('PianoRollEditor key preview', () => {
  it('clicking a key fires onNotePreview with the correct note', () => {
    const { pre, container } = makePRE(createPattern(1, 8), SCALE_NOTES)
    const cb = vi.fn()
    pre.setOnNotePreview(cb)
    const g4Key = container.querySelector<HTMLElement>('[data-midi="67"]')!
    pointerDown(g4Key)
    expect(cb).toHaveBeenCalledWith(G4)
  })

  it('clicking a non-key area does not fire onNotePreview', () => {
    const { pre, container } = makePRE(createPattern(1, 8), SCALE_NOTES)
    const cb = vi.fn()
    pre.setOnNotePreview(cb)
    pointerDown(container.querySelector('.pre-keys')!)
    expect(cb).not.toHaveBeenCalled()
  })
})

// ─── Note placement ──────────────────────────────────────────────────────────

describe('PianoRollEditor note placement', () => {
  it('placing a note fires onPatternChange with the new note', () => {
    const { pre, container } = makePRE(createPattern(1, 8), SCALE_NOTES)
    const cb = vi.fn()
    pre.setOnPatternChange(cb)

    const gridScroll = container.querySelector<HTMLElement>('[data-region="grid-scroll"]')!
    // Simulate click at row=2 (C4 - lowest = index 2), col=0
    pointerDown(gridScroll, { clientX: 5, clientY: 49 })  // row 2: y=44+..
    pointerUp(gridScroll, { clientX: 5, clientY: 49 })
    expect(cb).toHaveBeenCalledOnce()
    const updated: Pattern = cb.mock.calls[0][0]
    expect(updated.notes).toHaveLength(1)
  })

  it('clicking an existing note deletes it', () => {
    let p = createPattern(1, 8)
    p = addNote(p, C4, 0, 1)
    const { pre, container } = makePRE(p, SCALE_NOTES)
    const cb = vi.fn()
    pre.setOnPatternChange(cb)

    const noteEl = container.querySelector<HTMLElement>('.pre-note')!
    pointerDown(noteEl)
    expect(cb).toHaveBeenCalledOnce()
    const updated: Pattern = cb.mock.calls[0][0]
    expect(updated.notes).toHaveLength(0)
  })
})

// ─── Octave buttons ──────────────────────────────────────────────────────────

describe('PianoRollEditor octave buttons', () => {
  it('clicking oct-up button fires onOctaveUp callback', () => {
    const { pre, container } = makePRE(createPattern(1, 8), SCALE_NOTES)
    const cb = vi.fn()
    pre.setOnOctaveUp(cb)
    const btn = container.querySelector<HTMLElement>('[data-action="oct-up"]')!
    btn.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(cb).toHaveBeenCalledOnce()
  })

  it('clicking oct-down button fires onOctaveDown callback', () => {
    const { pre, container } = makePRE(createPattern(1, 8), SCALE_NOTES)
    const cb = vi.fn()
    pre.setOnOctaveDown(cb)
    const btn = container.querySelector<HTMLElement>('[data-action="oct-down"]')!
    btn.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(cb).toHaveBeenCalledOnce()
  })

  it('clicking oct-shrink-top fires onOctaveShrinkTop callback', () => {
    const { pre, container } = makePRE(createPattern(1, 8), SCALE_NOTES)
    const cb = vi.fn()
    pre.onOctaveShrinkTop = cb
    const btn = container.querySelector<HTMLElement>('[data-action="oct-shrink-top"]')!
    btn.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(cb).toHaveBeenCalledOnce()
  })
})

// ─── Playhead ─────────────────────────────────────────────────────────────────

describe('PianoRollEditor playhead', () => {
  it('advancePlayhead makes the playhead visible', () => {
    const { pre, container } = makePRE(createPattern(2, 8), SCALE_NOTES)
    pre.advancePlayhead(0, 0)
    const ph = container.querySelector<HTMLElement>('[data-region="playhead"]')!
    expect(ph.style.display).not.toBe('none')
  })

  it('clearPlayhead hides the playhead', () => {
    const { pre, container } = makePRE(createPattern(2, 8), SCALE_NOTES)
    pre.advancePlayhead(0, 3)
    pre.clearPlayhead()
    const ph = container.querySelector<HTMLElement>('[data-region="playhead"]')!
    expect(ph.style.display).toBe('none')
  })

  it('advancePlayhead positions correctly for bar 1 step 4', () => {
    const { pre, container } = makePRE(createPattern(2, 8), SCALE_NOTES)
    pre.advancePlayhead(1, 4)
    const ph = container.querySelector<HTMLElement>('[data-region="playhead"]')!
    // bar=1, step=4 → absoluteStep=12, x=12*28=336px
    expect(ph.style.transform).toBe('translateX(336px)')
  })
})
