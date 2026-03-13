/**
 * Minimal Web Audio API mocks for Vitest/jsdom.
 * Only mocks the nodes and methods used by our modules.
 */

export function createGainNodeMock() {
  return {
    gain: {
      value: 0.0001,
      setValueAtTime: vi.fn(),
      linearRampToValueAtTime: vi.fn(),
      exponentialRampToValueAtTime: vi.fn(),
      cancelScheduledValues: vi.fn(),
      cancelAndHoldAtTime: vi.fn(),
    },
    connect: vi.fn(),
    disconnect: vi.fn(),
  }
}

export function createOscillatorNodeMock() {
  return {
    type: 'sine' as OscillatorType,
    frequency: { setValueAtTime: vi.fn() },
    detune: { setValueAtTime: vi.fn() },
    connect: vi.fn(),
    disconnect: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
  }
}

export function createBufferSourceMock() {
  return {
    buffer: null as AudioBuffer | null,
    loop: false,
    connect: vi.fn(),
    disconnect: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
  }
}

export function createAudioBufferMock(sampleRate = 44100, length = 2 * 44100) {
  const data = new Float32Array(length)
  return {
    sampleRate,
    length,
    duration: length / sampleRate,
    numberOfChannels: 1,
    getChannelData: vi.fn().mockReturnValue(data),
  }
}

export function createDynamicsCompressorMock() {
  return {
    threshold: { value: 0 },
    knee: { value: 0 },
    ratio: { value: 0 },
    attack: { value: 0 },
    release: { value: 0 },
    connect: vi.fn(),
    disconnect: vi.fn(),
  }
}

export function createAudioContextMock() {
  const gainNode = createGainNodeMock()
  const oscillatorNode = createOscillatorNodeMock()
  const bufferSource = createBufferSourceMock()
  const audioBuffer = createAudioBufferMock()
  const compressor = createDynamicsCompressorMock()

  return {
    state: 'running' as AudioContextState,
    currentTime: 0,
    sampleRate: 44100,
    destination: { connect: vi.fn() },
    createGain: vi.fn().mockReturnValue(gainNode),
    createOscillator: vi.fn().mockReturnValue(oscillatorNode),
    createBufferSource: vi.fn().mockReturnValue(bufferSource),
    createBuffer: vi.fn().mockReturnValue(audioBuffer),
    createDynamicsCompressor: vi.fn().mockReturnValue(compressor),
    resume: vi.fn().mockResolvedValue(undefined),
    suspend: vi.fn().mockResolvedValue(undefined),
    // Expose inner mocks for assertions
    _gainNode: gainNode,
    _oscillatorNode: oscillatorNode,
    _bufferSource: bufferSource,
    _compressor: compressor,
  }
}

/** Install AudioContext mock on globalThis before each test suite. */
export function installAudioContextMock() {
  let ctx: ReturnType<typeof createAudioContextMock>

  beforeEach(() => {
    ctx = createAudioContextMock()
    // Must use a regular function (not arrow) so `new` works correctly
    vi.stubGlobal('AudioContext', function AudioContextMock() { return ctx })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  return { getCtx: () => ctx }
}
