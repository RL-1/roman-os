// Tiny synthesised UI sounds: no audio files, nothing plays until the visitor turns sound on.

let ctx: AudioContext | null = null
let master: GainNode | null = null
let hum: OscillatorNode | null = null
let enabled = false

function audio() {
  if (!ctx) {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    ctx = new Ctor()
    master = ctx.createGain()
    master.gain.value = 0.5
    master.connect(ctx.destination)
  }
  if (ctx.state === 'suspended') void ctx.resume()
  return ctx
}

function tone(freq: number, dur: number, { type = 'square' as OscillatorType, gain = 0.035, at = 0, slide = 0 } = {}) {
  if (!enabled) return
  const a = audio()
  const t = a.currentTime + at
  const o = a.createOscillator()
  const g = a.createGain()
  o.type = type
  o.frequency.setValueAtTime(freq, t)
  if (slide) o.frequency.exponentialRampToValueAtTime(freq * slide, t + dur)
  g.gain.setValueAtTime(gain, t)
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  o.connect(g).connect(master!)
  o.start(t)
  o.stop(t + dur + 0.02)
}

function noise(dur: number, gain = 0.05, at = 0, freq = 2400) {
  if (!enabled) return
  const a = audio()
  const t = a.currentTime + at
  const buf = a.createBuffer(1, Math.ceil(a.sampleRate * dur), a.sampleRate)
  const d = buf.getChannelData(0)
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length)
  const src = a.createBufferSource()
  src.buffer = buf
  const f = a.createBiquadFilter()
  f.type = 'bandpass'
  f.frequency.value = freq
  const g = a.createGain()
  g.gain.value = gain
  src.connect(f).connect(g).connect(master!)
  src.start(t)
}

function startHum() {
  if (hum || !enabled) return
  const a = audio()
  const g = a.createGain()
  g.gain.value = 0.012
  hum = a.createOscillator()
  hum.type = 'sawtooth'
  hum.frequency.value = 50
  const f = a.createBiquadFilter()
  f.type = 'lowpass'
  f.frequency.value = 180
  hum.connect(f).connect(g).connect(master!)
  hum.start()
}

export const sound = {
  get on() {
    return enabled
  },
  set(on: boolean) {
    enabled = on
    if (on) {
      startHum()
      tone(1200, 0.05, { at: 0 })
      tone(1800, 0.07, { at: 0.06 })
    } else if (hum) {
      hum.stop()
      hum = null
    }
  },
  click: () => noise(0.025, 0.12, 0, 3200),
  key: () => noise(0.018, 0.08, 0, 4200 + Math.random() * 1200),
  open: () => {
    tone(520, 0.06)
    tone(780, 0.08, { at: 0.06 })
  },
  close: () => {
    tone(700, 0.06)
    tone(420, 0.09, { at: 0.06 })
  },
  error: () => tone(160, 0.18, { type: 'square', gain: 0.04 }),
  button: () => {
    noise(0.012, 0.18, 0, 1800)
    noise(0.02, 0.1, 0.07, 1400)
  },
  powerOff: () => {
    noise(0.03, 0.3, 0, 700)
    tone(9000, 0.9, { type: 'sine', gain: 0.012, slide: 0.4 })
    tone(140, 0.25, { type: 'sine', gain: 0.08, slide: 0.3 })
  },
  powerOn: () => {
    noise(0.03, 0.3, 0, 700)
    noise(0.5, 0.06, 0.05, 5200)
    tone(60, 0.7, { type: 'sine', gain: 0.07, slide: 2.2, at: 0.05 })
    tone(4000, 0.8, { type: 'sine', gain: 0.008, slide: 2, at: 0.1 })
  },
  degauss: () => {
    noise(0.03, 0.25, 0, 600)
    for (let i = 0; i < 6; i++) tone(55 + i * 4, 0.22, { type: 'sawtooth', gain: 0.06 * (1 - i / 7), at: i * 0.16, slide: 1.6 })
  },
  squeak: () => {
    tone(1300, 0.09, { type: 'triangle', gain: 0.05, slide: 1.6 })
    tone(1500, 0.12, { type: 'triangle', gain: 0.05, slide: 1.5, at: 0.12 })
  },
  ring: () => {
    for (let i = 0; i < 14; i++) tone(i % 2 ? 1950 : 2350, 0.06, { type: 'square', gain: 0.03, at: i * 0.07 })
  },
  // games
  step: () => noise(0.01, 0.06, 0, 5200),
  turn: () => tone(880, 0.03, { gain: 0.02 }),
  eat: () => {
    tone(660, 0.05, { gain: 0.03 })
    tone(990, 0.07, { gain: 0.03, at: 0.05 })
  },
  pass: () => tone(1320, 0.04, { gain: 0.02 }),
  lock: () => noise(0.03, 0.12, 0, 900),
  line: (n: number) => {
    for (let i = 0; i < 2 + n; i++) tone(520 * 2 ** (i / 4), 0.07, { gain: 0.03, at: i * 0.06 })
  },
  level: () => {
    for (let i = 0; i < 4; i++) tone(440 * 2 ** (i / 3), 0.08, { gain: 0.03, at: i * 0.08 })
  },
  crash: () => {
    noise(0.45, 0.22, 0, 500)
    tone(220, 0.5, { type: 'sawtooth', gain: 0.05, slide: 0.25 })
  },
  start: () => {
    tone(523, 0.08, { gain: 0.03 })
    tone(659, 0.08, { gain: 0.03, at: 0.09 })
    tone(784, 0.12, { gain: 0.03, at: 0.18 })
  },
  boot: () => {
    noise(0.35, 0.08, 0, 900)
    tone(80, 0.6, { type: 'sine', gain: 0.08, slide: 3 })
  },
}
