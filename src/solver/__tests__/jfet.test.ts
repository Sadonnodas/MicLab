import { describe, expect, it } from 'vitest'
import { NetlistBuilder } from '../netlist'
import { operatingPoint } from '../op'
import { jfetById, jfetEval, jfetParams } from '../jfet'

/**
 * Phase 0 exit criterion §4.8 item 3: the operating point of a textbook
 * common-source stage must match a hand calculation to within 1 %.
 */

/** Self-bias: solve I_d = β(−I_d·R_s − V_p)² by fixed-point iteration. */
function handCalcSelfBias(Idss: number, Vp: number, Rs: number): number {
  const beta = Idss / (Vp * Vp)
  let Id = Idss / 4
  for (let i = 0; i < 500; i++) {
    const vov = -Id * Rs - Vp
    const next = vov <= 0 ? 0 : beta * vov * vov
    Id = Id + 0.2 * (next - Id)
  }
  return Id
}

function csStage(model: string, Rs: number, Rd: number, Vdd: number) {
  const m = jfetById(model)
  const b = new NetlistBuilder()
  b.add({ id: 'Vdd', kind: 'V', nodes: ['vdd', 'gnd'], params: { V: Vdd } })
  b.add({ id: 'Rd', kind: 'R', nodes: ['vdd', 'drn'], params: { R: Rd } })
  b.add({ id: 'Rs', kind: 'R', nodes: ['src', 'gnd'], params: { R: Rs } })
  b.add({ id: 'Rg', kind: 'R', nodes: ['gate', 'gnd'], params: { R: 1e6 } })
  b.add({
    id: 'J',
    kind: 'JFET',
    nodes: ['drn', 'gate', 'src'],
    params: {
      beta: m.Idss / (m.Vp * m.Vp),
      Vp: m.Vp,
      lambda: 0, // hand calculation ignores channel-length modulation
      Cgs: m.Cgs,
      Cgd: m.Cgd,
      Igss: 0,
      KF: m.KF,
    },
  })
  return b.build('drn', 'gnd')
}

describe('JFET operating point', () => {
  it('matches a hand-calculated self-biased common-source stage within 1 %', () => {
    const cases: Array<[string, number, number, number]> = [
      ['2SK170', 1500, 4700, 12],
      ['2N3819', 1000, 4700, 15],
      ['J305', 2200, 6800, 12],
      ['2SK209', 2200, 10000, 10],
    ]
    for (const [model, Rs, Rd, Vdd] of cases) {
      const m = jfetById(model)
      const nl = csStage(model, Rs, Rd, Vdd)
      const op = operatingPoint(nl)
      expect(op.converged, `${model} should converge`).toBe(true)
      const solved = op.ops.J.Id
      const hand = handCalcSelfBias(m.Idss, m.Vp, Rs)
      expect(Math.abs(solved - hand) / hand, `${model} drain current`).toBeLessThan(0.01)
      expect(op.ops.J.region).toBe('sat')
    }
  })

  it('reports pinch-off rather than a wrong answer when the source resistor is absurd', () => {
    const nl = csStage('2SK170', 1e6, 4700, 12)
    const op = operatingPoint(nl)
    expect(op.ops.J.Id).toBeLessThan(1e-6)
  })

  it('gm follows 2β(V_gs − V_p) in saturation', () => {
    const m = jfetById('2SK170')
    const p = jfetParams(m)
    const o = jfetEval(p, -0.2, 8)
    expect(o.region).toBe('sat')
    expect(o.gm).toBeCloseTo(2 * p.beta * (o.Vgs - p.Vp) * (1 + p.lambda * o.Vds), 9)
    // and the derivative really is the derivative
    const h = 1e-7
    const numeric = (jfetEval(p, -0.2 + h, 8).Id - jfetEval(p, -0.2 - h, 8).Id) / (2 * h)
    expect(o.gm).toBeCloseTo(numeric, 5)
  })

  it('crosses smoothly from triode into saturation', () => {
    const p = jfetParams(jfetById('2N3819'))
    const vov = 0.5
    const a = jfetEval(p, p.Vp + vov, vov - 1e-6)
    const b = jfetEval(p, p.Vp + vov, vov + 1e-6)
    expect(a.region).toBe('triode')
    expect(b.region).toBe('sat')
    expect(a.Id).toBeCloseTo(b.Id, 9)
  })
})
