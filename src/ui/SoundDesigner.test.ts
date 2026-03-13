import { describe, it, expect, vi, beforeEach } from 'vitest'
import { SoundDesigner, DEFAULT_INSTRUMENT_CONFIG, pct, sec } from './SoundDesigner'
import type { InstrumentConfig } from '../types'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeContainer(): HTMLElement {
  const div = document.createElement('div')
  document.body.appendChild(div)
  return div
}

function makeSD(config?: Partial<InstrumentConfig>): SoundDesigner {
  const container = makeContainer()
  const sd = new SoundDesigner(container, {
    ...DEFAULT_INSTRUMENT_CONFIG,
    ...config,
  })
  sd.mount()
  return sd
}

function fire(el: Element, eventType: 'input' | 'change' | 'click', value?: string): void {
  if (value !== undefined && (el as HTMLInputElement).value !== undefined) {
    (el as HTMLInputElement).value = value
  }
  el.dispatchEvent(new Event(eventType, { bubbles: true }))
}

// ─── Formatting helpers ───────────────────────────────────────────────────────

describe('pct', () => {
  it('converts 0–1 to percentage string', () => {
    expect(pct(0)).toBe('0%')
    expect(pct(0.5)).toBe('50%')
    expect(pct(1)).toBe('100%')
    expect(pct(0.756)).toBe('76%')
  })
})

describe('sec', () => {
  it('formats seconds to 2 decimal places', () => {
    expect(sec(0)).toBe('0.00s')
    expect(sec(1)).toBe('1.00s')
    expect(sec(0.125)).toBe('0.13s')
  })
})

// ─── Rendering ───────────────────────────────────────────────────────────────

describe('SoundDesigner rendering', () => {
  it('renders a preview button', () => {
    const sd = makeSD()
    const btn = sd['container'].querySelector('[data-action="preview"]')
    expect(btn).not.toBeNull()
  })

  it('renders one oscillator row by default', () => {
    const sd = makeSD()
    const rows = sd['container'].querySelectorAll('.sd-osc-row')
    expect(rows).toHaveLength(1)
  })

  it('renders oscillator type selector with default "sine"', () => {
    const sd = makeSD()
    const select = sd['container'].querySelector<HTMLSelectElement>('[data-action="osc-type"]')
    expect(select?.value).toBe('sine')
  })

  it('renders ADSR vertical sliders', () => {
    const sd = makeSD()
    for (const param of ['attack', 'decay', 'sustain', 'release']) {
      expect(sd['container'].querySelector(`[data-action="env-range"][data-param="${param}"]`)).not.toBeNull()
    }
  })

  it('renders ADSR number inputs', () => {
    const sd = makeSD()
    for (const param of ['attack', 'decay', 'sustain', 'release']) {
      expect(sd['container'].querySelector(`[data-action="env-num"][data-param="${param}"]`)).not.toBeNull()
    }
  })

  it('hides noise controls when noise is disabled', () => {
    const sd = makeSD()
    const noiseControls = sd['container'].querySelector('.sd-noise-controls')
    expect(noiseControls?.hasAttribute('hidden')).toBe(true)
  })

  it('shows noise controls when noise is enabled initially', () => {
    const sd = makeSD({
      noise: { enabled: true, type: 'white', volume: 0.3 },
    })
    const noiseControls = sd['container'].querySelector('.sd-noise-controls')
    expect(noiseControls?.hasAttribute('hidden')).toBe(false)
  })

  it('renders all four oscillator type options', () => {
    const sd = makeSD()
    const select = sd['container'].querySelector('[data-action="osc-type"]')!
    const options = Array.from(select.querySelectorAll('option')).map((o) => o.value)
    expect(options).toEqual(['sine', 'square', 'sawtooth', 'triangle'])
  })

  it('add-osc button is disabled at max oscillators', () => {
    const sd = makeSD({
      oscillators: [
        { type: 'sine', detune: 0, volume: 1 },
        { type: 'square', detune: 0, volume: 1 },
        { type: 'sawtooth', detune: 0, volume: 1 },
        { type: 'triangle', detune: 0, volume: 1 },
      ],
    })
    const btn = sd['container'].querySelector<HTMLButtonElement>('[data-action="add-osc"]')
    expect(btn?.disabled).toBe(true)
  })
})

// ─── Oscillator management ────────────────────────────────────────────────────

describe('SoundDesigner oscillators', () => {
  it('adds an oscillator row on add-osc click', () => {
    const sd = makeSD()
    const btn = sd['container'].querySelector<HTMLElement>('[data-action="add-osc"]')!
    fire(btn, 'click')
    const rows = sd['container'].querySelectorAll('.sd-osc-row')
    expect(rows).toHaveLength(2)
    expect(sd.getConfig().oscillators).toHaveLength(2)
  })

  it('removes an oscillator row on remove-osc click', () => {
    const sd = makeSD({
      oscillators: [
        { type: 'sine', detune: 0, volume: 0.8 },
        { type: 'square', detune: 5, volume: 0.6 },
      ],
    })
    const removeBtn = sd['container'].querySelector<HTMLElement>('[data-action="remove-osc"]')!
    fire(removeBtn, 'click')
    const rows = sd['container'].querySelectorAll('.sd-osc-row')
    expect(rows).toHaveLength(1)
    expect(sd.getConfig().oscillators).toHaveLength(1)
  })

  it('does not remove the last oscillator', () => {
    const sd = makeSD()
    // No remove button should exist with 1 oscillator
    const removeBtn = sd['container'].querySelector('[data-action="remove-osc"]')
    expect(removeBtn).toBeNull()
  })

  it('does not exceed MAX_OSCILLATORS (4)', () => {
    const sd = makeSD()
    const addBtn = sd['container'].querySelector<HTMLElement>('[data-action="add-osc"]')!
    fire(addBtn, 'click')
    fire(addBtn, 'click')
    fire(addBtn, 'click')
    fire(addBtn, 'click') // 5th attempt, should be ignored
    expect(sd.getConfig().oscillators).toHaveLength(4)
  })

  it('updating osc-type select changes config', () => {
    const sd = makeSD()
    const select = sd['container'].querySelector<HTMLSelectElement>('[data-action="osc-type"]')!
    fire(select, 'change', 'square')
    expect(sd.getConfig().oscillators[0].type).toBe('square')
  })

  it('updating osc-detune slider changes config', () => {
    const sd = makeSD()
    const input = sd['container'].querySelector<HTMLInputElement>('[data-action="osc-detune"]')!
    fire(input, 'input', '25')
    expect(sd.getConfig().oscillators[0].detune).toBe(25)
  })

  it('updating osc-volume slider changes config', () => {
    const sd = makeSD()
    const input = sd['container'].querySelector<HTMLInputElement>('[data-action="osc-volume"]')!
    fire(input, 'input', '0.5')
    expect(sd.getConfig().oscillators[0].volume).toBe(0.5)
  })

  it('detune output label updates on input', () => {
    const sd = makeSD()
    const input = sd['container'].querySelector<HTMLInputElement>('[data-action="osc-detune"]')!
    fire(input, 'input', '12')
    const output = sd['container'].querySelector('[data-for="osc-detune-0"]')
    expect(output?.textContent).toBe('+12¢')
  })
})

// ─── Noise ───────────────────────────────────────────────────────────────────

describe('SoundDesigner noise', () => {
  it('toggling noise-enabled shows noise controls', () => {
    const sd = makeSD()
    const checkbox = sd['container'].querySelector<HTMLInputElement>('[data-action="noise-enabled"]')!
    checkbox.checked = true
    fire(checkbox, 'change')
    const noiseControls = sd['container'].querySelector('.sd-noise-controls')
    expect(noiseControls?.hasAttribute('hidden')).toBe(false)
    expect(sd.getConfig().noise.enabled).toBe(true)
  })

  it('toggling noise off hides controls', () => {
    const sd = makeSD({ noise: { enabled: true, type: 'white', volume: 0.3 } })
    const checkbox = sd['container'].querySelector<HTMLInputElement>('[data-action="noise-enabled"]')!
    checkbox.checked = false
    fire(checkbox, 'change')
    const noiseControls = sd['container'].querySelector('.sd-noise-controls')
    expect(noiseControls?.hasAttribute('hidden')).toBe(true)
    expect(sd.getConfig().noise.enabled).toBe(false)
  })

  it('changing noise type updates config', () => {
    const sd = makeSD({ noise: { enabled: true, type: 'white', volume: 0.3 } })
    const select = sd['container'].querySelector<HTMLSelectElement>('[data-action="noise-type"]')!
    fire(select, 'change', 'pink')
    expect(sd.getConfig().noise.type).toBe('pink')
  })

  it('changing noise volume updates config', () => {
    const sd = makeSD({ noise: { enabled: true, type: 'white', volume: 0.3 } })
    const input = sd['container'].querySelector<HTMLInputElement>('[data-action="noise-volume"]')!
    fire(input, 'input', '0.7')
    expect(sd.getConfig().noise.volume).toBeCloseTo(0.7, 2)
  })
})

// ─── Envelope ────────────────────────────────────────────────────────────────

describe('SoundDesigner envelope', () => {
  it.each([
    ['attack',  '0.5', 0.5],
    ['decay',   '0.3', 0.3],
    ['sustain', '0.6', 0.6],
    ['release', '1.2', 1.2],
  ] as const)('env-range[%s] slider updates config', (param, strVal, numVal) => {
    const sd = makeSD()
    const input = sd['container'].querySelector<HTMLInputElement>(
      `[data-action="env-range"][data-param="${param}"]`,
    )!
    fire(input, 'input', strVal)
    expect(sd.getConfig().envelope[param]).toBeCloseTo(numVal, 3)
  })

  it.each([
    ['attack',  '0.5', 0.5],
    ['decay',   '0.3', 0.3],
    ['sustain', '0.6', 0.6],
    ['release', '1.2', 1.2],
  ] as const)('env-num[%s] number input updates config', (param, strVal, numVal) => {
    const sd = makeSD()
    const input = sd['container'].querySelector<HTMLInputElement>(
      `[data-action="env-num"][data-param="${param}"]`,
    )!
    fire(input, 'input', strVal)
    expect(sd.getConfig().envelope[param]).toBeCloseTo(numVal, 3)
  })

  it('range slider syncs the partner number input', () => {
    const sd = makeSD()
    const range = sd['container'].querySelector<HTMLInputElement>(
      '[data-action="env-range"][data-param="attack"]',
    )!
    fire(range, 'input', '0.75')
    const num = sd['container'].querySelector<HTMLInputElement>(
      '[data-action="env-num"][data-param="attack"]',
    )!
    expect(num.value).toBe('0.75')
  })

  it('number input syncs the partner range slider', () => {
    const sd = makeSD()
    const num = sd['container'].querySelector<HTMLInputElement>(
      '[data-action="env-num"][data-param="release"]',
    )!
    fire(num, 'input', '2.5')
    const range = sd['container'].querySelector<HTMLInputElement>(
      '[data-action="env-range"][data-param="release"]',
    )!
    expect(range.value).toBe('2.5')
  })

  it('number input clamps to max', () => {
    const sd = makeSD()
    const num = sd['container'].querySelector<HTMLInputElement>(
      '[data-action="env-num"][data-param="attack"]',
    )!
    fire(num, 'input', '999')
    expect(sd.getConfig().envelope.attack).toBe(5) // max for attack
  })

  it('number input clamps to min', () => {
    const sd = makeSD()
    const num = sd['container'].querySelector<HTMLInputElement>(
      '[data-action="env-num"][data-param="sustain"]',
    )!
    fire(num, 'input', '-5')
    expect(sd.getConfig().envelope.sustain).toBe(0)
  })
})

// ─── onChange callback ────────────────────────────────────────────────────────

describe('SoundDesigner onChange callback', () => {
  it('fires when oscillator type changes', () => {
    const sd = makeSD()
    const cb = vi.fn()
    sd.setOnConfigChange(cb)
    const select = sd['container'].querySelector<HTMLSelectElement>('[data-action="osc-type"]')!
    fire(select, 'change', 'triangle')
    expect(cb).toHaveBeenCalledOnce()
    expect(cb.mock.calls[0][0].oscillators[0].type).toBe('triangle')
  })

  it('fires when envelope range slider changes', () => {
    const sd = makeSD()
    const cb = vi.fn()
    sd.setOnConfigChange(cb)
    const input = sd['container'].querySelector<HTMLInputElement>(
      '[data-action="env-range"][data-param="release"]',
    )!
    fire(input, 'input', '2.0')
    expect(cb).toHaveBeenCalledOnce()
    expect(cb.mock.calls[0][0].envelope.release).toBeCloseTo(2.0, 2)
  })

  it('fires when envelope number input changes', () => {
    const sd = makeSD()
    const cb = vi.fn()
    sd.setOnConfigChange(cb)
    const input = sd['container'].querySelector<HTMLInputElement>(
      '[data-action="env-num"][data-param="attack"]',
    )!
    fire(input, 'input', '0.5')
    expect(cb).toHaveBeenCalledOnce()
    expect(cb.mock.calls[0][0].envelope.attack).toBeCloseTo(0.5, 3)
  })

  it('fires when oscillator is added', () => {
    const sd = makeSD()
    const cb = vi.fn()
    sd.setOnConfigChange(cb)
    fire(sd['container'].querySelector<HTMLElement>('[data-action="add-osc"]')!, 'click')
    expect(cb).toHaveBeenCalledOnce()
    expect(cb.mock.calls[0][0].oscillators).toHaveLength(2)
  })

  it('fires when oscillator is removed', () => {
    const sd = makeSD({
      oscillators: [
        { type: 'sine', detune: 0, volume: 0.8 },
        { type: 'square', detune: 0, volume: 0.6 },
      ],
    })
    const cb = vi.fn()
    sd.setOnConfigChange(cb)
    fire(sd['container'].querySelector<HTMLElement>('[data-action="remove-osc"]')!, 'click')
    expect(cb).toHaveBeenCalledOnce()
    expect(cb.mock.calls[0][0].oscillators).toHaveLength(1)
  })

  it('getConfig returns a deep copy — mutations do not affect internal state', () => {
    const sd = makeSD()
    const config = sd.getConfig()
    config.oscillators[0].type = 'triangle'
    expect(sd.getConfig().oscillators[0].type).toBe('sine')
  })
})
