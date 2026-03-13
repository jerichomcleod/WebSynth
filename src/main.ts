import { AudioEngine } from './audio/AudioEngine'
import { EffectsChain } from './audio/EffectsChain'
import { Exporter } from './audio/Exporter'
import { Instrument } from './audio/Instrument'
import { getScaleNotes } from './sequencer/KeyHelper'
import { createPattern, getNotesAtStep } from './sequencer/Pattern'
import { Sequencer } from './sequencer/Sequencer'
import { SoundDesigner, DEFAULT_INSTRUMENT_CONFIG } from './ui/SoundDesigner'
import { KeySelector } from './ui/KeySelector'
import { PianoRollEditor } from './ui/PianoRollEditor'
import { TransportBar } from './ui/TransportBar'
import type { InstrumentConfig, Pattern } from './types'

function mount() {
  const engine = AudioEngine.getInstance()

  // ─── Shared state ──────────────────────────────────────────────────────────
  let instrumentConfig: InstrumentConfig = { ...DEFAULT_INSTRUMENT_CONFIG }
  let pattern: Pattern = createPattern(2, 16)
  let minOctave = 3
  let maxOctave = 5

  // ─── Effects chain (sits between instruments and masterGain) ───────────────
  const effectsChain = new EffectsChain(
    engine.context,
    instrumentConfig.effects,
    engine.masterGain,
  )

  // ─── Sound Designer ────────────────────────────────────────────────────────
  const soundDesigner = new SoundDesigner(
    document.getElementById('sound-designer-content')!,
    instrumentConfig,
  )
  soundDesigner.setOnConfigChange(cfg => {
    instrumentConfig = cfg
    effectsChain.applyConfig(cfg.effects)
  })

  // ─── Key Selector ─────────────────────────────────────────────────────────
  const keySelector = new KeySelector(document.getElementById('key-selector-container')!)

  // ─── Piano Roll Editor ────────────────────────────────────────────────────
  const editor = new PianoRollEditor(document.getElementById('piano-roll-editor')!)

  function refreshNotes() {
    const { root, scale } = keySelector.getState()
    editor.setNotes(getScaleNotes(root, scale, minOctave, maxOctave))
  }

  editor.setOnNotePreview(note => {
    void engine.resume().then(() => {
      // Preview bypasses effects chain (direct to masterGain)
      const inst = new Instrument(engine.context, engine.masterGain, instrumentConfig)
      inst.noteOn(note.frequency)
      setTimeout(() => inst.noteOff(), 500)
    })
  })
  editor.setOnPatternChange(p => {
    pattern = p
    sequencer.setPattern(p)
  })
  editor.setOnOctaveUp(() => {
    if (maxOctave < 8) { maxOctave++; keySelector.setOctaveRange(minOctave, maxOctave); refreshNotes() }
  })
  editor.setOnOctaveDown(() => {
    if (minOctave > 0) { minOctave--; keySelector.setOctaveRange(minOctave, maxOctave); refreshNotes() }
  })
  editor.onOctaveShrinkTop = () => {
    if (maxOctave > minOctave) { maxOctave--; keySelector.setOctaveRange(minOctave, maxOctave); refreshNotes() }
  }
  editor.onOctaveShrinkBot = () => {
    if (minOctave < maxOctave) { minOctave++; keySelector.setOctaveRange(minOctave, maxOctave); refreshNotes() }
  }

  keySelector.setOnChange(() => { refreshNotes() })

  // ─── Sequencer ────────────────────────────────────────────────────────────
  const sequencer = new Sequencer(engine.context, pattern, (bar, step, scheduledTime) => {
    const msUntilStep = (scheduledTime - engine.context.currentTime) * 1000
    setTimeout(() => editor.advancePlayhead(bar, step), Math.max(0, msUntilStep))

    const absoluteStep = bar * pattern.stepsPerBar + step
    const activeNotes = getNotesAtStep(pattern, absoluteStep)

    for (const pn of activeNotes) {
      if (pn.startStep !== absoluteStep) continue
      // Full duration: attack+decay occur during note-on, sustain fills
      // remaining time, release triggers at noteOff. Oscillators keep
      // playing through the release until gain reaches true silence.
      const durationSecs = pn.durationSteps * sequencer.stepDuration
      const inst = new Instrument(engine.context, effectsChain.input, instrumentConfig)
      inst.noteOn(pn.note.frequency, scheduledTime)
      inst.noteOff(scheduledTime + durationSecs)
    }
  })

  // ─── Export ───────────────────────────────────────────────────────────────
  const exporter = new Exporter()

  function startExport(): void {
    void engine.resume().then(() => {
      // Total duration = one full loop
      const { bars, stepsPerBar } = pattern
      const loopDurationMs = bars * stepsPerBar * sequencer.stepDuration * 1000
      // Small buffer for release tails
      const tailMs = 3000

      const stream = engine.getDestinationStream()
      exporter.startRecording(stream)
      transportBar.setExporting(true)

      sequencer.start()
      transportBar.setPlaying(true)

      setTimeout(() => {
        sequencer.stop()
        editor.clearPlayhead()
        transportBar.setPlaying(false)

        void exporter.stopRecording().then(blob => {
          exporter.download(blob)
          transportBar.setExporting(false)
        })
      }, loopDurationMs + tailMs)
    })
  }

  // ─── Transport Bar ────────────────────────────────────────────────────────
  const transportBar = new TransportBar(
    document.getElementById('transport-container')!,
    { bpm: 120, bars: 2, stepsPerBar: 16 },
  )
  transportBar.setCallbacks({
    onPlay: () => {
      void engine.resume().then(() => {
        sequencer.start()
        transportBar.setPlaying(true)
      })
    },
    onStop: () => {
      sequencer.stop()
      editor.clearPlayhead()
      transportBar.setPlaying(false)
    },
    onBpmChange: bpm => sequencer.setBpm(bpm),
    onBarsChange: bars => {
      pattern = createPattern(bars, transportBar.getOptions().stepsPerBar)
      editor.setPattern(pattern)
      sequencer.setPattern(pattern)
    },
    onStepsChange: stepsPerBar => {
      pattern = createPattern(transportBar.getOptions().bars, stepsPerBar)
      editor.setPattern(pattern)
      sequencer.setPattern(pattern)
    },
    onExport: startExport,
  })

  // ─── Keyboard shortcuts ───────────────────────────────────────────────────
  document.addEventListener('keydown', (e: KeyboardEvent) => {
    // Ignore when typing in an input
    const tag = (e.target as HTMLElement).tagName
    if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return

    if (e.code === 'Space') {
      e.preventDefault()
      if (sequencer.isPlaying) {
        sequencer.stop()
        editor.clearPlayhead()
        transportBar.setPlaying(false)
      } else {
        void engine.resume().then(() => {
          sequencer.start()
          transportBar.setPlaying(true)
        })
      }
    }
  })

  // ─── Mount ────────────────────────────────────────────────────────────────
  soundDesigner.mount()
  keySelector.mount()
  editor.mount()
  transportBar.mount()

  refreshNotes()
  editor.setPattern(pattern)
}

mount()
