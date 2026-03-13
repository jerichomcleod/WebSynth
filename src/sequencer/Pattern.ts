import type { Pattern, PlacedNote, NoteEvent } from '../types'

let _idCounter = 0

function genId(): string {
  return `n${++_idCounter}_${Date.now()}`
}

export function createPattern(bars: number, stepsPerBar: number): Pattern {
  return { bars, stepsPerBar, notes: [] }
}

export function addNote(
  pattern: Pattern,
  note: NoteEvent,
  startStep: number,
  durationSteps: number = 1,
): Pattern {
  const total = totalSteps(pattern)
  const clampedStart = Math.max(0, Math.min(startStep, total - 1))
  const clampedDuration = Math.max(1, Math.min(durationSteps, total - clampedStart))
  const placed: PlacedNote = {
    id: genId(),
    note,
    startStep: clampedStart,
    durationSteps: clampedDuration,
  }
  return { ...pattern, notes: [...pattern.notes, placed] }
}

export function removeNote(pattern: Pattern, id: string): Pattern {
  return { ...pattern, notes: pattern.notes.filter(n => n.id !== id) }
}

export function resizeNote(pattern: Pattern, id: string, durationSteps: number): Pattern {
  return {
    ...pattern,
    notes: pattern.notes.map(n =>
      n.id === id ? { ...n, durationSteps: Math.max(1, durationSteps) } : n,
    ),
  }
}

/** Returns notes whose duration covers the given absolute step index. */
export function getNotesAtStep(pattern: Pattern, absoluteStep: number): PlacedNote[] {
  return pattern.notes.filter(
    n => absoluteStep >= n.startStep && absoluteStep < n.startStep + n.durationSteps,
  )
}

export function clearPattern(pattern: Pattern): Pattern {
  return { ...pattern, notes: [] }
}

export function totalSteps(pattern: Pattern): number {
  return pattern.bars * pattern.stepsPerBar
}
