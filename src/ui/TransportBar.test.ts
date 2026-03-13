import { describe, it, expect, vi } from 'vitest'
import { TransportBar } from './TransportBar'

function makeContainer(): HTMLElement {
  const div = document.createElement('div')
  document.body.appendChild(div)
  return div
}

function makeTB(opts?: Partial<ConstructorParameters<typeof TransportBar>[1]>): { tb: TransportBar; container: HTMLElement } {
  const container = makeContainer()
  const tb = new TransportBar(container, { bpm: 120, bars: 2, stepsPerBar: 16, ...opts })
  tb.mount()
  return { tb, container }
}

function click(el: Element): void {
  el.dispatchEvent(new MouseEvent('click', { bubbles: true }))
}

function inputVal(el: Element, value: string): void {
  (el as HTMLInputElement).value = value
  el.dispatchEvent(new Event('input', { bubbles: true }))
}

function changeVal(el: Element, value: string): void {
  (el as HTMLSelectElement).value = value
  el.dispatchEvent(new Event('change', { bubbles: true }))
}

// ─── Rendering ───────────────────────────────────────────────────────────────

describe('TransportBar rendering', () => {
  it('renders a play/stop button', () => {
    const { container } = makeTB()
    expect(container.querySelector('[data-action="play-stop"]')).not.toBeNull()
  })

  it('renders BPM input with initial value', () => {
    const { container } = makeTB({ bpm: 140 })
    const input = container.querySelector<HTMLInputElement>('[data-action="bpm"]')!
    expect(input.value).toBe('140')
  })

  it('renders bars selector with initial value', () => {
    const { container } = makeTB({ bars: 4 })
    const select = container.querySelector<HTMLSelectElement>('[data-action="bars"]')!
    expect(select.value).toBe('4')
  })

  it('renders steps selector with initial value', () => {
    const { container } = makeTB({ stepsPerBar: 32 })
    const select = container.querySelector<HTMLSelectElement>('[data-action="steps"]')!
    expect(select.value).toBe('32')
  })

  it('play button shows "▶ Play" when not playing', () => {
    const { container } = makeTB()
    const btn = container.querySelector('[data-action="play-stop"]')!
    expect(btn.textContent?.trim()).toContain('Play')
  })
})

// ─── Play / Stop ─────────────────────────────────────────────────────────────

describe('TransportBar play/stop', () => {
  it('clicking play calls onPlay callback', () => {
    const { tb, container } = makeTB()
    const onPlay = vi.fn()
    tb.setCallbacks({ onPlay })
    click(container.querySelector('[data-action="play-stop"]')!)
    expect(onPlay).toHaveBeenCalledOnce()
  })

  it('clicking stop (when playing) calls onStop callback', () => {
    const { tb, container } = makeTB()
    const onStop = vi.fn()
    tb.setCallbacks({ onStop })
    tb.setPlaying(true)
    click(container.querySelector('[data-action="play-stop"]')!)
    expect(onStop).toHaveBeenCalledOnce()
  })

  it('setPlaying(true) updates button text to Stop', () => {
    const { tb, container } = makeTB()
    tb.setPlaying(true)
    const btn = container.querySelector('[data-action="play-stop"]')!
    expect(btn.textContent?.trim()).toContain('Stop')
  })

  it('setPlaying(false) updates button text to Play', () => {
    const { tb, container } = makeTB()
    tb.setPlaying(true)
    tb.setPlaying(false)
    expect(container.querySelector('[data-action="play-stop"]')!.textContent?.trim()).toContain('Play')
  })

  it('setPlaying(true) adds active class to button', () => {
    const { tb, container } = makeTB()
    tb.setPlaying(true)
    expect(container.querySelector('[data-action="play-stop"]')!.classList.contains('active')).toBe(true)
  })
})

// ─── BPM ─────────────────────────────────────────────────────────────────────

describe('TransportBar BPM', () => {
  it('changing BPM input calls onBpmChange', () => {
    const { tb, container } = makeTB()
    const cb = vi.fn()
    tb.setCallbacks({ onBpmChange: cb })
    inputVal(container.querySelector('[data-action="bpm"]')!, '160')
    expect(cb).toHaveBeenCalledWith(160)
  })

  it('BPM is clamped to 40–240', () => {
    const { tb, container } = makeTB()
    const cb = vi.fn()
    tb.setCallbacks({ onBpmChange: cb })
    inputVal(container.querySelector('[data-action="bpm"]')!, '999')
    expect(cb).toHaveBeenCalledWith(240)
    cb.mockReset()
    inputVal(container.querySelector('[data-action="bpm"]')!, '1')
    expect(cb).toHaveBeenCalledWith(40)
  })

  it('getOptions() reflects current BPM', () => {
    const { tb, container } = makeTB({ bpm: 120 })
    inputVal(container.querySelector('[data-action="bpm"]')!, '180')
    expect(tb.getOptions().bpm).toBe(180)
  })
})

// ─── Bars and Steps ───────────────────────────────────────────────────────────

describe('TransportBar bars/steps', () => {
  it('changing bars select calls onBarsChange', () => {
    const { tb, container } = makeTB()
    const cb = vi.fn()
    tb.setCallbacks({ onBarsChange: cb })
    changeVal(container.querySelector('[data-action="bars"]')!, '4')
    expect(cb).toHaveBeenCalledWith(4)
  })

  it('changing steps select calls onStepsChange', () => {
    const { tb, container } = makeTB()
    const cb = vi.fn()
    tb.setCallbacks({ onStepsChange: cb })
    changeVal(container.querySelector('[data-action="steps"]')!, '32')
    expect(cb).toHaveBeenCalledWith(32)
  })

  it('getOptions() reflects current bars and steps after change', () => {
    const { tb, container } = makeTB({ bars: 2, stepsPerBar: 16 })
    changeVal(container.querySelector('[data-action="bars"]')!, '8')
    changeVal(container.querySelector('[data-action="steps"]')!, '8')
    expect(tb.getOptions().bars).toBe(8)
    expect(tb.getOptions().stepsPerBar).toBe(8)
  })
})
