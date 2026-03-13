import { describe, it, expect } from 'vitest'
import {
  midiToFrequency,
  noteToMidi,
  getScaleNotes,
  NOTE_NAMES,
} from './KeyHelper'

describe('midiToFrequency', () => {
  it('returns 440 Hz for MIDI 69 (A4)', () => {
    expect(midiToFrequency(69)).toBeCloseTo(440, 2)
  })

  it('returns 261.63 Hz for MIDI 60 (C4)', () => {
    expect(midiToFrequency(60)).toBeCloseTo(261.63, 1)
  })

  it('doubles frequency per octave', () => {
    const a4 = midiToFrequency(69)
    const a5 = midiToFrequency(81)
    expect(a5).toBeCloseTo(a4 * 2, 4)
  })
})

describe('noteToMidi', () => {
  it('C4 = 60', () => {
    expect(noteToMidi('C', 4)).toBe(60)
  })

  it('A4 = 69', () => {
    expect(noteToMidi('A', 4)).toBe(69)
  })

  it('C5 = 72', () => {
    expect(noteToMidi('C', 5)).toBe(72)
  })

  it('B3 = 59', () => {
    expect(noteToMidi('B', 3)).toBe(59)
  })
})

describe('getScaleNotes', () => {
  it('returns 7 notes per octave for a single octave range', () => {
    const notes = getScaleNotes('C', 'major', 4, 4)
    expect(notes).toHaveLength(7)
  })

  it('returns correct note names for C major', () => {
    const notes = getScaleNotes('C', 'major', 4, 4)
    const names = notes.map((n) => n.note)
    expect(names).toEqual(['C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'B4'])
  })

  it('returns correct note names for A minor', () => {
    const notes = getScaleNotes('A', 'minor', 4, 4)
    const names = notes.map((n) => n.note)
    expect(names).toEqual(['A4', 'B4', 'C5', 'D5', 'E5', 'F5', 'G5'])
  })

  it('spans multiple octaves', () => {
    const notes = getScaleNotes('C', 'major', 3, 4)
    // 7 notes per octave × 2 octaves = 14
    expect(notes).toHaveLength(14)
  })

  it('each note has a valid midi and frequency', () => {
    const notes = getScaleNotes('C', 'major', 4, 4)
    for (const n of notes) {
      expect(n.midi).toBeGreaterThan(0)
      expect(n.frequency).toBeGreaterThan(0)
    }
  })

  it('notes are in ascending pitch order', () => {
    const notes = getScaleNotes('C', 'major', 3, 5)
    for (let i = 1; i < notes.length; i++) {
      expect(notes[i].midi).toBeGreaterThan(notes[i - 1].midi)
    }
  })

  it('includes sharps for non-C roots (D major)', () => {
    const notes = getScaleNotes('D', 'major', 4, 4)
    const names = notes.map((n) => n.note)
    // D major has F# and C#
    expect(names).toContain('F#4')
    expect(names).toContain('C#5')
  })
})
