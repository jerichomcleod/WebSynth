import { describe, it, expect } from 'vitest'
import {
  createPattern,
  addNote,
  removeNote,
  resizeNote,
  getNotesAtStep,
  clearPattern,
  totalSteps,
} from './Pattern'
import type { NoteEvent } from '../types'

const C4: NoteEvent = { note: 'C4', midi: 60, frequency: 261.63 }
const D4: NoteEvent = { note: 'D4', midi: 62, frequency: 293.66 }

describe('createPattern', () => {
  it('creates correct bar/step dimensions', () => {
    const p = createPattern(2, 16)
    expect(p.bars).toBe(2)
    expect(p.stepsPerBar).toBe(16)
    expect(p.notes).toHaveLength(0)
  })

  it('starts with no notes', () => {
    expect(createPattern(4, 8).notes).toHaveLength(0)
  })
})

describe('addNote', () => {
  it('adds a note with a unique id', () => {
    const p = addNote(createPattern(1, 8), C4, 0, 2)
    expect(p.notes).toHaveLength(1)
    expect(p.notes[0].note).toEqual(C4)
    expect(p.notes[0].startStep).toBe(0)
    expect(p.notes[0].durationSteps).toBe(2)
    expect(p.notes[0].id).toBeTruthy()
  })

  it('does not mutate the original pattern', () => {
    const original = createPattern(1, 8)
    addNote(original, C4, 0, 1)
    expect(original.notes).toHaveLength(0)
  })

  it('generates distinct ids for each note', () => {
    let p = createPattern(1, 8)
    p = addNote(p, C4, 0, 1)
    p = addNote(p, D4, 2, 1)
    expect(p.notes[0].id).not.toBe(p.notes[1].id)
  })

  it('clamps start step to pattern bounds', () => {
    const p = addNote(createPattern(1, 4), C4, 10, 1)
    expect(p.notes[0].startStep).toBe(3) // total=4, max start = 3
  })

  it('clamps duration so note stays within pattern bounds', () => {
    const p = addNote(createPattern(1, 4), C4, 3, 10)
    expect(p.notes[0].durationSteps).toBe(1) // only 1 step remaining
  })

  it('defaults duration to 1', () => {
    const p = addNote(createPattern(1, 8), C4, 0)
    expect(p.notes[0].durationSteps).toBe(1)
  })
})

describe('removeNote', () => {
  it('removes the note with the given id', () => {
    let p = createPattern(1, 8)
    p = addNote(p, C4, 0, 1)
    const id = p.notes[0].id
    p = removeNote(p, id)
    expect(p.notes).toHaveLength(0)
  })

  it('does not remove other notes', () => {
    let p = createPattern(1, 8)
    p = addNote(p, C4, 0, 1)
    p = addNote(p, D4, 2, 1)
    const id = p.notes[0].id
    p = removeNote(p, id)
    expect(p.notes).toHaveLength(1)
    expect(p.notes[0].note).toEqual(D4)
  })

  it('is a no-op for unknown id', () => {
    let p = addNote(createPattern(1, 8), C4, 0, 1)
    p = removeNote(p, 'nonexistent')
    expect(p.notes).toHaveLength(1)
  })
})

describe('resizeNote', () => {
  it('changes the duration of the target note', () => {
    let p = addNote(createPattern(1, 8), C4, 0, 1)
    const id = p.notes[0].id
    p = resizeNote(p, id, 4)
    expect(p.notes[0].durationSteps).toBe(4)
  })

  it('enforces minimum duration of 1', () => {
    let p = addNote(createPattern(1, 8), C4, 0, 3)
    const id = p.notes[0].id
    p = resizeNote(p, id, 0)
    expect(p.notes[0].durationSteps).toBe(1)
  })

  it('does not mutate the original', () => {
    const p = addNote(createPattern(1, 8), C4, 0, 2)
    const id = p.notes[0].id
    resizeNote(p, id, 5)
    expect(p.notes[0].durationSteps).toBe(2)
  })
})

describe('getNotesAtStep', () => {
  it('returns a note whose range covers the step', () => {
    let p = createPattern(1, 8)
    p = addNote(p, C4, 2, 3) // covers steps 2, 3, 4
    expect(getNotesAtStep(p, 2)).toHaveLength(1)
    expect(getNotesAtStep(p, 3)).toHaveLength(1)
    expect(getNotesAtStep(p, 4)).toHaveLength(1)
  })

  it('does not return a note that ended before this step', () => {
    let p = createPattern(1, 8)
    p = addNote(p, C4, 0, 2) // covers steps 0, 1 only
    expect(getNotesAtStep(p, 2)).toHaveLength(0)
  })

  it('does not return a note that starts after this step', () => {
    let p = createPattern(1, 8)
    p = addNote(p, C4, 4, 2)
    expect(getNotesAtStep(p, 3)).toHaveLength(0)
  })

  it('returns multiple overlapping notes', () => {
    let p = createPattern(1, 8)
    p = addNote(p, C4, 0, 4)
    p = addNote(p, D4, 2, 4)
    expect(getNotesAtStep(p, 3)).toHaveLength(2)
  })
})

describe('clearPattern', () => {
  it('removes all notes', () => {
    let p = createPattern(2, 8)
    p = addNote(p, C4, 0, 1)
    p = addNote(p, D4, 7, 1)
    p = clearPattern(p)
    expect(p.notes).toHaveLength(0)
  })

  it('preserves bar/step dimensions', () => {
    const p = clearPattern(addNote(createPattern(4, 16), C4, 0, 1))
    expect(p.bars).toBe(4)
    expect(p.stepsPerBar).toBe(16)
  })
})

describe('totalSteps', () => {
  it('returns bars × stepsPerBar', () => {
    expect(totalSteps(createPattern(2, 16))).toBe(32)
    expect(totalSteps(createPattern(4, 8))).toBe(32)
    expect(totalSteps(createPattern(1, 32))).toBe(32)
  })
})
