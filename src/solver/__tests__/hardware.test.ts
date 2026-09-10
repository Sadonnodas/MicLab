import { describe, expect, it } from 'vitest'
import { analyse } from '../analysis'
import { presetById } from '../../data/presets'
import { PHANTOM_MAX_CURRENT, PHANTOM_SOURCE_OHMS, PHANTOM_VOLTS, supplyReport } from '../hardware'
import { JFET_MODELS } from '../jfet'

/**
 * These checks are the difference between a teaching toy and something somebody
 * might build. They are about hardware surviving, not about sound.
 */

const bluejay = () => structuredClone(presetById('bluejay')!.build)

describe('JFET model parameters', () => {
  it('derives Cgs from the datasheet figures rather than using Ciss directly', () => {
    // Ciss is measured with the drain shorted to the source, so Ciss = Cgs + Cgd.
    // Getting this wrong over-states how much the FET loads the capsule.
    for (const m of JFET_MODELS) {
      expect(m.Cgs + m.Cgd, m.name).toBeCloseTo(m.Ciss, 15)
      expect(m.Cgd, m.name).toBeCloseTo(m.Crss, 15)
    }
  })

  it('keeps every typical inside its own datasheet spread', () => {
    for (const m of JFET_MODELS) {
      expect(m.Idss, `${m.name} Idss`).toBeGreaterThanOrEqual(m.IdssRange[0])
      expect(m.Idss, `${m.name} Idss`).toBeLessThanOrEqual(m.IdssRange[1])
      expect(m.Vp, `${m.name} Vp`).toBeLessThanOrEqual(m.VpRange[0])
      expect(m.Vp, `${m.name} Vp`).toBeGreaterThanOrEqual(m.VpRange[1])
    }
  })
})

describe('phantom power budget', () => {
  it('reports every shipped preset as runnable from phantom power', () => {
    for (const id of ['bluejay', 'raven', 'sdc-electret', 'textbook-u87', 'textbook-schoeps']) {
      const r = analyse(presetById(id)!.build)
      expect(r.hardware.supply?.ok, id).toBe(true)
      expect(r.hardware.supply!.current, id).toBeLessThan(PHANTOM_MAX_CURRENT)
    }
  })

  it('models the phantom source impedance the standard specifies', () => {
    const r = analyse(bluejay())
    const s = r.hardware.supply!
    expect(s.phantomRail).toBeCloseTo(PHANTOM_VOLTS - s.current * PHANTOM_SOURCE_OHMS, 6)
  })

  it('cannot be pushed past the phantom budget from anywhere in the app', () => {
    // Worth pinning down: with the drain resistor, the supply rail and the FETs
    // this app offers, the converter tops out around 3 mA. If a future change
    // widens a slider far enough to break that, this test should say so.
    const spec = bluejay()
    spec.converter.values.R_d = 470
    spec.converter.values.R_s = 100
    spec.converter.values.spread = 1.5
    spec.converter.values.V_dd = 30
    const r = analyse(spec)
    expect(r.hardware.supply!.current).toBeLessThan(PHANTOM_MAX_CURRENT)
    expect(r.hardware.supply!.ok).toBe(true)
  })

  it('refuses a rail phantom power could not hold up', () => {
    // The guard itself, exercised directly: a stage wanting 30 V while drawing
    // 8 mA is asking phantom for a rail it sags well below.
    const nl = { elements: [{ id: 'conv.V_dd', kind: 'V', nodes: [1, 0], params: { V: 30 } }] } as never
    const op = { branchCurrents: { 'conv.V_dd': 8e-3 } } as never
    const s = supplyReport(nl, op)!
    expect(s.ok).toBe(false)
    expect(s.phantomRail).toBeLessThan(30)
    expect(s.warning).toMatch(/sag/i)
  })
})

describe('capsule polarisation limit', () => {
  it('warns above 65 V, where a real capsule starts to suffer', () => {
    const spec = bluejay()
    spec.polarisation.values.V_pol = 100
    const r = analyse(spec)
    expect(r.hardware.warnings.join(' ')).toMatch(/60–65 V/)
  })

  it('says nothing at 60 V', () => {
    const r = analyse(bluejay())
    expect(r.hardware.warnings.join(' ')).not.toMatch(/60–65 V/)
  })

  it('never warns about an electret, which has no external voltage at all', () => {
    for (const id of ['sdc-electret', 'textbook-schoeps']) {
      const r = analyse(presetById(id)!.build)
      expect(r.hardware.warnings.join(' '), id).not.toMatch(/arc/)
    }
  })
})

describe('headroom', () => {
  it('gives every shipped preset a usable maximum SPL', () => {
    for (const id of ['bluejay', 'raven', 'sdc-electret', 'textbook-u87']) {
      const r = analyse(presetById(id)!.build)
      expect(r.hardware.headroom, id).not.toBeNull()
      expect(r.hardware.headroom!.maxSpl, id).toBeGreaterThan(105)
    }
  })

  it('catches a bias point that would clip at conversational level', () => {
    const spec = bluejay()
    spec.converter.values.R_s = 100 // barely any V_ds left
    const r = analyse(spec)
    expect(r.hardware.headroom!.maxSpl).toBeLessThan(105)
    expect(r.hardware.warnings.join(' ')).toMatch(/dB SPL/)
  })

  it('gains headroom when the drain resistor is raised to move the drain off the rail', () => {
    const low = analyse(bluejay())
    const spec = bluejay()
    spec.converter.values.R_d = 15000
    const high = analyse(spec)
    expect(high.hardware.headroom!.maxSpl).toBeGreaterThan(low.hardware.headroom!.maxSpl)
  })
})

describe('component voltage stress', () => {
  it('puts the full polarisation voltage on the coupling capacitor', () => {
    const r = analyse(bluejay())
    const cc = r.hardware.stress.find((s) => s.id === 'pol.C_couple')!
    expect(Math.abs(cc.volts)).toBeGreaterThan(55)
    // 60 V DC on a part means buying a 100 V one, not a 63 V one.
    expect(cc.ratingHint).toBeGreaterThanOrEqual(100)
    // ...and a 1 nF part is film or ceramic, so no polarity to get wrong.
    expect(cc.polarised).toBe(false)
  })

  it('puts the full polarisation voltage on a backplate bypass capacitor too', () => {
    const r = analyse(presetById('raven')!.build)
    const cb = r.hardware.stress.find((s) => s.id === 'pol.C_bypass')!
    expect(Math.abs(cb.volts)).toBeGreaterThan(55)
    expect(cb.ratingHint).toBeGreaterThanOrEqual(100)
  })

  it('flags the output capacitors as polarised, and in opposite directions', () => {
    const r = analyse(bluejay())
    const p = r.hardware.stress.find((s) => s.id === 'out.C_outp')!
    const n = r.hardware.stress.find((s) => s.id === 'out.C_outn')!
    expect(p.polarised).toBe(true)
    expect(n.polarised).toBe(true)
    expect(Math.sign(p.volts)).not.toBe(Math.sign(n.volts))
  })

  it('does not list the capsule or the cable as parts to buy', () => {
    const r = analyse(bluejay())
    expect(r.hardware.stress.some((s) => s.id === 'capsule.C')).toBe(false)
    expect(r.hardware.stress.some((s) => s.id.startsWith('load.'))).toBe(false)
  })

  it('keeps every resistor far below a quarter watt', () => {
    for (const id of ['bluejay', 'raven', 'sdc-electret']) {
      const r = analyse(presetById(id)!.build)
      for (const s of r.hardware.stress) {
        expect(s.watts, `${id} ${s.id}`).toBeLessThan(0.05)
      }
    }
  })
})
