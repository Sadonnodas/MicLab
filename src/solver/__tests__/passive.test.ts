import { describe, expect, it } from 'vitest'
import { NetlistBuilder } from '../netlist'
import { MnaIndex, buildAcMatrix } from '../stamps'
import { CVector, luSolve } from '../lu'
import { cAbs } from '../complex'

/**
 * Phase 0 exit criteria, §4.8 items 1–2: the solver must reproduce the
 * closed-form answers for textbook passive networks exactly.
 */

function transferAt(build: (b: NetlistBuilder) => void, outPlus: string, f: number): number {
  const b = new NetlistBuilder()
  b.add({ id: 'src', kind: 'VAC', nodes: ['in', 'gnd'], params: { amplitude: 1, freq: 0 } })
  build(b)
  const nl = b.build(outPlus, 'gnd')
  const ix = new MnaIndex(nl, { dc: false })
  const A = buildAcMatrix(nl, ix, { omega: 2 * Math.PI * f, ops: {}, gmin: 0 })
  const rhs = new CVector(ix.size)
  rhs.add(ix.branchRow('src'), 1)
  const x = luSolve(A, rhs)
  return cAbs(x.get(ix.row(nl.probes.outPlus)))
}

const dB = (x: number) => 20 * Math.log10(x)

describe('RC high-pass', () => {
  const R = 1e9
  const C = 55e-12
  const fc = 1 / (2 * Math.PI * R * C)
  const build = (b: NetlistBuilder) => {
    b.add({ id: 'C', kind: 'C', nodes: ['in', 'out'], params: { C } })
    b.add({ id: 'R', kind: 'R', nodes: ['out', 'gnd'], params: { R } })
  }

  it('is −3.01 dB at the corner', () => {
    expect(dB(transferAt(build, 'out', fc))).toBeCloseTo(-3.0103, 2)
  })

  it('falls at 6 dB per octave below the corner', () => {
    const a = dB(transferAt(build, 'out', fc / 100))
    const b = dB(transferAt(build, 'out', fc / 200))
    expect(a - b).toBeCloseTo(6.0206, 3)
  })

  it('is flat well above the corner', () => {
    expect(dB(transferAt(build, 'out', fc * 1000))).toBeCloseTo(0, 5)
  })
})

describe('RC low-pass', () => {
  const R = 4700
  const C = 470e-12
  const fc = 1 / (2 * Math.PI * R * C)
  const build = (b: NetlistBuilder) => {
    b.add({ id: 'R', kind: 'R', nodes: ['in', 'out'], params: { R } })
    b.add({ id: 'C', kind: 'C', nodes: ['out', 'gnd'], params: { C } })
  }

  it('is −3.01 dB at the corner', () => {
    expect(dB(transferAt(build, 'out', fc))).toBeCloseTo(-3.0103, 2)
  })

  it('falls at 6 dB per octave above the corner', () => {
    const a = dB(transferAt(build, 'out', fc * 100))
    const b = dB(transferAt(build, 'out', fc * 200))
    expect(a - b).toBeCloseTo(6.0206, 3)
  })
})

describe('series LC resonance', () => {
  // A series RLC read across the capacitor peaks at Q = (1/R)·√(L/C).
  const R = 100
  const L = 20e-3
  const C = 100e-9
  const f0 = 1 / (2 * Math.PI * Math.sqrt(L * C))
  const Q = (1 / R) * Math.sqrt(L / C)
  const build = (b: NetlistBuilder) => {
    b.add({ id: 'R', kind: 'R', nodes: ['in', 'a'], params: { R } })
    b.add({ id: 'L', kind: 'L', nodes: ['a', 'out'], params: { L } })
    b.add({ id: 'C', kind: 'C', nodes: ['out', 'gnd'], params: { C } })
  }

  it('resonates at 1/(2π√(LC))', () => {
    const peak = transferAt(build, 'out', f0)
    expect(peak).toBeGreaterThan(transferAt(build, 'out', f0 * 1.05))
    expect(peak).toBeGreaterThan(transferAt(build, 'out', f0 / 1.05))
  })

  it('peaks at Q', () => {
    expect(transferAt(build, 'out', f0)).toBeCloseTo(Q, 3)
  })
})

describe('transformer', () => {
  const Lp = 20
  const n = 7
  const buildXfmr = (load: number) => (b: NetlistBuilder) => {
    b.add({ id: 'Lp', kind: 'L', nodes: ['in', 'gnd'], params: { L: Lp } })
    b.add({ id: 'Ls', kind: 'L', nodes: ['out', 'gnd'], params: { L: Lp / (n * n) } })
    b.add({ id: 'K', kind: 'K', nodes: [], refs: ['Lp', 'Ls'], params: { k: 0.99999999 } })
    b.add({ id: 'RL', kind: 'R', nodes: ['out', 'gnd'], params: { R: load } })
  }

  it('divides the voltage by the turns ratio', () => {
    // Well above the primary's corner, an ideal transformer gives exactly 1/n.
    expect(transferAt(buildXfmr(1500), 'out', 2000)).toBeCloseTo(1 / n, 3)
  })

  it('multiplies the impedance seen from the primary by n²', () => {
    // Driving the primary through a resistor equal to the reflected load
    // (n²·R_load) must halve the voltage: that is what "reflected" means.
    const reflected = 1500 * n * n
    const b = new NetlistBuilder()
    b.add({ id: 'src', kind: 'VAC', nodes: ['src', 'gnd'], params: { amplitude: 1, freq: 0 } })
    b.add({ id: 'Rs', kind: 'R', nodes: ['src', 'in'], params: { R: reflected } })
    buildXfmr(1500)(b)
    const nl = b.build('in', 'gnd')
    const ix = new MnaIndex(nl, { dc: false })
    const A = buildAcMatrix(nl, ix, { omega: 2 * Math.PI * 5000, ops: {}, gmin: 0 })
    const rhs = new CVector(ix.size)
    rhs.add(ix.branchRow('src'), 1)
    const x = luSolve(A, rhs)
    expect(cAbs(x.get(ix.row(nl.probes.outPlus)))).toBeCloseTo(0.5, 2)
  })

  it('rolls the bass off where the primary impedance equals the source impedance', () => {
    const Rsrc = 100
    const fc = Rsrc / (2 * Math.PI * Lp)
    const b = new NetlistBuilder()
    b.add({ id: 'src', kind: 'VAC', nodes: ['src', 'gnd'], params: { amplitude: 1, freq: 0 } })
    b.add({ id: 'Rs', kind: 'R', nodes: ['src', 'in'], params: { R: Rsrc } })
    // Unloaded secondary, so only the primary's own corner shows.
    b.add({ id: 'Lp', kind: 'L', nodes: ['in', 'gnd'], params: { L: Lp } })
    const nl = b.build('in', 'gnd')
    const ix = new MnaIndex(nl, { dc: false })
    const at = (f: number) => {
      const A = buildAcMatrix(nl, ix, { omega: 2 * Math.PI * f, ops: {}, gmin: 0 })
      const rhs = new CVector(ix.size)
      rhs.add(ix.branchRow('src'), 1)
      return cAbs(luSolve(A, rhs).get(ix.row(nl.probes.outPlus)))
    }
    expect(dB(at(fc))).toBeCloseTo(-3.0103, 2)
    expect(fc).toBeCloseTo(0.7958, 3)
  })
})

describe('dependent sources', () => {
  it('gives a VCVS an output impedance that actually loads', () => {
    // 1 V behind 1 kΩ into 1 kΩ must be exactly half a volt. This pins down the
    // sign of the branch impedance stamp, which is otherwise easy to invert.
    const v = transferAt((b) => {
      b.add({ id: 'E', kind: 'VCVS', nodes: ['out', 'gnd', 'in', 'gnd'], params: { gain: 1, Rout: 1000 } })
      b.add({ id: 'RL', kind: 'R', nodes: ['out', 'gnd'], params: { R: 1000 } })
    }, 'out', 1000)
    expect(v).toBeCloseTo(0.5, 9)
  })

  it('applies the gain of a VCCS across its output nodes', () => {
    // 1 mS into 1 kΩ is unity gain, inverted.
    const v = transferAt((b) => {
      b.add({ id: 'G', kind: 'VCCS', nodes: ['out', 'gnd', 'in', 'gnd'], params: { gm: 1e-3 } })
      b.add({ id: 'RL', kind: 'R', nodes: ['out', 'gnd'], params: { R: 1000 } })
    }, 'out', 1000)
    expect(v).toBeCloseTo(1, 9)
  })
})
