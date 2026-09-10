import { describe, expect, it } from 'vitest'
import { fft, impulseResponse, magnitudeFir, IR_SIZE } from './ir'
import { frequencyGrid } from '../solver/ac'

/**
 * §5.3: an impulse response built from a single RC high-pass, re-analysed by
 * FFT, must match the analytic curve within 0.2 dB down to 10 Hz.
 */

const SR = 48000

/** Magnitude response of an impulse response at a given frequency, by DFT. */
function responseAt(ir: Float32Array, f: number, sr: number): number {
  let re = 0
  let im = 0
  const w = (2 * Math.PI * f) / sr
  for (let i = 0; i < ir.length; i++) {
    re += ir[i] * Math.cos(w * i)
    im -= ir[i] * Math.sin(w * i)
  }
  return Math.hypot(re, im)
}

describe('FFT', () => {
  it('round-trips', () => {
    const n = 256
    const re = new Float64Array(n)
    const im = new Float64Array(n)
    const orig = new Float64Array(n)
    for (let i = 0; i < n; i++) orig[i] = re[i] = Math.sin(i * 0.3) + Math.cos(i * 1.7)
    fft(re, im)
    fft(re, im, true)
    for (let i = 0; i < n; i++) expect(re[i]).toBeCloseTo(orig[i], 9)
  })
})

describe('impulse response from H(f)', () => {
  const fc = 2.9 // a realistic polarisation corner
  const freqs = frequencyGrid(512)
  const hRe = new Float64Array(freqs.length)
  const hIm = new Float64Array(freqs.length)
  for (let i = 0; i < freqs.length; i++) {
    // H = jf/fc / (1 + jf/fc)
    const x = freqs[i] / fc
    const dRe = 1
    const dIm = x
    const d = dRe * dRe + dIm * dIm
    hRe[i] = (x * dIm) / d
    hIm[i] = (x * dRe) / d
  }
  const ir = impulseResponse(freqs, hRe, hIm, { sampleRate: SR })

  it('is the requested length', () => {
    expect(ir.length).toBe(IR_SIZE)
  })

  it('matches the analytic high-pass within 0.2 dB down to 10 Hz', () => {
    let worst = 0
    let worstF = 0
    for (const f of [10, 15, 20, 30, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 15000]) {
      const analytic = (f / fc) / Math.hypot(1, f / fc)
      const measured = responseAt(ir, f, SR)
      const d = Math.abs(20 * Math.log10(measured / analytic))
      if (d > worst) {
        worst = d
        worstF = f
      }
    }
    expect(worst, `worst ${worst.toFixed(3)} dB at ${worstF} Hz`).toBeLessThan(0.2)
  })

  it('preserves absolute level — the point of normalize = false', () => {
    // A flat unity response must come back as unity, not as something normalised.
    const flatRe = new Float64Array(freqs.length).fill(1)
    const flatIm = new Float64Array(freqs.length)
    const flat = impulseResponse(freqs, flatRe, flatIm, { sampleRate: SR, size: 8192 })
    expect(responseAt(flat, 1000, SR)).toBeCloseTo(1, 2)
    // ...and a response of 0.1 comes back as 0.1.
    const quietRe = new Float64Array(freqs.length).fill(0.1)
    const quiet = impulseResponse(freqs, quietRe, flatIm, { sampleRate: SR, size: 8192 })
    expect(responseAt(quiet, 1000, SR)).toBeCloseTo(0.1, 3)
  })
})

describe('magnitude-only FIR', () => {
  it('reproduces a flat magnitude', () => {
    const freqs = frequencyGrid(256)
    const mag = new Float64Array(freqs.length).fill(0.25)
    const fir = magnitudeFir(freqs, mag, SR, 2048)
    for (const f of [100, 1000, 5000, 10000]) {
      expect(responseAt(fir, f, SR)).toBeCloseTo(0.25, 2)
    }
  })

  it('reproduces a shaped magnitude within half a decibel', () => {
    const freqs = frequencyGrid(256)
    const mag = new Float64Array(freqs.length)
    for (let i = 0; i < freqs.length; i++) mag[i] = 1 / Math.hypot(1, freqs[i] / 2000)
    const fir = magnitudeFir(freqs, mag, SR, 4096)
    for (const f of [200, 1000, 2000, 6000, 12000]) {
      const want = 1 / Math.hypot(1, f / 2000)
      const got = responseAt(fir, f, SR)
      expect(Math.abs(20 * Math.log10(got / want)), `${f} Hz`).toBeLessThan(0.5)
    }
  })
})
