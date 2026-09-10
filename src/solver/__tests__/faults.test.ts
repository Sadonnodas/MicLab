import { describe, expect, it } from 'vitest'
import { analyse } from '../analysis'
import { presetById } from '../../data/presets'
import { FAULTS } from '../../stages/faults'
import type { BuildSpec } from '../../stages/build'

/**
 * The fault panel only teaches anything if the numbers land where the lesson
 * says they do: audible when they should be audible, rejected when the circuit
 * ought to reject them. These are the levels lesson 13 is written around.
 */

function withFault(preset: string, faultId: string): BuildSpec {
  const spec = structuredClone(presetById(preset)!.build)
  const fault = FAULTS.find((f) => f.id === faultId)!
  const values: Record<string, number> = {}
  for (const p of fault.params) values[p.key] = p.default
  spec.faults = [{ id: faultId, values }]
  return spec
}

describe('faults', () => {
  it('every fault still solves on every preset', () => {
    for (const preset of ['bluejay', 'raven', 'sdc-electret']) {
      for (const f of FAULTS) {
        const r = analyse(withFault(preset, f.id))
        expect(r.op.converged, `${preset} + ${f.id}`).toBe(true)
        expect(Number.isFinite(r.sensitivity), `${preset} + ${f.id} sensitivity`).toBe(true)
        expect(r.sensitivity, `${preset} + ${f.id} sensitivity`).toBeGreaterThan(0)
      }
    }
  })

  it('makes a floating capsule body loudly audible', () => {
    for (const preset of ['bluejay', 'raven']) {
      const r = analyse(withFault(preset, 'floating-body'))
      expect(r.humTotalSpl, preset).toBeGreaterThan(60)
      expect(r.humTotalSpl, preset).toBeLessThan(100)
    }
  })

  it('shows a ground loop rejected by balanced outputs and not by unbalanced ones', () => {
    // This is lesson 13's whole argument, so it is worth a test.
    const balanced = analyse(withFault('bluejay', 'ground-loop'))
    const transformer = analyse(withFault('raven', 'ground-loop'))
    const unbalanced = analyse(withFault('sdc-electret', 'ground-loop'))

    expect(balanced.humTotalSpl).toBeLessThan(balanced.selfNoiseDbA)
    expect(transformer.humTotalSpl).toBeLessThan(balanced.humTotalSpl - 40)
    expect(unbalanced.humTotalSpl).toBeGreaterThan(unbalanced.selfNoiseDbA + 20)
  })

  it('puts the demodulated RF buzz above the noise floor but below the music', () => {
    for (const preset of ['bluejay', 'raven', 'sdc-electret']) {
      const r = analyse(withFault(preset, 'no-rf-caps'))
      expect(r.humTotalSpl, preset).toBeGreaterThan(r.selfNoiseDbA + 15)
      expect(r.humTotalSpl, preset).toBeLessThan(80)
    }
  })

  it('collapses the polarisation voltage on a leaky diaphragm-polarised board', () => {
    // The leakage forms a DC divider with R_pol, so the microphone gets quieter
    // as well as noisier — and the backplate-polarised board does not care.
    const clean = analyse(presetById('bluejay')!.build)
    const leaky = analyse(withFault('bluejay', 'leaky-pol'))
    expect(leaky.op.vpol).toBeLessThan(clean.op.vpol * 0.5)
    expect(leaky.sensitivity).toBeLessThan(clean.sensitivity * 0.6)
    expect(leaky.selfNoiseDbA).toBeGreaterThan(clean.selfNoiseDbA + 5)

    const ravenClean = analyse(presetById('raven')!.build)
    const ravenLeaky = analyse(withFault('raven', 'leaky-pol'))
    expect(ravenLeaky.op.vpol).toBeCloseTo(ravenClean.op.vpol, 1)
    // Not quite identical — the leakage still loads the gate node a little —
    // but nothing like the collapse a diaphragm-polarised board suffers.
    expect(Math.abs(1 - ravenLeaky.sensitivity / ravenClean.sensitivity)).toBeLessThan(0.01)
  })

  it('loses signal to stray capacitance without gaining noise', () => {
    const clean = analyse(presetById('bluejay')!.build)
    const strayed = analyse(withFault('bluejay', 'stray'))
    expect(strayed.sensitivity).toBeLessThan(clean.sensitivity * 0.95)
    // The point of lesson 5: what the divider takes, it never gives back.
    expect(strayed.selfNoiseDbA).toBeGreaterThan(clean.selfNoiseDbA)
  })
})
