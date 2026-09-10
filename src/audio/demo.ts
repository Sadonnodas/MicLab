/**
 * Built-in demo material.
 *
 * Generated in the browser rather than shipped as files: it keeps the bundle
 * tiny, guarantees the licensing question never comes up, and — more usefully —
 * these are *known* signals, so when the microphone changes them you can hear
 * exactly what changed rather than guessing.
 */

export interface DemoClip {
  id: string
  name: string
  description: string
  seconds: number
  render: (sr: number, out: Float32Array) => void
}

/** Deterministic noise, so a build always sounds the same twice. */
function rng(seed: number) {
  let s = seed >>> 0
  return () => {
    s ^= s << 13
    s ^= s >>> 17
    s ^= s << 5
    return ((s >>> 0) / 0xffffffff) * 2 - 1
  }
}

const adsr = (t: number, dur: number, a = 0.005, r = 0.15) => {
  if (t < a) return t / a
  if (t > dur - r) return Math.max(0, (dur - t) / r)
  return 1
}

/** A plucked-string voice — Karplus–Strong, which really does sound like a guitar. */
function pluck(sr: number, out: Float32Array, start: number, freq: number, dur: number, gain: number, seed: number) {
  const n = Math.round(sr / freq)
  const buf = new Float32Array(n)
  const rand = rng(seed)
  for (let i = 0; i < n; i++) buf[i] = rand()
  const i0 = Math.round(start * sr)
  const len = Math.round(dur * sr)
  let idx = 0
  for (let i = 0; i < len; i++) {
    const next = (idx + 1) % n
    const v = (buf[idx] + buf[next]) * 0.4985
    buf[idx] = v
    idx = next
    const p = i0 + i
    if (p < out.length) out[p] += v * gain * Math.min(1, (len - i) / (0.2 * len))
  }
}

/** A formant-ish voice: a buzzing glottal source through three resonators. */
function speak(sr: number, out: Float32Array, start: number, dur: number, f0: number, formants: number[][], gain: number) {
  const i0 = Math.round(start * sr)
  const len = Math.round(dur * sr)
  const states = formants.map(() => ({ y1: 0, y2: 0 }))
  let phase = 0
  for (let i = 0; i < len; i++) {
    const t = i / sr
    // A falling pitch contour reads as speech far more than a flat one does.
    const f = f0 * (1 - 0.18 * (i / len)) * (1 + 0.02 * Math.sin(2 * Math.PI * 4.5 * t))
    phase += f / sr
    if (phase >= 1) phase -= 1
    // Glottal pulse: sharp enough to have harmonics all the way up.
    const src = Math.exp(-6 * phase) * 2 - 0.35
    let v = 0
    for (let k = 0; k < formants.length; k++) {
      const [ff, bw, amp] = formants[k]
      const r = Math.exp((-Math.PI * bw) / sr)
      const c = 2 * r * Math.cos((2 * Math.PI * ff) / sr)
      const s = states[k]
      const y = src * (1 - r) + c * s.y1 - r * r * s.y2
      s.y2 = s.y1
      s.y1 = y
      v += y * amp
    }
    const p = i0 + i
    if (p < out.length) out[p] += v * gain * adsr(t, dur, 0.02, 0.08)
  }
}

function kick(sr: number, out: Float32Array, start: number, gain: number) {
  const i0 = Math.round(start * sr)
  const len = Math.round(0.35 * sr)
  for (let i = 0; i < len; i++) {
    const t = i / sr
    const f = 55 + 90 * Math.exp(-t * 45)
    const v = Math.sin(2 * Math.PI * f * t) * Math.exp(-t * 11)
    const p = i0 + i
    if (p < out.length) out[p] += v * gain
  }
}

function snare(sr: number, out: Float32Array, start: number, gain: number, seed: number) {
  const i0 = Math.round(start * sr)
  const len = Math.round(0.22 * sr)
  const rand = rng(seed)
  let hp = 0
  let prev = 0
  for (let i = 0; i < len; i++) {
    const t = i / sr
    const n = rand()
    hp = 0.82 * (hp + n - prev)
    prev = n
    const tone = Math.sin(2 * Math.PI * 190 * t) * Math.exp(-t * 30) * 0.5
    const p = i0 + i
    if (p < out.length) out[p] += (hp * Math.exp(-t * 20) + tone) * gain
  }
}

function hat(sr: number, out: Float32Array, start: number, gain: number, decay: number, seed: number) {
  const i0 = Math.round(start * sr)
  const len = Math.round(decay * sr)
  const rand = rng(seed)
  let hp = 0
  let prev = 0
  for (let i = 0; i < len; i++) {
    const t = i / sr
    const n = rand()
    hp = 0.94 * (hp + n - prev)
    prev = n
    const p = i0 + i
    if (p < out.length) out[p] += hp * Math.exp(-t / (decay * 0.28)) * gain
  }
}

export const DEMOS: DemoClip[] = [
  {
    id: 'speech',
    name: 'Speech',
    description:
      'A synthetic voice with three formants and a falling pitch contour. Mid-heavy, with the sibilance energy that makes de-emphasis worth arguing about.',
    seconds: 6,
    render(sr, out) {
      const vowels = [
        [[730, 90, 1], [1090, 110, 0.5], [2440, 140, 0.25]], // "ah"
        [[400, 80, 1], [2000, 100, 0.45], [2550, 140, 0.2]], // "eh"
        [[300, 70, 1], [870, 100, 0.4], [2240, 140, 0.15]], // "oo"
        [[270, 70, 1], [2290, 110, 0.5], [3010, 160, 0.3]], // "ee"
      ]
      let t = 0.15
      for (let i = 0; i < 12; i++) {
        const dur = 0.28 + (i % 3) * 0.12
        speak(sr, out, t, dur, 118 - (i % 4) * 6, vowels[i % vowels.length], 0.5)
        t += dur + (i % 4 === 3 ? 0.28 : 0.06)
      }
    },
  },
  {
    id: 'guitar',
    name: 'Acoustic guitar',
    description:
      'A fingerpicked arpeggio, Karplus–Strong. Strong fundamentals down to 82 Hz and plenty of string noise up top — the low end tells you about polarisation resistors, the top about capsules.',
    seconds: 8,
    render(sr, out) {
      const chords = [
        [82.41, 123.47, 164.81, 196.0, 246.94, 329.63], // Em
        [110.0, 164.81, 220.0, 261.63, 329.63], // Am
        [98.0, 146.83, 196.0, 246.94, 392.0], // G
        [73.42, 110.0, 146.83, 220.0, 293.66], // D
      ]
      let t = 0.05
      for (let c = 0; c < 4; c++) {
        const notes = chords[c]
        for (let i = 0; i < 8; i++) {
          const f = notes[i % notes.length]
          pluck(sr, out, t, f, 1.6, 0.16, 1000 + c * 97 + i * 13)
          t += 0.1 + (i % 2) * 0.02
        }
        t += 0.12
      }
    },
  },
  {
    id: 'drums',
    name: 'Drum loop',
    description:
      'Kick, snare and hats at 96 BPM. Transients and cymbal energy: the clip that makes stray capacitance and transformer bass audible in one bar.',
    seconds: 5,
    render(sr, out) {
      const beat = 60 / 96
      const step = beat / 2
      for (let bar = 0; bar < 2; bar++) {
        const t0 = bar * beat * 4
        kick(sr, out, t0, 0.85)
        kick(sr, out, t0 + beat * 1.5, 0.6)
        kick(sr, out, t0 + beat * 2.5, 0.7)
        snare(sr, out, t0 + beat, 0.5, 7 + bar)
        snare(sr, out, t0 + beat * 3, 0.5, 21 + bar)
        for (let i = 0; i < 8; i++) {
          hat(sr, out, t0 + i * step, i % 2 ? 0.12 : 0.2, i % 4 === 3 ? 0.16 : 0.05, 100 + bar * 8 + i)
        }
      }
    },
  },
  {
    id: 'sweep',
    name: 'Sine sweep',
    description:
      'Twenty hertz to twenty kilohertz in six seconds. Not music, but the fastest way to hear a corner frequency move.',
    seconds: 6,
    render(sr, out) {
      const dur = 6
      const f0 = 20
      const f1 = 20000
      const k = Math.log(f1 / f0)
      for (let i = 0; i < out.length; i++) {
        const t = i / sr
        const phase = ((2 * Math.PI * f0 * dur) / k) * (Math.exp((k * t) / dur) - 1)
        const env = Math.min(1, t / 0.05) * Math.min(1, (dur - t) / 0.3)
        out[i] = Math.sin(phase) * 0.35 * Math.max(env, 0)
      }
    },
  },
]

/** Render a demo clip into an AudioBuffer, scaled so its peak is −6 dBFS. */
export function renderDemo(ctx: BaseAudioContext, clip: DemoClip): AudioBuffer {
  const sr = ctx.sampleRate
  const n = Math.round(clip.seconds * sr)
  const data = new Float32Array(n)
  clip.render(sr, data)
  let peak = 0
  for (let i = 0; i < n; i++) peak = Math.max(peak, Math.abs(data[i]))
  const g = peak > 0 ? 0.5 / peak : 1
  const buf = ctx.createBuffer(1, n, sr)
  const ch = buf.getChannelData(0)
  for (let i = 0; i < n; i++) ch[i] = data[i] * g
  return buf
}
