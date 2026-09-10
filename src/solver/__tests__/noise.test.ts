import { describe, expect, it } from 'vitest'
import { analyse } from '../analysis'
import { referenceBuild, presetById } from '../../data/presets'
import { aWeight, aWeightedBandwidth, integrateDbA, P_REF } from '../noise'
import { frequencyGrid } from '../ac'

describe('A-weighting', () => {
  it('is 0 dB at 1 kHz', () => {
    expect(20 * Math.log10(aWeight(1000))).toBeCloseTo(0, 3)
  })

  // IEC 61672 table values, at the exact one-third-octave band centres
  // (10^(n/10)) rather than the rounded nominal frequencies.
  const table: Array<[number, number]> = [
    [Math.pow(10, 1.5), -39.4],
    [Math.pow(10, 1.8), -26.2],
    [Math.pow(10, 2.1), -16.1],
    [Math.pow(10, 2.4), -8.6],
    [Math.pow(10, 2.7), -3.2],
    [1000, 0],
    [Math.pow(10, 3.3), 1.2],
    [Math.pow(10, 3.6), 1.0],
    [Math.pow(10, 3.9), -1.1],
    [Math.pow(10, 4.2), -6.6],
  ]
  it.each(table)('matches the standard at %f Hz', (f, expected) => {
    expect(20 * Math.log10(aWeight(f))).toBeCloseTo(expected, 1)
  })

  it('integrates a flat 20 µPa/√Hz source to its own bandwidth', () => {
    const freqs = frequencyGrid(2048)
    const psd = new Float64Array(freqs.length).fill(P_REF * P_REF)
    const level = integrateDbA(freqs, psd)
    expect(level).toBeCloseTo(10 * Math.log10(aWeightedBandwidth()), 1)
  })
})

describe('self-noise of the reference build', () => {
  const r = analyse(referenceBuild())

  it('lands between 8 and 14 dB-A', () => {
    expect(r.selfNoiseDbA).toBeGreaterThan(8)
    expect(r.selfNoiseDbA).toBeLessThan(14)
  })

  it('is dominated by the capsule, not the FET', () => {
    expect(r.noiseBreakdown[0].kind).toBe('capsule')
    const fet = r.noiseBreakdown.find((b) => b.kind === 'fet-channel')!
    expect(fet.dBA).toBeLessThan(r.noiseBreakdown[0].dBA - 6)
  })

  it('lands between 2 and 8 dB-A with the capsule silenced', () => {
    // §4.8 item 5. The spec's estimate was 2–6 dB-A; two 1 GΩ resistors on a
    // 55 pF capsule actually come out at a little over 7, which is where the
    // solver and a hand calculation agree. See docs/NOTES.md.
    const spec = referenceBuild()
    spec.capsule.values.Nac = 0
    const q = analyse(spec)
    expect(q.selfNoiseDbA).toBeGreaterThan(2)
    expect(q.selfNoiseDbA).toBeLessThan(8)
  })

  it('gets noisier and thinner when the polarisation resistor drops to 100 MΩ', () => {
    const spec = referenceBuild()
    spec.polarisation.values.R_pol = 100e6
    const q = analyse(spec)
    expect(q.selfNoiseDbA).toBeGreaterThan(r.selfNoiseDbA + 2)
    // The corner moves from about 3 Hz to about 15 Hz, so the difference shows
    // at 10 Hz rather than at 30, where both are still essentially flat.
    const iLow = q.freqs.findIndex((f) => f >= 10)
    expect(q.mag[iLow]).toBeLessThan(r.mag[iLow] - 1)
  })

  it('shows the polarisation resistor taking over at 100 MΩ', () => {
    const spec = referenceBuild()
    spec.polarisation.values.R_pol = 100e6
    const q = analyse(spec)
    expect(q.noiseBreakdown[0].kind).toBe('R_pol')
  })
})

describe('self-noise across the presets', () => {
  it('puts a small electret capsule well above a large-diaphragm build', () => {
    const big = analyse(presetById('bluejay')!.build)
    const small = analyse(presetById('sdc-electret')!.build)
    expect(small.selfNoiseDbA).toBeGreaterThan(big.selfNoiseDbA + 4)
    expect(small.selfNoiseDbA).toBeLessThan(26)
  })

  it('keeps every shipped preset in a plausible range', () => {
    for (const id of ['bluejay', 'raven', 'sdc-electret', 'textbook-u87', 'textbook-schoeps']) {
      const r = analyse(presetById(id)!.build)
      expect(r.op.converged, `${id} bias`).toBe(true)
      expect(r.selfNoiseDbA, `${id} self-noise`).toBeGreaterThan(0)
      expect(r.selfNoiseDbA, `${id} self-noise`).toBeLessThan(30)
    }
  })
})

describe('performance', () => {
  it('completes a full sweep plus noise analysis quickly', () => {
    const t0 = performance.now()
    analyse(referenceBuild())
    const ms = performance.now() - t0
    // Informational per §4.8 item 6, but a 10x regression should still fail.
    expect(ms).toBeLessThan(1000)
    console.log(`  full analysis: ${ms.toFixed(1)} ms`)
  })
})
