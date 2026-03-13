import { describe, it, expect, vi, beforeEach } from 'vitest'
import { KeySelector } from './KeySelector'
import type { KeySelectorState } from './KeySelector'

function makeContainer(): HTMLElement {
  const div = document.createElement('div')
  document.body.appendChild(div)
  return div
}

function makeKS(initial?: Partial<KeySelectorState>): { ks: KeySelector; container: HTMLElement } {
  const container = makeContainer()
  const ks = new KeySelector(container, {
    root: 'C', scale: 'major', minOctave: 3, maxOctave: 5, ...initial,
  })
  ks.mount()
  return { ks, container }
}

function click(el: Element): void {
  el.dispatchEvent(new Event('click', { bubbles: true }))
}

// ─── Rendering ───────────────────────────────────────────────────────────────

describe('KeySelector rendering', () => {
  it('renders 12 note buttons', () => {
    const { container } = makeKS()
    const btns = container.querySelectorAll('[data-action="set-root"]')
    expect(btns).toHaveLength(12)
  })

  it('marks the initial root as active', () => {
    const { container } = makeKS({ root: 'G' })
    const active = container.querySelector('[data-action="set-root"].active')
    expect((active as HTMLElement).dataset['note']).toBe('G')
  })

  it('marks sharp notes with the "sharp" class', () => {
    const { container } = makeKS()
    const sharps = Array.from(container.querySelectorAll('[data-action="set-root"].sharp'))
    const sharpNotes = sharps.map(b => (b as HTMLElement).dataset['note'])
    expect(sharpNotes).toEqual(['C#', 'D#', 'F#', 'G#', 'A#'])
  })

  it('renders major and minor scale buttons', () => {
    const { container } = makeKS()
    expect(container.querySelector('[data-action="set-scale"][data-scale="major"]')).not.toBeNull()
    expect(container.querySelector('[data-action="set-scale"][data-scale="minor"]')).not.toBeNull()
  })

  it('marks initial scale as active', () => {
    const { container } = makeKS({ scale: 'minor' })
    const active = container.querySelector('[data-action="set-scale"].active')
    expect((active as HTMLElement).dataset['scale']).toBe('minor')
  })

  it('does not render octave number inputs (octave is controlled via setOctaveRange)', () => {
    const { container } = makeKS({ minOctave: 2, maxOctave: 6 })
    expect(container.querySelector('[data-action="set-min-oct"]')).toBeNull()
    expect(container.querySelector('[data-action="set-max-oct"]')).toBeNull()
  })
})

// ─── Root note selection ──────────────────────────────────────────────────────

describe('KeySelector root note', () => {
  it('clicking a note button updates the active class', () => {
    const { container } = makeKS({ root: 'C' })
    const dBtn = container.querySelector<HTMLElement>('[data-note="D"]')!
    click(dBtn)
    expect(dBtn.classList.contains('active')).toBe(true)
    const cBtn = container.querySelector<HTMLElement>('[data-note="C"]')!
    expect(cBtn.classList.contains('active')).toBe(false)
  })

  it('clicking a note updates getState()', () => {
    const { ks, container } = makeKS({ root: 'C' })
    click(container.querySelector<HTMLElement>('[data-note="F#"]')!)
    expect(ks.getState().root).toBe('F#')
  })

  it('calls onChange with updated root', () => {
    const { ks, container } = makeKS()
    const cb = vi.fn()
    ks.setOnChange(cb)
    click(container.querySelector<HTMLElement>('[data-note="A"]')!)
    expect(cb).toHaveBeenCalledOnce()
    expect(cb.mock.calls[0][0].root).toBe('A')
  })
})

// ─── Scale selection ──────────────────────────────────────────────────────────

describe('KeySelector scale', () => {
  it('clicking minor sets it active and deactivates major', () => {
    const { container } = makeKS({ scale: 'major' })
    const minorBtn = container.querySelector<HTMLElement>('[data-scale="minor"]')!
    click(minorBtn)
    expect(minorBtn.classList.contains('active')).toBe(true)
    const majorBtn = container.querySelector<HTMLElement>('[data-scale="major"]')!
    expect(majorBtn.classList.contains('active')).toBe(false)
  })

  it('scale toggle updates getState()', () => {
    const { ks, container } = makeKS({ scale: 'major' })
    click(container.querySelector<HTMLElement>('[data-scale="minor"]')!)
    expect(ks.getState().scale).toBe('minor')
  })

  it('calls onChange with updated scale', () => {
    const { ks, container } = makeKS()
    const cb = vi.fn()
    ks.setOnChange(cb)
    click(container.querySelector<HTMLElement>('[data-scale="minor"]')!)
    expect(cb.mock.calls[0][0].scale).toBe('minor')
  })
})

// ─── Octave range ─────────────────────────────────────────────────────────────

describe('KeySelector octave range', () => {
  it('setOctaveRange updates minOctave and maxOctave', () => {
    const { ks } = makeKS({ minOctave: 3, maxOctave: 5 })
    ks.setOctaveRange(2, 6)
    expect(ks.getState().minOctave).toBe(2)
    expect(ks.getState().maxOctave).toBe(6)
  })

  it('setOctaveRange fires onChange', () => {
    const { ks } = makeKS()
    const cb = vi.fn()
    ks.setOnChange(cb)
    ks.setOctaveRange(2, 6)
    expect(cb).toHaveBeenCalledOnce()
    const state = cb.mock.calls[0][0] as KeySelectorState
    expect(state.minOctave).toBe(2)
    expect(state.maxOctave).toBe(6)
    expect(state.root).toBe('C') // other fields unchanged
  })

  it('setOctaveRange enforces min <= max', () => {
    const { ks } = makeKS()
    ks.setOctaveRange(6, 3) // invalid: min > max
    expect(ks.getState().minOctave).toBe(6)
    expect(ks.getState().maxOctave).toBe(6) // clamped up to min
  })

  it('setOctaveRange clamps to valid range 0–8', () => {
    const { ks } = makeKS()
    ks.setOctaveRange(-1, 99)
    expect(ks.getState().minOctave).toBe(0)
    expect(ks.getState().maxOctave).toBe(8)
  })

  it('getState() returns a copy — mutation does not affect internal state', () => {
    const { ks } = makeKS({ root: 'C' })
    const state = ks.getState() as KeySelectorState
    state.root = 'B'
    expect(ks.getState().root).toBe('C')
  })
})
