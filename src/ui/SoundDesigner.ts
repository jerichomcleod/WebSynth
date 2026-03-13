import type {
  InstrumentConfig,
  OscillatorConfig,
  OscillatorType,
  NoiseType,
  EnvelopeConfig,
  LFOTarget,
} from '../types'
import { Instrument } from '../audio/Instrument'
import { AudioEngine } from '../audio/AudioEngine'

const MAX_OSCILLATORS = 4
const PREVIEW_FREQUENCY = 261.63 // C4
const PREVIEW_DURATION_MS = 600

export const DEFAULT_INSTRUMENT_CONFIG: InstrumentConfig = {
  oscillators: [{ type: 'sine', detune: 0, volume: 0.8 }],
  noise: { enabled: false, type: 'white', volume: 0.3 },
  envelope: { attack: 0.01, decay: 0.1, sustain: 0.7, release: 0.3 },
  filter: {
    lpfEnabled: false, lpfFreq: 2000, lpfResonance: 1,
    hpfEnabled: false, hpfFreq: 80, hpfResonance: 1,
  },
  lfo: { enabled: false, rate: 5, depth: 0.5, target: 'amplitude', shape: 'sine' },
  effects: {
    reverb: { enabled: false, decay: 2, wet: 0.3 },
    delay: { enabled: false, time: 0.25, feedback: 0.3, wet: 0.3 },
    distortion: { enabled: false, amount: 0.3, wet: 0.5 },
  },
}

function deepClone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T
}

// ─── Envelope param metadata ─────────────────────────────────────────────────

interface EnvParam {
  key: keyof EnvelopeConfig
  label: string
  min: number
  max: number
  step: number
  format: (v: number) => string
}

const ENV_PARAMS: EnvParam[] = [
  { key: 'attack',  label: 'A', min: 0, max: 5,  step: 0.001, format: v => `${v.toFixed(2)}s` },
  { key: 'decay',   label: 'D', min: 0, max: 5,  step: 0.001, format: v => `${v.toFixed(2)}s` },
  { key: 'sustain', label: 'S', min: 0, max: 1,  step: 0.01,  format: v => `${Math.round(v * 100)}%` },
  { key: 'release', label: 'R', min: 0, max: 10, step: 0.001, format: v => `${v.toFixed(2)}s` },
]

export class SoundDesigner {
  private container: HTMLElement
  private config: InstrumentConfig
  private onChange?: (config: InstrumentConfig) => void
  private previewing = false

  constructor(
    container: HTMLElement,
    initialConfig: InstrumentConfig = DEFAULT_INSTRUMENT_CONFIG,
  ) {
    this.container = container
    this.config = deepClone(initialConfig)
  }

  setOnConfigChange(cb: (config: InstrumentConfig) => void): void {
    this.onChange = cb
  }

  getConfig(): InstrumentConfig {
    return deepClone(this.config)
  }

  mount(): void {
    this.container.innerHTML = this.buildHTML()
    this.container.addEventListener('click', this.handleClick)
    this.container.addEventListener('change', this.handleChange)
    this.container.addEventListener('input', this.handleInput)
  }

  // ─── Rendering ──────────────────────────────────────────────────────────────

  private buildHTML(): string {
    return `
      <div class="sd-preview-bar">
        <button class="sd-preview-btn" data-action="preview">&#9654; Preview</button>
      </div>
      <div class="sd-section">
        <div class="sd-section-header">
          <span class="sd-section-title">Oscillators</span>
          <button class="sd-add-btn" data-action="add-osc"
            ${this.config.oscillators.length >= MAX_OSCILLATORS ? 'disabled' : ''}>+ Add</button>
        </div>
        <div class="sd-oscillators" data-region="oscillators">
          ${this.buildOscillatorsHTML()}
        </div>
      </div>
      <div class="sd-section">
        <div class="sd-section-header">
          <span class="sd-section-title">Noise</span>
          <label class="sd-inline-label">
            <input type="checkbox" data-action="noise-enabled"
              ${this.config.noise.enabled ? 'checked' : ''} />
            on
          </label>
        </div>
        <div class="sd-noise-controls" ${this.config.noise.enabled ? '' : 'hidden'}>
          ${this.buildNoiseHTML()}
        </div>
      </div>
      <div class="sd-section">
        <div class="sd-section-header">
          <span class="sd-section-title">Envelope</span>
        </div>
        ${this.buildEnvelopeHTML()}
      </div>
      <div class="sd-section">
        <div class="sd-section-header">
          <span class="sd-section-title">Filter</span>
        </div>
        ${this.buildFilterHTML()}
      </div>
      <div class="sd-section">
        <div class="sd-section-header">
          <span class="sd-section-title">LFO</span>
          <label class="sd-inline-label">
            <input type="checkbox" data-action="lfo-enabled"
              ${this.config.lfo.enabled ? 'checked' : ''} />
            on
          </label>
        </div>
        <div class="sd-lfo-controls" ${this.config.lfo.enabled ? '' : 'hidden'}>
          ${this.buildLFOHTML()}
        </div>
      </div>
      <div class="sd-section">
        <div class="sd-section-header">
          <span class="sd-section-title">Effects</span>
        </div>
        ${this.buildEffectsHTML()}
      </div>
    `
  }

  private buildOscillatorsHTML(): string {
    return this.config.oscillators.map((osc, i) => this.buildOscRowHTML(osc, i)).join('')
  }

  private buildOscRowHTML(osc: OscillatorConfig, i: number): string {
    const types: OscillatorType[] = ['sine', 'square', 'sawtooth', 'triangle']
    const canRemove = this.config.oscillators.length > 1
    return `
      <div class="sd-osc-row" data-osc-index="${i}">
        <select data-action="osc-type" data-index="${i}" title="Waveform">
          ${types.map(t => `<option value="${t}" ${osc.type === t ? 'selected' : ''}>${t}</option>`).join('')}
        </select>
        <label class="sd-knob-label">
          <span>Det</span>
          <input type="range" min="-100" max="100" step="1"
            value="${osc.detune}" data-action="osc-detune" data-index="${i}" />
          <output data-for="osc-detune-${i}">${osc.detune > 0 ? '+' : ''}${osc.detune}¢</output>
        </label>
        <label class="sd-knob-label">
          <span>Vol</span>
          <input type="range" min="0" max="1" step="0.01"
            value="${osc.volume}" data-action="osc-volume" data-index="${i}" />
          <output data-for="osc-vol-${i}">${pct(osc.volume)}</output>
        </label>
        ${canRemove
          ? `<button class="sd-remove-btn" data-action="remove-osc" data-index="${i}" title="Remove">✕</button>`
          : '<span class="sd-remove-placeholder"></span>'}
      </div>
    `
  }

  private buildNoiseHTML(): string {
    const { type, volume } = this.config.noise
    return `
      <label class="sd-knob-label">
        <span>Type</span>
        <select data-action="noise-type">
          <option value="white" ${type === 'white' ? 'selected' : ''}>white</option>
          <option value="pink"  ${type === 'pink'  ? 'selected' : ''}>pink</option>
        </select>
      </label>
      <label class="sd-knob-label">
        <span>Vol</span>
        <input type="range" min="0" max="1" step="0.01"
          value="${volume}" data-action="noise-volume" />
        <output data-for="noise-vol">${pct(volume)}</output>
      </label>
    `
  }

  private buildEnvelopeHTML(): string {
    const env = this.config.envelope
    return `
      <div class="sd-envelope">
        ${ENV_PARAMS.map(p => `
          <div class="sd-env-param">
            <span class="sd-env-label">${p.label}</span>
            <input type="range"
              class="sd-env-range"
              min="${p.min}" max="${p.max}" step="${p.step}"
              value="${env[p.key]}"
              data-action="env-range" data-param="${p.key}" />
            <input type="number"
              class="sd-env-number"
              min="${p.min}" max="${p.max}" step="${p.step}"
              value="${env[p.key]}"
              data-action="env-num" data-param="${p.key}" />
          </div>
        `).join('')}
      </div>
    `
  }

  private buildFilterHTML(): string {
    const { filter } = this.config
    return `
      <div class="sd-filter">
        <div class="sd-filter-row">
          <label class="sd-inline-label sd-filter-toggle">
            <input type="checkbox" data-action="lpf-enabled"
              ${filter.lpfEnabled ? 'checked' : ''} />
            LPF
          </label>
          <label class="sd-knob-label">
            <span>Freq</span>
            <input type="range" min="20" max="20000" step="1"
              value="${filter.lpfFreq}" data-action="lpf-freq" />
            <output data-for="lpf-freq">${hz(filter.lpfFreq)}</output>
          </label>
          <label class="sd-knob-label">
            <span>Res</span>
            <input type="range" min="0.1" max="30" step="0.1"
              value="${filter.lpfResonance}" data-action="lpf-res" />
            <output data-for="lpf-res">${filter.lpfResonance.toFixed(1)}</output>
          </label>
        </div>
        <div class="sd-filter-row">
          <label class="sd-inline-label sd-filter-toggle">
            <input type="checkbox" data-action="hpf-enabled"
              ${filter.hpfEnabled ? 'checked' : ''} />
            HPF
          </label>
          <label class="sd-knob-label">
            <span>Freq</span>
            <input type="range" min="20" max="20000" step="1"
              value="${filter.hpfFreq}" data-action="hpf-freq" />
            <output data-for="hpf-freq">${hz(filter.hpfFreq)}</output>
          </label>
          <label class="sd-knob-label">
            <span>Res</span>
            <input type="range" min="0.1" max="30" step="0.1"
              value="${filter.hpfResonance}" data-action="hpf-res" />
            <output data-for="hpf-res">${filter.hpfResonance.toFixed(1)}</output>
          </label>
        </div>
      </div>
    `
  }

  private buildLFOHTML(): string {
    const { lfo } = this.config
    const shapes: OscillatorType[] = ['sine', 'triangle', 'square', 'sawtooth']
    const targets: { value: LFOTarget; label: string }[] = [
      { value: 'amplitude', label: 'Amplitude' },
      { value: 'lpf-freq',  label: 'LPF Freq' },
      { value: 'hpf-freq',  label: 'HPF Freq' },
      { value: 'pitch',     label: 'Pitch' },
    ]
    return `
      <div class="sd-lfo">
        <label class="sd-knob-label">
          <span>Rate</span>
          <input type="range" min="0.1" max="20" step="0.1"
            value="${lfo.rate}" data-action="lfo-rate" />
          <output data-for="lfo-rate">${lfo.rate.toFixed(1)} Hz</output>
        </label>
        <label class="sd-knob-label">
          <span>Depth</span>
          <input type="range" min="0" max="1" step="0.01"
            value="${lfo.depth}" data-action="lfo-depth" />
          <output data-for="lfo-depth">${pct(lfo.depth)}</output>
        </label>
        <label class="sd-knob-label">
          <span>Shape</span>
          <select data-action="lfo-shape">
            ${shapes.map(s => `<option value="${s}" ${lfo.shape === s ? 'selected' : ''}>${s}</option>`).join('')}
          </select>
        </label>
        <label class="sd-knob-label">
          <span>Target</span>
          <select data-action="lfo-target">
            ${targets.map(t => `<option value="${t.value}" ${lfo.target === t.value ? 'selected' : ''}>${t.label}</option>`).join('')}
          </select>
        </label>
      </div>
    `
  }

  private buildEffectsHTML(): string {
    const { effects } = this.config
    return `
      <div class="sd-effects">
        <div class="sd-effect-row">
          <label class="sd-inline-label sd-effect-toggle">
            <input type="checkbox" data-action="reverb-enabled"
              ${effects.reverb.enabled ? 'checked' : ''} />
            Reverb
          </label>
          <div class="sd-effect-params" ${effects.reverb.enabled ? '' : 'hidden'} data-group="reverb">
            <label class="sd-knob-label">
              <span>Decay</span>
              <input type="range" min="0.1" max="10" step="0.1"
                value="${effects.reverb.decay}" data-action="reverb-decay" />
              <output data-for="reverb-decay">${effects.reverb.decay.toFixed(1)}s</output>
            </label>
            <label class="sd-knob-label">
              <span>Wet</span>
              <input type="range" min="0" max="1" step="0.01"
                value="${effects.reverb.wet}" data-action="reverb-wet" />
              <output data-for="reverb-wet">${pct(effects.reverb.wet)}</output>
            </label>
          </div>
        </div>
        <div class="sd-effect-row">
          <label class="sd-inline-label sd-effect-toggle">
            <input type="checkbox" data-action="delay-enabled"
              ${effects.delay.enabled ? 'checked' : ''} />
            Delay
          </label>
          <div class="sd-effect-params" ${effects.delay.enabled ? '' : 'hidden'} data-group="delay">
            <label class="sd-knob-label">
              <span>Time</span>
              <input type="range" min="0.01" max="1" step="0.01"
                value="${effects.delay.time}" data-action="delay-time" />
              <output data-for="delay-time">${effects.delay.time.toFixed(2)}s</output>
            </label>
            <label class="sd-knob-label">
              <span>Fdbk</span>
              <input type="range" min="0" max="0.95" step="0.01"
                value="${effects.delay.feedback}" data-action="delay-feedback" />
              <output data-for="delay-feedback">${pct(effects.delay.feedback)}</output>
            </label>
            <label class="sd-knob-label">
              <span>Wet</span>
              <input type="range" min="0" max="1" step="0.01"
                value="${effects.delay.wet}" data-action="delay-wet" />
              <output data-for="delay-wet">${pct(effects.delay.wet)}</output>
            </label>
          </div>
        </div>
        <div class="sd-effect-row">
          <label class="sd-inline-label sd-effect-toggle">
            <input type="checkbox" data-action="distortion-enabled"
              ${effects.distortion.enabled ? 'checked' : ''} />
            Distortion
          </label>
          <div class="sd-effect-params" ${effects.distortion.enabled ? '' : 'hidden'} data-group="distortion">
            <label class="sd-knob-label">
              <span>Drive</span>
              <input type="range" min="0" max="1" step="0.01"
                value="${effects.distortion.amount}" data-action="distortion-amount" />
              <output data-for="distortion-amount">${pct(effects.distortion.amount)}</output>
            </label>
            <label class="sd-knob-label">
              <span>Wet</span>
              <input type="range" min="0" max="1" step="0.01"
                value="${effects.distortion.wet}" data-action="distortion-wet" />
              <output data-for="distortion-wet">${pct(effects.distortion.wet)}</output>
            </label>
          </div>
        </div>
      </div>
    `
  }

  private reRenderOscillators(): void {
    const region = this.container.querySelector('[data-region="oscillators"]')
    if (region) region.innerHTML = this.buildOscillatorsHTML()
    const addBtn = this.container.querySelector<HTMLButtonElement>('[data-action="add-osc"]')
    if (addBtn) addBtn.disabled = this.config.oscillators.length >= MAX_OSCILLATORS
  }

  // ─── Event handlers ──────────────────────────────────────────────────────────

  private handleClick = (e: Event): void => {
    const target = e.target as HTMLElement
    const action = target.dataset['action']
    if (action === 'preview') {
      void this.playPreview()
    } else if (action === 'add-osc') {
      this.addOscillator()
    } else if (action === 'remove-osc') {
      this.removeOscillator(parseInt(target.dataset['index'] ?? '0', 10))
    }
  }

  private handleChange = (e: Event): void => {
    const target = e.target as HTMLInputElement | HTMLSelectElement
    const action = target.dataset['action']
    const index = parseInt(target.dataset['index'] ?? '0', 10)
    const checked = (target as HTMLInputElement).checked

    if (action === 'osc-type') {
      this.config.oscillators[index].type = target.value as OscillatorType
    } else if (action === 'noise-type') {
      this.config.noise.type = target.value as NoiseType
    } else if (action === 'noise-enabled') {
      this.config.noise.enabled = checked
      this.toggleSection('.sd-noise-controls', checked)
    } else if (action === 'env-num') {
      this.applyEnvParam(target as HTMLInputElement)
    } else if (action === 'lpf-enabled') {
      this.config.filter.lpfEnabled = checked
    } else if (action === 'hpf-enabled') {
      this.config.filter.hpfEnabled = checked
    } else if (action === 'lfo-enabled') {
      this.config.lfo.enabled = checked
      this.toggleSection('.sd-lfo-controls', checked)
    } else if (action === 'lfo-shape') {
      this.config.lfo.shape = target.value as OscillatorType
    } else if (action === 'lfo-target') {
      this.config.lfo.target = target.value as LFOTarget
    } else if (action === 'reverb-enabled') {
      this.config.effects.reverb.enabled = checked
      this.toggleEffectParams('reverb', checked)
    } else if (action === 'delay-enabled') {
      this.config.effects.delay.enabled = checked
      this.toggleEffectParams('delay', checked)
    } else if (action === 'distortion-enabled') {
      this.config.effects.distortion.enabled = checked
      this.toggleEffectParams('distortion', checked)
    }
    this.emit()
  }

  private handleInput = (e: Event): void => {
    const target = e.target as HTMLInputElement
    const action = target.dataset['action']
    const index = parseInt(target.dataset['index'] ?? '0', 10)
    const value = parseFloat(target.value)

    switch (action) {
      case 'osc-detune':
        this.config.oscillators[index].detune = value
        this.setOutput(`osc-detune-${index}`, `${value > 0 ? '+' : ''}${value}¢`)
        break
      case 'osc-volume':
        this.config.oscillators[index].volume = value
        this.setOutput(`osc-vol-${index}`, pct(value))
        break
      case 'noise-volume':
        this.config.noise.volume = value
        this.setOutput('noise-vol', pct(value))
        break
      case 'env-range':
      case 'env-num':
        this.applyEnvParam(target)
        break
      case 'lpf-freq':
        this.config.filter.lpfFreq = value
        this.setOutput('lpf-freq', hz(value))
        break
      case 'lpf-res':
        this.config.filter.lpfResonance = value
        this.setOutput('lpf-res', value.toFixed(1))
        break
      case 'hpf-freq':
        this.config.filter.hpfFreq = value
        this.setOutput('hpf-freq', hz(value))
        break
      case 'hpf-res':
        this.config.filter.hpfResonance = value
        this.setOutput('hpf-res', value.toFixed(1))
        break
      case 'lfo-rate':
        this.config.lfo.rate = value
        this.setOutput('lfo-rate', `${value.toFixed(1)} Hz`)
        break
      case 'lfo-depth':
        this.config.lfo.depth = value
        this.setOutput('lfo-depth', pct(value))
        break
      case 'reverb-decay':
        this.config.effects.reverb.decay = value
        this.setOutput('reverb-decay', `${value.toFixed(1)}s`)
        break
      case 'reverb-wet':
        this.config.effects.reverb.wet = value
        this.setOutput('reverb-wet', pct(value))
        break
      case 'delay-time':
        this.config.effects.delay.time = value
        this.setOutput('delay-time', `${value.toFixed(2)}s`)
        break
      case 'delay-feedback':
        this.config.effects.delay.feedback = value
        this.setOutput('delay-feedback', pct(value))
        break
      case 'delay-wet':
        this.config.effects.delay.wet = value
        this.setOutput('delay-wet', pct(value))
        break
      case 'distortion-amount':
        this.config.effects.distortion.amount = value
        this.setOutput('distortion-amount', pct(value))
        break
      case 'distortion-wet':
        this.config.effects.distortion.wet = value
        this.setOutput('distortion-wet', pct(value))
        break
    }
    this.emit()
  }

  // ─── State mutations ──────────────────────────────────────────────────────────

  private applyEnvParam(input: HTMLInputElement): void {
    const param = input.dataset['param'] as keyof EnvelopeConfig
    const action = input.dataset['action']!
    const p = ENV_PARAMS.find(ep => ep.key === param)
    if (!p) return

    const raw = parseFloat(input.value)
    if (isNaN(raw)) return
    const clamped = Math.max(p.min, Math.min(p.max, raw))

    this.config.envelope[param] = clamped

    // Sync the partner control (range ↔ number)
    const partnerAction = action === 'env-range' ? 'env-num' : 'env-range'
    const partner = this.container.querySelector<HTMLInputElement>(
      `[data-action="${partnerAction}"][data-param="${param}"]`,
    )
    if (partner && partner.value !== String(clamped)) {
      partner.value = String(clamped)
    }
  }

  private addOscillator(): void {
    if (this.config.oscillators.length >= MAX_OSCILLATORS) return
    this.config.oscillators.push({ type: 'sine', detune: 0, volume: 0.8 })
    this.reRenderOscillators()
    this.emit()
  }

  private removeOscillator(index: number): void {
    if (this.config.oscillators.length <= 1) return
    this.config.oscillators.splice(index, 1)
    this.reRenderOscillators()
    this.emit()
  }

  private toggleSection(selector: string, show: boolean): void {
    const el = this.container.querySelector(selector)
    if (el) {
      show ? el.removeAttribute('hidden') : el.setAttribute('hidden', '')
    }
  }

  private toggleEffectParams(group: string, show: boolean): void {
    const el = this.container.querySelector<HTMLElement>(`[data-group="${group}"]`)
    if (el) {
      show ? el.removeAttribute('hidden') : el.setAttribute('hidden', '')
    }
  }

  private async playPreview(): Promise<void> {
    if (this.previewing) return
    this.previewing = true
    const btn = this.container.querySelector<HTMLButtonElement>('[data-action="preview"]')
    if (btn) btn.textContent = '■ Playing…'

    const engine = AudioEngine.getInstance()
    await engine.resume()
    const instrument = new Instrument(engine.context, engine.masterGain, this.config)
    instrument.noteOn(PREVIEW_FREQUENCY)

    setTimeout(() => {
      instrument.noteOff()
      this.previewing = false
      if (btn) btn.textContent = '▶ Preview'
    }, PREVIEW_DURATION_MS)
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────────

  private setOutput(key: string, text: string): void {
    const el = this.container.querySelector(`[data-for="${key}"]`)
    if (el) el.textContent = text
  }

  private emit(): void {
    this.onChange?.(this.getConfig())
  }
}

// ─── Formatting utils (exported for tests) ───────────────────────────────────

export function pct(v: number): string {
  return `${Math.round(v * 100)}%`
}

export function sec(v: number): string {
  return `${v.toFixed(2)}s`
}

export function hz(v: number): string {
  return v >= 1000 ? `${(v / 1000).toFixed(1)}k` : `${Math.round(v)}`
}
