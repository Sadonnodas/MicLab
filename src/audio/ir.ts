import { interpAt } from '../solver/ac'

/**
 * Turning H(f) into something the Web Audio ConvolverNode can use.
 *
 * The solver gives a complex response on a 512-point log grid from 5 Hz to
 * 40 kHz. A convolver wants an impulse response. So: interpolate onto a linear
 * FFT grid (magnitude and unwrapped phase separately, because interpolating
 * complex numbers through a phase wrap produces nonsense), inverse-FFT, and
 * taper the tail.
 *
 * The response came out of a real circuit, so it is already causal and
 * minimum-phase-ish — no cepstral tricks needed.
 */

export const IR_SIZE = 65536

/** In-place radix-2 complex FFT. `inverse` scales by 1/n. */
export function fft(re: Float64Array, im: Float64Array, inverse = false): void {
  const n = re.length
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1
    for (; j & bit; bit >>= 1) j ^= bit
    j ^= bit
    if (i < j) {
      let t = re[i]
      re[i] = re[j]
      re[j] = t
      t = im[i]
      im[i] = im[j]
      im[j] = t
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = ((inverse ? 2 : -2) * Math.PI) / len
    const wr = Math.cos(ang)
    const wi = Math.sin(ang)
    for (let i = 0; i < n; i += len) {
      let cr = 1
      let ci = 0
      for (let k = 0; k < len / 2; k++) {
        const ur = re[i + k]
        const ui = im[i + k]
        const vr = re[i + k + len / 2] * cr - im[i + k + len / 2] * ci
        const vi = re[i + k + len / 2] * ci + im[i + k + len / 2] * cr
        re[i + k] = ur + vr
        im[i + k] = ui + vi
        re[i + k + len / 2] = ur - vr
        im[i + k + len / 2] = ui - vi
        const nr = cr * wr - ci * wi
        ci = cr * wi + ci * wr
        cr = nr
      }
    }
  }
  if (inverse) {
    for (let i = 0; i < n; i++) {
      re[i] /= n
      im[i] /= n
    }
  }
}

export interface IrOptions {
  sampleRate: number
  size?: number
}

/**
 * Build an impulse response from the solver's complex H(f).
 * The result is in absolute units: volts out per pascal in.
 */
export function impulseResponse(
  freqs: Float64Array,
  hRe: Float64Array,
  hIm: Float64Array,
  o: IrOptions,
): Float32Array<ArrayBuffer> {
  const n = o.size ?? IR_SIZE
  const half = n / 2
  const df = o.sampleRate / n

  // Magnitude in dB and unwrapped phase, so interpolation behaves.
  const magDb = new Float64Array(freqs.length)
  const phase = new Float64Array(freqs.length)
  let prev = 0
  for (let i = 0; i < freqs.length; i++) {
    magDb[i] = 20 * Math.log10(Math.max(Math.hypot(hRe[i], hIm[i]), 1e-30))
    let p = Math.atan2(hIm[i], hRe[i])
    while (p - prev > Math.PI) p -= 2 * Math.PI
    while (prev - p > Math.PI) p += 2 * Math.PI
    phase[i] = p
    prev = p
  }

  // Below the grid, continue the low end's slope; above it, hold the last value.
  const loSlope =
    (magDb[1] - magDb[0]) / (Math.log(freqs[1]) - Math.log(freqs[0]))

  const re = new Float64Array(n)
  const im = new Float64Array(n)
  for (let k = 1; k < half; k++) {
    const f = k * df
    let db: number
    let ph: number
    if (f < freqs[0]) {
      db = magDb[0] + loSlope * (Math.log(f) - Math.log(freqs[0]))
      ph = phase[0]
    } else if (f > freqs[freqs.length - 1]) {
      db = magDb[freqs.length - 1]
      ph = phase[freqs.length - 1]
    } else {
      db = interpAt(freqs, magDb, f)
      ph = interpAt(freqs, phase, f)
    }
    const mag = Math.pow(10, db / 20)
    re[k] = mag * Math.cos(ph)
    im[k] = mag * Math.sin(ph)
    // Hermitian symmetry gives a real impulse response.
    re[n - k] = re[k]
    im[n - k] = -im[k]
  }
  // DC and Nyquist must be real.
  re[0] = 0
  im[0] = 0
  re[half] = Math.pow(10, magDb[freqs.length - 1] / 20)
  im[half] = 0

  fft(re, im, true)

  const out = new Float32Array(n)
  // Rotate so the (nearly causal) response starts at sample 0 and taper the
  // last 10 % with a half-Hann window to kill circular-convolution wrap-around.
  const taperStart = Math.floor(n * 0.9)
  for (let i = 0; i < n; i++) {
    let w = 1
    if (i >= taperStart) {
      const t = (i - taperStart) / (n - taperStart)
      w = 0.5 * (1 + Math.cos(Math.PI * t))
    }
    out[i] = re[i] * w
  }
  return out
}

/**
 * Zero-phase FIR from a magnitude-only spectrum — used for the noise shaping
 * and the reference-microphone curves, where phase carries no information.
 */
export function magnitudeFir(
  freqs: Float64Array,
  magLinear: Float64Array,
  sampleRate: number,
  taps = 4096,
): Float32Array<ArrayBuffer> {
  const n = taps
  const half = n / 2
  const df = sampleRate / n
  const re = new Float64Array(n)
  const im = new Float64Array(n)
  const magDb = new Float64Array(freqs.length)
  for (let i = 0; i < freqs.length; i++) magDb[i] = 20 * Math.log10(Math.max(magLinear[i], 1e-30))

  for (let k = 0; k <= half; k++) {
    const f = Math.max(k * df, 1e-6)
    const db = f < freqs[0] ? magDb[0] : f > freqs[freqs.length - 1] ? magDb[freqs.length - 1] : interpAt(freqs, magDb, f)
    const mag = Math.pow(10, db / 20)
    re[k] = mag
    im[k] = 0
    if (k > 0 && k < half) {
      re[n - k] = mag
      im[n - k] = 0
    }
  }
  fft(re, im, true)

  // Zero-phase means the impulse is centred at 0 and wraps: rotate it to the
  // middle and window it, which costs half the length in latency and nothing else.
  const out = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    const src = (i + n - half) % n
    const w = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (n - 1))
    out[i] = re[src] * w
  }
  return out
}
