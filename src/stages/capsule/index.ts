import type { Variant, ParamDef } from '../types'
import { num } from '../types'
import { eng, hz } from '../../lib/format'

/**
 * Stage A — the capsule.
 *
 * Netlist-wise every capsule is the same two elements: the static capacitance
 * between diaphragm and backplate, and a behavioural voltage source in series
 * with it carrying the sound. What differs between variants is the numbers:
 * how big the capacitance is, how sensitive the capsule is, where the diaphragm
 * resonance sits, and how much presence bump the hole pattern adds.
 */

interface CapsulePreset {
  id: string
  name: string
  summary: string
  detail: string
  Ccaps: number
  S0: number
  fres: number
  Qres: number
  presenceDb: number
  presenceF: number
  presenceQ: number
  Nac: number
  hardware?: string
  fixedVpol?: number
}

const PRESETS: CapsulePreset[] = [
  {
    id: 'k67',
    name: 'K67-type (CY002)',
    summary: '34 mm dual-diaphragm, centre-terminated, K67 hole pattern',
    detail:
      'The capsule in both of your builds. Its backplate hole pattern gives a broad lift around 7 kHz on top of the diaphragm resonance near 9 kHz — the famous rising top end. U87-style boards de-emphasise it; U47/U247-style boards let it through, which is most of why Raven and Blue Jay do not sound the same.',
    Ccaps: 55e-12,
    S0: 20e-3,
    fres: 9000,
    Qres: 1.5,
    presenceDb: 5,
    presenceF: 7000,
    presenceQ: 1,
    Nac: 8,
    hardware: '797AUDIO CY002',
  },
  {
    id: 'k47',
    name: 'K47-type',
    summary: 'Single backplate, edge-terminated',
    detail:
      'The older U47 geometry: one backplate, the diaphragm clamped at the edge. Flatter through the mids and a gentler, lower top-end lift than the K67.',
    Ccaps: 65e-12,
    S0: 18e-3,
    fres: 10000,
    Qres: 1.2,
    presenceDb: 3,
    presenceF: 4500,
    presenceQ: 0.7,
    Nac: 8,
  },
  {
    id: 'k87',
    name: 'K87-type',
    summary: 'Like K67 but dual backplate, electrically separate halves',
    detail:
      'Acoustically a K67, electrically different: the two backplate halves are separate, which is what lets a board polarise the backplate instead of the diaphragm.',
    Ccaps: 55e-12,
    S0: 20e-3,
    fres: 9000,
    Qres: 1.5,
    presenceDb: 5,
    presenceF: 7000,
    presenceQ: 1,
    Nac: 8,
  },
  {
    id: 'electret',
    name: 'SDC electret',
    summary: '16 mm, permanently charged',
    detail:
      'A small diaphragm with a permanently charged (electret) layer. No external polarisation voltage is possible or needed — but the mic still needs power, for the FET. Small diaphragms resonate higher and hiss more, because there is less area collecting sound relative to the air damping behind it.',
    Ccaps: 25e-12,
    S0: 8e-3,
    fres: 14000,
    Qres: 1.0,
    presenceDb: 2,
    presenceF: 10000,
    presenceQ: 0.8,
    Nac: 14,
    fixedVpol: 100,
    hardware: 'e614-clone SDC build',
  },
  {
    id: 'flat',
    name: 'Ideal flat',
    summary: 'Teaching reference — no mechanics at all',
    detail:
      'A capsule that is only a capacitor: no resonance, no presence bump, no acoustic noise. Use it to hear what the electronics alone are doing.',
    Ccaps: 60e-12,
    S0: 20e-3,
    fres: 0,
    Qres: 1,
    presenceDb: 0,
    presenceF: 7000,
    presenceQ: 1,
    Nac: 0,
  },
]

const params = (p: CapsulePreset): ParamDef[] => [
  {
    key: 'Ccaps',
    label: 'Capsule capacitance',
    unit: 'F',
    min: 10e-12,
    max: 120e-12,
    default: p.Ccaps,
    scale: 'log',
    help: 'The capacitance between diaphragm and backplate at rest. Sound changes it by a few parts per million; everything downstream is a divider against it.',
    lesson: 1,
  },
  {
    key: 'fres',
    label: 'Diaphragm resonance',
    unit: 'Hz',
    min: 2000,
    max: 20000,
    default: p.fres,
    scale: 'log',
    help: 'Where the stretched diaphragm rings. Tighter or lighter diaphragm → higher resonance. Above it the response falls at 12 dB/octave.',
    lesson: 1,
  },
  {
    key: 'Qres',
    label: 'Resonance Q',
    unit: '',
    min: 0.4,
    max: 4,
    default: p.Qres,
    scale: 'log',
    help: 'How undamped the resonance is. The air trapped in the backplate holes is the damping — more damping, lower Q, gentler peak.',
    lesson: 1,
  },
  {
    key: 'presenceDb',
    label: 'Presence bump',
    unit: 'dB',
    min: 0,
    max: 10,
    default: p.presenceDb,
    scale: 'linear',
    help: 'The broad lift the backplate hole pattern adds below the main resonance. This is "K67-ness" as a knob.',
    lesson: 1,
  },
  {
    key: 'presenceF',
    label: 'Presence centre',
    unit: 'Hz',
    min: 2000,
    max: 14000,
    default: p.presenceF,
    scale: 'log',
    help: 'Where the hole-pattern lift is centred.',
    lesson: 1,
  },
  {
    key: 'Nac',
    label: 'Acoustic self-noise',
    unit: 'dB-A',
    min: 0,
    max: 26,
    default: p.Nac,
    scale: 'linear',
    help: 'The capsule’s own hiss: thermal motion of the diaphragm and of the air damping it. In a good large-diaphragm mic this is the biggest noise source in the whole microphone.',
    lesson: 4,
  },
  {
    key: 'S0',
    label: 'Sensitivity at 60 V',
    unit: 'V/Pa',
    min: 2e-3,
    max: 40e-3,
    default: p.S0,
    scale: 'log',
    help: 'Open-circuit output per pascal at the reference polarisation voltage. Bigger diaphragm, smaller gap, more volts → more of this.',
    lesson: 2,
  },
]

export const CAPSULE_VARIANTS: Variant[] = PRESETS.map((p) => ({
  id: p.id,
  stage: 'capsule',
  name: p.name,
  summary: p.summary,
  detail: p.detail,
  hardware: p.hardware,
  params: params(p),
  build(b, v, ctx) {
    const Ccaps = num(v, 'Ccaps', p.Ccaps)
    ctx.capsule = {
      Ccaps,
      S0: num(v, 'S0', p.S0),
      Vref: 60,
      fres: num(v, 'fres', p.fres),
      Qres: num(v, 'Qres', p.Qres),
      presenceDb: num(v, 'presenceDb', p.presenceDb),
      presenceF: num(v, 'presenceF', p.presenceF),
      presenceQ: p.presenceQ,
      Nac: num(v, 'Nac', p.Nac),
      fixedVpol: p.fixedVpol,
    }
    // The capsule itself: the behavioural source in series with the static
    // capacitance, between the backplate and the diaphragm.
    b.add({
      id: 'capsule.E',
      kind: 'E_BEHAV',
      nodes: ['capsE', 'back'],
      params: {},
      stage: 'capsule',
      label: 'Capsule EMF',
      note: 'The voltage the moving diaphragm generates. Not a real component — it is what the physics does.',
    })
    b.add({
      id: 'capsule.C',
      kind: 'C',
      nodes: ['dia', 'capsE'],
      params: { C: Ccaps },
      stage: 'capsule',
      label: 'C_caps',
      note: 'Diaphragm-to-backplate capacitance. The source impedance of the entire microphone.',
    })
  },
  derived(v) {
    const Ccaps = num(v, 'Ccaps', p.Ccaps)
    const S0 = num(v, 'S0', p.S0)
    return [
      {
        key: 'Ccaps',
        label: 'Source impedance at 20 Hz',
        value: 1 / (2 * Math.PI * 20 * Ccaps),
        unit: 'Ω',
        format: (x) => eng(x, 'Ω'),
        attachTo: 'Ccaps',
        sentence: (from, to) =>
          `The capsule's own impedance at 20 Hz went from ${from} to ${to}. That is the impedance everything after it has to not load down.`,
        why: 'A 55 pF capacitor is a 145 MΩ source at 20 Hz. Nothing you can buy has an input impedance that high, which is why a microphone needs an impedance converter sitting millimetres away from the capsule.',
      },
      {
        key: 'fres',
        label: 'Diaphragm resonance',
        value: num(v, 'fres', p.fres),
        unit: 'Hz',
        format: hz,
        attachTo: 'fres',
        sentence: (from, to) =>
          `The diaphragm resonance moved from ${from} to ${to}, taking the whole top-end lift with it.`,
        why: 'A stretched membrane is a mass on a spring. Below its resonance it follows the pressure faithfully; at resonance it exaggerates; above it, it can no longer keep up and the response falls at 12 dB per octave.',
      },
      {
        key: 'S0',
        label: 'Sensitivity at 60 V',
        value: S0,
        unit: 'V/Pa',
        format: (x) => `${(x * 1000).toFixed(1)} mV/Pa`,
        attachTo: 'S0',
        sentence: (from, to) => `Open-circuit sensitivity: ${from} → ${to}.`,
        why: 'Sensitivity is how many volts one pascal of sound pressure produces at the capsule terminals, before any loading. One pascal is 94 dB SPL — a fairly loud voice at a hand’s distance.',
      },
    ]
  },
}))

export const capsuleVariant = (id: string): Variant =>
  CAPSULE_VARIANTS.find((v) => v.id === id) ?? CAPSULE_VARIANTS[0]
