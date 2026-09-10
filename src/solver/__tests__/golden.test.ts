import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { buildCircuit } from '../../stages/build'
import { referenceBuild } from '../../data/presets'
import { MnaIndex, buildAcMatrix } from '../stamps'
import { adjointVector } from '../ac'
import { operatingPoint } from '../op'
import { cAbs } from '../complex'

/**
 * Phase 0 exit criterion §4.8 item 4.
 *
 * `scripts/gen-golden.ts` exports the reference build as an ngspice deck, runs
 * it, and commits the result. This test re-solves the same circuit with our own
 * MNA solver and requires agreement to 0.1 dB across the audio band.
 *
 * The capsule's behavioural source is a plain 1 V AC source on both sides: the
 * mechanical response is a closed-form multiplier and is tested separately, so
 * what is being compared here is the *circuit*.
 */

const golden = readFileSync(join(__dirname, 'golden/ngspice-reference.csv'), 'utf8')
  .trim()
  .split('\n')
  .filter((l) => !l.startsWith('#'))
  .map((l) => l.split(',').map(Number))
  .map(([freq, re, im]) => ({ freq, re, im }))

describe('reference build vs ngspice', () => {
  const built = buildCircuit(referenceBuild())
  const nl = built.netlist
  const op = operatingPoint(nl)
  const ix = new MnaIndex(nl, { dc: false })
  const br = ix.branchRow('capsule.E')

  const ours = (f: number) => {
    const A = buildAcMatrix(nl, ix, { omega: 2 * Math.PI * f, ops: op.ops, gmin: 1e-12 })
    const y = adjointVector(A, ix, nl.probes.outPlus, nl.probes.outMinus)
    return { re: y.re[br], im: y.im[br] }
  }

  it('has a golden file to compare against', () => {
    expect(golden.length).toBeGreaterThan(500)
  })

  it('matches magnitude within 0.1 dB from 20 Hz to 20 kHz', () => {
    let worst = 0
    let worstF = 0
    for (const g of golden) {
      if (g.freq < 20 || g.freq > 20000) continue
      const o = ours(g.freq)
      const d = Math.abs(
        20 * Math.log10(cAbs(o) / Math.max(Math.hypot(g.re, g.im), 1e-30)),
      )
      if (d > worst) {
        worst = d
        worstF = g.freq
      }
    }
    expect(worst, `worst deviation ${worst.toFixed(4)} dB at ${worstF.toFixed(1)} Hz`).toBeLessThan(0.1)
  })

  it('matches phase within one degree from 20 Hz to 20 kHz', () => {
    let worst = 0
    for (const g of golden) {
      if (g.freq < 20 || g.freq > 20000) continue
      const o = ours(g.freq)
      let d = Math.atan2(o.im, o.re) - Math.atan2(g.im, g.re)
      while (d > Math.PI) d -= 2 * Math.PI
      while (d < -Math.PI) d += 2 * Math.PI
      worst = Math.max(worst, Math.abs((d * 180) / Math.PI))
    }
    expect(worst, `worst phase deviation ${worst.toFixed(3)}°`).toBeLessThan(1)
  })

  it('matches across the full 5 Hz – 40 kHz sweep within 0.2 dB', () => {
    let worst = 0
    for (const g of golden) {
      const o = ours(g.freq)
      worst = Math.max(
        worst,
        Math.abs(20 * Math.log10(cAbs(o) / Math.max(Math.hypot(g.re, g.im), 1e-30))),
      )
    }
    expect(worst, `worst deviation ${worst.toFixed(4)} dB`).toBeLessThan(0.2)
  })
})
