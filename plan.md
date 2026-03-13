# WebSynth — Implementation Plan

## Overview

A browser-based synthesizer and step sequencer built on the Web Audio API. Users can design sounds, play notes in a selected key, and compose sequences — then export the result as audio.

---

## Tech Stack

- **Frontend**: Vanilla TypeScript + Vite (no framework overhead needed for an audio app)
- **Styling**: CSS Modules or plain CSS with CSS custom properties
- **Audio**: Web Audio API (native browser)
- **Export**: `MediaRecorder` API → WebM/WAV download
- **Build**: Vite
- **Testing**: Vitest (unit), manual browser testing for audio

---

## Architecture

```
src/
  audio/
    AudioEngine.ts       # AudioContext lifecycle, master gain, routing
    Oscillator.ts        # Tone generator (sine/square/sawtooth/triangle)
    NoiseGenerator.ts    # White/pink noise via AudioBuffer
    Envelope.ts          # ADSR implementation
    Instrument.ts        # Combines oscillators + envelope into a playable voice
    Exporter.ts          # MediaRecorder-based audio export
  sequencer/
    Sequencer.ts         # Step sequencer clock (ScriptProcessor or AudioWorklet)
    Pattern.ts           # Bar/step data model
    KeyHelper.ts         # Scale/key filtering, octave ranges
  ui/
    SoundDesigner.ts     # ADSR + oscillator controls
    KeySelector.ts       # Key/scale + octave range picker
    PianoRoll.ts         # In-key note display
    StepGrid.ts          # Step sequencer grid UI
    TransportBar.ts      # Play/stop/BPM/export controls
  main.ts                # App entry point, wires modules together
  types.ts               # Shared TypeScript interfaces
index.html
```

---

## Phases

### Phase 1 — Project Scaffold ✅
- [x] Init Vite + TypeScript project (manual scaffold — `create-vite` requires interactive TTY)
- [x] Set up folder structure above
- [x] Configure `tsconfig.json`, add `vitest`
- [x] Create `index.html` shell with layout regions (sound panel, key panel, sequencer)

### Phase 2 — Audio Engine Core ✅
> Completed during Phase 1 scaffold — all modules were built and tested together.
- [x] `AudioEngine`: singleton wrapping `AudioContext`, master gain node, start/suspend
- [x] `Oscillator`: wraps `OscillatorNode`, supports type switching (sine/square/sawtooth/triangle)
- [x] `NoiseGenerator`: white/pink noise via `AudioBufferSourceNode` with looped random buffer
- [x] `Envelope`: ADSR applied to a `GainNode` — attack, decay, sustain, release params
- [x] `Instrument`: composes 1–4 oscillators + optional noise + envelope into a single voice; exposes `noteOn(freq)` / `noteOff()`

### Phase 3 — Sound Designer UI ✅
- [x] Oscillator section: add/remove oscillators (up to 4), type selector, detune/volume per oscillator
- [x] Noise section: toggle, noise type selector (white/pink), noise volume
- [x] ADSR section: sliders for attack (0–2s), decay (0–2s), sustain (0–1), release (0–4s) with live output labels
- [x] Live preview: click-to-play C4 for 600 ms using current config; button state reflects playback

### Phase 4 — Key & Note Selection ✅
- [x] `Enhancements`: ADSR sliders are now vertical (CSS `writing-mode: vertical-lr`) with enlarged touch targets; each param has a paired editable `<input type="number">` that syncs bidirectionally with the slider; minimum attack/release enforced to eliminate pops; switched to exponential ramps (`exponentialRampToValueAtTime`) and `cancelAndHoldAtTime` for click-free note transitions.
- [x] `KeyHelper`: scale interval maps for major/minor; `getScaleNotes()` returns in-key `NoteEvent[]` for a given root, scale, and octave range (implemented in Phase 1)
- [x] `KeySelector` UI: 12 root note buttons (natural/sharp styled), major/minor toggle, min/max octave number inputs with mutual clamping; emits `onChange` on every interaction
- [x] `PianoRoll` UI: horizontally scrollable, grouped by octave; sharp keys visually distinct; `pointerdown` plays note via callback; `setNotes()` safe to call before or after `mount()`

### Phase 5 — Piano Roll Editor ✅
- [x] `Pattern`: rewritten as sparse `PlacedNote[]` model — each note has `id`, `note`, `startStep`, `durationSteps`; all mutations return new objects
- [x] `Pattern` API: `addNote`, `removeNote`, `resizeNote`, `getNotesAtStep`, `clearPattern`, `totalSteps`
- [x] `Sequencer`: Web Audio clock with `setTimeout` + `AudioContext.currentTime` lookahead; `StepCallback` receives `scheduledTime` for drift-free audio scheduling; `getNotesAtStep` used in callback — notes trigger only on their `startStep`, play for their `durationSteps`
- [x] `PianoRollEditor` UI: vertical piano keys (sticky left column, high→low) + scrollable grid; drag empty space to place a note with variable duration; click placed note to delete; drag resize handle to change duration; ghost note shown during drag; `advancePlayhead()` / `clearPlayhead()` for real-time visual feedback
- [x] Controls: bars (1/2/4/8), steps per bar (8/16/32), BPM (40–240) in `TransportBar`
- [x] `TransportBar`: play/stop button with state, BPM input, bars/steps selects; all wired to `Sequencer` via callbacks
- [x] **Envelope minimums**: `MIN_DECAY_S = 5ms`, `MIN_RELEASE_S = 10ms` for pop-free note boundaries
- [x] **Pop fix**: `SynthOscillator` and `NoiseGenerator` defer `disconnect()` to `onended` event

### Phase 6 — Audio Export ✅
- [x] `Exporter`: `MediaRecorder` on `AudioEngine.getDestinationStream()` (post-compressor stream); records one full loop; `.webm` download
- [x] `Render`: Export button in TransportBar — plays sequence for exactly one full loop duration (+ 3s release tail), then auto-stops and offers download
- [ ] Stretch: offline render via `OfflineAudioContext` for lossless WAV export

### Phase 7 — Polish
- [x] `Update controls`: ADSR max ranges expanded to industry standards (attack/decay 0–5s, release 0–10s); existing minimum floors (3ms attack, 5ms decay, 10ms release) prevent pops
- [x] `New controls`: Low-pass filter (freq + resonance Q) and high-pass filter (freq + resonance Q) added to SoundDesigner with enable toggles
- [x] `LFO`: Rate (0.1–20 Hz), Depth, Shape (sine/triangle/square/sawtooth), Target (Amplitude / LPF Freq / HPF Freq / Pitch) — enabled per-note via OscillatorNode
- [x] `Effects`: Reverb (synthetic IR, decay + wet), Delay (time + feedback + wet), Distortion (WaveShaper drive + wet) — shared EffectsChain bus in main.ts
- [x] Keyboard shortcuts: Spacebar = play/stop (ignored when focus is on input elements)
- [x] Note end: `noteOff` triggered at full `durationSecs` (not 0.9× hack); release plays out naturally after note length; oscillators stop only when gain reaches true silence
- [ ] Preset save/load (localStorage JSON)
- [ ] Responsive layout adjustments
- [ ] Accessibility: ARIA labels on all controls

---

## Key Decisions

| Decision | Choice | Reason |
|---|---|---|
| Framework | None (Vanilla TS) | Audio apps benefit from direct DOM control; no vDOM overhead on audio thread |
| Bundler | Vite | Fast HMR, native ESM, zero config TS |
| Scheduling | AudioContext clock + setTimeout lookahead | Standard Web Audio scheduling pattern; avoids drift |
| Export | MediaRecorder | No extra dependencies; widely supported |
| State | In-memory objects | No server, no persistence needed beyond localStorage presets |

---

## Out of Scope (v1)

- MIDI input/output
- Effects chain (reverb, delay, filter)
- Polyphony beyond basic chord play
- Collaboration / cloud save
