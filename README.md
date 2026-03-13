# WebSynth

A browser-based synthesizer and step sequencer built entirely on the Web Audio API — no external audio dependencies.

## Features

- **Sound Designer** — up to 4 oscillators (sine, square, sawtooth, triangle) with detune and per-oscillator volume; white/pink noise generator; ADSR envelope
- **Key & Note Selection** — choose a root note and major/minor scale to filter the piano keys
- **Piano Roll Editor** — vertical piano keys aligned with a scrollable grid; drag to place notes with variable duration; click notes to delete; resize notes by dragging their right edge; real-time playhead marker
- **Audio Export** — record and download your sequence as a WebM audio file

## Getting Started

```bash
npm install
npm run dev       # start dev server at http://localhost:5173
npm run build     # production build → dist/
npm test          # run tests once
npm run test:watch  # watch mode
```

## Tech Stack

| Tool | Purpose |
|------|---------|
| [Vite](https://vite.dev) | Dev server & bundler |
| TypeScript | Type safety |
| Web Audio API | All audio synthesis and scheduling |
| [Vitest](https://vitest.dev) | Unit testing |

## Project Structure

```
src/
  audio/          # AudioEngine, Oscillator, Envelope, NoiseGenerator, Instrument, Exporter
  sequencer/      # Sequencer clock, Pattern data model (PlacedNote), KeyHelper (scales/frequencies)
  ui/             # UI components (SoundDesigner, KeySelector, PianoRollEditor, TransportBar)
  types.ts        # Shared TypeScript interfaces
  main.ts         # App entry point
index.html
```

## Implementation Status

- [x] Phase 1 — Project scaffold, config, folder structure, types, stub modules
- [x] Phase 2 — Audio engine core (AudioEngine, Oscillator, Envelope, NoiseGenerator, Instrument)
- [x] Phase 3 — Sound Designer UI (oscillators, noise, ADSR, live preview)
- [x] Phase 4 — Key & Note Selection UI + ADSR enhancements (vertical sliders, editable values, pop fix)
- [x] Phase 5 — Piano Roll Editor (vertical keys + drag-to-place grid, variable note duration, playhead, drift-free scheduling)
- [ ] Phase 6 — Audio Export
- [ ] Phase 7 — Polish (keyboard shortcuts, presets, accessibility)

**Tests:** 155 passing across 9 test files

## License

ISC
