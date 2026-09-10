import { describe, expect, it } from 'vitest'
import { assemblySteps, PARTS } from './assembly'
import { analyse } from '../solver/analysis'
import { presetById, PRESETS } from '../data/presets'

/**
 * The walkthrough shows a half-built board, which is a state the solver is
 * never otherwise asked for. Every step has to produce a circuit that solves,
 * biases, and tells the truth — and the story has to read forwards, without a
 * step where adding a part appears to break something.
 */

describe('assembly walkthrough', () => {
  it('solves at every step of every preset', () => {
    for (const preset of PRESETS) {
      const steps = assemblySteps(preset.build)
      expect(steps.length, preset.name).toBeGreaterThan(6)
      for (const [i, s] of steps.entries()) {
        const r = analyse(preset.build, { only: s.enabled, probe: s.probe })
        expect(r.op.converged, `${preset.name} step ${i + 1} (${s.title})`).toBe(true)
        expect(Number.isFinite(r.sensitivity), `${preset.name} step ${i + 1}`).toBe(true)
      }
    }
  })

  it('ends with exactly the build the user started from', () => {
    for (const preset of PRESETS) {
      const steps = assemblySteps(preset.build)
      const last = steps[steps.length - 1]
      const full = analyse(preset.build)
      const built = analyse(preset.build, { only: last.enabled, probe: last.probe })
      expect(built.sensitivity, preset.name).toBeCloseTo(full.sensitivity, 9)
      expect(built.selfNoiseDbA, preset.name).toBeCloseTo(full.selfNoiseDbA, 6)
    }
  })

  it('fits every part exactly once', () => {
    for (const preset of PRESETS) {
      const steps = assemblySteps(preset.build)
      const seen = new Set<string>()
      for (const s of steps) {
        for (const id of s.adds) {
          expect(seen.has(id), `${preset.name}: ${id} fitted twice`).toBe(false)
          seen.add(id)
        }
      }
    }
  })

  it('starts silent, because an uncharged capsule produces nothing', () => {
    const steps = assemblySteps(presetById('bluejay')!.build)
    const first = analyse(presetById('bluejay')!.build, { only: steps[0].enabled, probe: steps[0].probe })
    expect(first.silent).toBe(true)
    // ...and stops being silent the moment it is charged.
    const second = analyse(presetById('bluejay')!.build, { only: steps[1].enabled, probe: steps[1].probe })
    expect(second.silent).toBe(false)
    expect(second.sensitivity * 1000).toBeGreaterThan(15)
  })

  it('never goes silent again once the capsule is charged', () => {
    // A step that appears to break the microphone reads as a mistake by the
    // person following it, so the order has to avoid one.
    for (const preset of PRESETS) {
      const steps = assemblySteps(preset.build)
      let charged = false
      for (const [i, s] of steps.entries()) {
        const r = analyse(preset.build, { only: s.enabled, probe: s.probe })
        if (!r.silent) charged = true
        else if (charged) {
          throw new Error(`${preset.name} step ${i + 1} (${s.title}) went silent after working`)
        }
      }
      expect(charged, preset.name).toBe(true)
    }
  })

  it('probes somewhere the capsule can actually reach', () => {
    // Before the transistor is fitted, the drain node exists but nothing joins
    // it to the capsule; probing there would show silence and look like a fault.
    const steps = assemblySteps(presetById('bluejay')!.build)
    const beforeFet = steps.filter((s) => !s.enabled.has('conv.J'))
    for (const s of beforeFet) {
      expect(s.probe[0], s.title).not.toBe('drn')
    }
    const afterFet = steps.find((s) => s.adds.includes('conv.J'))!
    expect(afterFet.probe[0]).toBe('drn')
  })

  it('gives every step that has its own screen something to say', () => {
    for (const [id, info] of Object.entries(PARTS)) {
      if (info.silent) continue
      expect(info.title, id).not.toBe('')
      expect(info.what.length, id).toBeGreaterThan(60)
      expect(info.expect.length, id).toBeGreaterThan(40)
    }
  })
})
