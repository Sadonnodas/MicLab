import { describe, expect, it } from 'vitest'
import { analyse } from '../solver/analysis'
import { referenceBuild } from '../data/presets'
import { magnitudeFir } from './ir'
import { aWeight, P_REF } from '../solver/noise'

/**
 * The noise you hear has to be the noise the solver computed.
 *
 * The engine drives a magnitude-only FIR with unit-variance white noise. This
 * test rebuilds that filter exactly as the engine does, measures its response,
 * works out the output noise the combination would actually produce, refers it
 * back through H(f), A-weights it — and requires the answer to match the
 * self-noise figure printed in the UI.
 */

const SR = 48000

function responseAt(fir: Float32Array, f: number, sr: number): number {
  let re = 0
  let im = 0
  const w = (2 * Math.PI * f) / sr
  for (let i = 0; i < fir.length; i++) {
    re += fir[i] * Math.cos(w * i)
    im -= fir[i] * Math.sin(w * i)
  }
  return Math.hypot(re, im)
}

describe('audible noise matches computed noise', () => {
  const result = analyse(referenceBuild())

  // Exactly what MicEngine.updateNoise does.
  const mag = new Float64Array(result.freqs.length)
  for (let i = 0; i < mag.length; i++) mag[i] = Math.sqrt((result.noisePsd[i] * SR) / 2)
  const fir = magnitudeFir(result.freqs, mag, SR, 4096)

  it('reproduces the output noise density at spot frequencies', () => {
    for (const f of [100, 500, 1000, 4000, 10000]) {
      // White noise of unit variance has one-sided PSD 2/sr, so the output
      // density is |G(f)|²·2/sr and should equal the solver's N(f).
      const g = responseAt(fir, f, SR)
      const psd = (g * g * 2) / SR
      const want = interp(result.freqs, result.noisePsd, f)
      expect(Math.abs(10 * Math.log10(psd / want)), `${f} Hz`).toBeLessThan(0.6)
    }
  })

  it('lands within a decibel of the stated self-noise when A-weighted', () => {
    // Integrate the *filter's* output, referred back to the input by H(f).
    let sum = 0
    const n = 600
    const a = Math.log(20)
    const b = Math.log(20000)
    let fPrev = 20
    let vPrev = value(20)
    for (let i = 1; i < n; i++) {
      const f = Math.exp(a + ((b - a) * i) / (n - 1))
      const v = value(f)
      sum += ((v + vPrev) / 2) * (f - fPrev)
      fPrev = f
      vPrev = v
    }
    const dBA = 20 * Math.log10(Math.sqrt(sum) / P_REF)
    expect(Math.abs(dBA - result.selfNoiseDbA), `heard ${dBA.toFixed(2)}, computed ${result.selfNoiseDbA.toFixed(2)}`).toBeLessThan(1)

    function value(f: number): number {
      const g = responseAt(fir, f, SR)
      const psd = (g * g * 2) / SR // V²/Hz at the output
      const h2 = interp(result.freqs, hMag2(result), f) // |H(f)|²
      return (psd / h2) * aWeight(f) ** 2
    }
  })
})

function hMag2(r: ReturnType<typeof analyse>): Float64Array {
  const out = new Float64Array(r.freqs.length)
  for (let i = 0; i < out.length; i++) out[i] = r.hRe[i] ** 2 + r.hIm[i] ** 2
  return out
}

/** Log-frequency linear interpolation on the solver grid. */
function interp(freqs: Float64Array, values: Float64Array, f: number): number {
  if (f <= freqs[0]) return values[0]
  const n = freqs.length
  if (f >= freqs[n - 1]) return values[n - 1]
  let lo = 0
  let hi = n - 1
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1
    if (freqs[mid] > f) hi = mid
    else lo = mid
  }
  const t = (Math.log(f) - Math.log(freqs[lo])) / (Math.log(freqs[hi]) - Math.log(freqs[lo]))
  return values[lo] + t * (values[hi] - values[lo])
}
