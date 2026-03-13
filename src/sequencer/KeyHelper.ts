import type { NoteName, ScaleType, NoteEvent } from '../types'

export const NOTE_NAMES: NoteName[] = [
  'C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B',
]

// Intervals (semitones from root) for each scale type
const SCALE_INTERVALS: Record<ScaleType, number[]> = {
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10],
}

/** Convert a MIDI note number to frequency in Hz. */
export function midiToFrequency(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12)
}

/** Convert note name + octave to MIDI number. C4 = 60. */
export function noteToMidi(name: NoteName, octave: number): number {
  return NOTE_NAMES.indexOf(name) + (octave + 1) * 12
}

/**
 * Returns all in-key NoteEvents for the given root, scale, and octave range.
 * Octave range is inclusive: e.g. minOctave=2, maxOctave=5 → C2 to B5.
 */
export function getScaleNotes(
  root: NoteName,
  scale: ScaleType,
  minOctave: number,
  maxOctave: number,
): NoteEvent[] {
  const intervals = SCALE_INTERVALS[scale]
  const rootIndex = NOTE_NAMES.indexOf(root)
  const events: NoteEvent[] = []

  for (let octave = minOctave; octave <= maxOctave; octave++) {
    for (const interval of intervals) {
      const semitone = rootIndex + interval
      const noteIndex = semitone % 12
      const octaveShift = Math.floor(semitone / 12)
      const actualOctave = octave + octaveShift

      const name = NOTE_NAMES[noteIndex]
      const midi = noteToMidi(name, actualOctave)
      events.push({
        note: `${name}${actualOctave}`,
        midi,
        frequency: midiToFrequency(midi),
      })
    }
  }

  return events
}
