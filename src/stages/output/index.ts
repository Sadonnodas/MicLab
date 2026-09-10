import type { Variant } from '../types'
import { num } from '../types'
import { db, eng, hz } from '../../lib/format'

/**
 * Stage D — the output.
 *
 * Everything up to here has been about not loading the capsule. This stage is
 * about the opposite problem: getting the signal down a long cable into a
 * preamp without the world getting in on the way.
 */

const C_OUT_HELP =
  'Blocks the stage’s DC from the outside world. With whatever resistance follows it, it is the last high-pass in the microphone.'

export const OUTPUT_VARIANTS: Variant[] = [
  {
    id: 'transformer',
    stage: 'output',
    name: 'Output transformer',
    summary: 'Coupled coils: balanced, isolated, and quieter by the turns ratio',
    detail:
      'A transformer does three things at once: it makes the output balanced and galvanically isolated, it divides the voltage by the turns ratio, and it divides the impedance by the ratio squared. The catch is the primary inductance — it sits across the driving source, and below the frequency where its impedance falls to the source impedance, the bass goes. That is why transformer boards have a driver stage: 20 H driven from 100 Ω corners at 0.8 Hz, but driven straight from a 4.7 kΩ drain it corners at 37 Hz.',
    hardware: 'Raven (U247-style board)',
    params: [
      {
        key: 'ratio',
        label: 'Turns ratio',
        unit: ':1',
        min: 3,
        max: 12,
        default: 7,
        scale: 'linear',
        choices: [
          { value: 5, label: '5:1' },
          { value: 7, label: '7:1' },
          { value: 10, label: '10:1' },
        ],
        help: 'Primary turns per secondary turn. Level is divided by it; impedance seen from the primary is multiplied by its square.',
        lesson: 10,
      },
      {
        key: 'R_drv',
        label: 'Driver output impedance',
        unit: 'Ω',
        min: 0,
        max: 10e3,
        default: 100,
        scale: 'linear',
        choices: [
          { value: 100, label: '100 Ω (buffered)' },
          { value: 1000, label: '1 kΩ' },
          { value: 4700, label: 'none — straight from the drain' },
        ],
        help: 'The impedance driving the primary. This, not the transformer, is what really sets the bass corner.',
        lesson: 10,
      },
      {
        key: 'L_p',
        label: 'Primary inductance',
        unit: 'H',
        min: 1,
        max: 200,
        default: 20,
        scale: 'log',
        help: 'How much iron and how many turns. Its impedance rises with frequency, so it only stops being a short at frequencies well above the bass corner.',
        lesson: 10,
      },
      {
        key: 'R_p',
        label: 'Primary winding resistance',
        unit: 'Ω',
        min: 20,
        max: 2000,
        default: 400,
        scale: 'log',
        help: 'The copper in the primary. It hisses like any other resistor and drops a little signal.',
        lesson: 10,
      },
      {
        key: 'R_sec',
        label: 'Secondary winding resistance',
        unit: 'Ω',
        min: 2,
        max: 300,
        default: 30,
        scale: 'log',
        help: 'The copper in the secondary — this is what the preamp sees as the microphone’s source impedance, along with the reflected primary.',
        lesson: 10,
      },
      {
        key: 'C_w',
        label: 'Winding capacitance',
        unit: 'F',
        min: 10e-12,
        max: 5e-9,
        default: 200e-12,
        scale: 'log',
        help: 'Capacitance between turns, seen across the secondary. With the leakage inductance it sets where the transformer stops behaving.',
        lesson: 10,
      },
      {
        key: 'k',
        label: 'Coupling',
        unit: '',
        min: 0.9,
        max: 0.99999,
        default: 0.999,
        scale: 'linear',
        help: 'How much of the primary’s field the secondary actually sees. Whatever is left over is leakage inductance, in series with the signal.',
        lesson: 10,
      },
      {
        key: 'C_out',
        label: 'Coupling capacitor',
        unit: 'F',
        min: 100e-9,
        max: 100e-6,
        default: 10e-6,
        scale: 'log',
        help: C_OUT_HELP,
        lesson: 10,
      },
    ],
    build(b, v, ctx) {
      const n = num(v, 'ratio', 7)
      const Lp = num(v, 'L_p', 20)
      const Rdrv = num(v, 'R_drv', 100)
      const Rsec = num(v, 'R_sec', 30)
      // Ideal unity-gain buffer standing in for the real board's driver stage.
      // "None" is modelled by making its output impedance the drain resistor.
      b.add({
        id: 'out.drv',
        kind: 'VCVS',
        nodes: ['drv', 'gnd', ctx.converterOut, 'gnd'],
        params: { gain: 1, Rout: Math.max(Rdrv, 1) },
        stage: 'output',
        label: 'driver',
        note: 'A unity-gain buffer with a low output impedance. Without one, the transformer’s primary loads the FET drain and takes the bass with it.',
      })
      b.add({ id: 'out.C_out', kind: 'C', nodes: ['drv', 'p1'], params: { C: num(v, 'C_out', 10e-6) }, stage: 'output', label: 'C_out', note: 'Keeps the driver’s DC out of the transformer — a DC current in the primary magnetises the core.' })
      b.add({ id: 'out.R_p', kind: 'R', nodes: ['p1', 'p2'], params: { R: num(v, 'R_p', 400) }, stage: 'output', label: 'R_p', note: 'Primary copper resistance.' })
      b.add({ id: 'out.L_p', kind: 'L', nodes: ['p2', 'gnd'], params: { L: Lp }, stage: 'output', label: 'L_p', note: 'Primary inductance.' })
      b.add({ id: 'out.L_s', kind: 'L', nodes: ['s1', 's2'], params: { L: Lp / (n * n) }, stage: 'output', label: 'L_s', note: 'Secondary inductance — the primary divided by the ratio squared.' })
      b.add({ id: 'out.K', kind: 'K', nodes: [], refs: ['out.L_p', 'out.L_s'], params: { k: num(v, 'k', 0.999) }, stage: 'output', label: 'core coupling', note: 'How tightly the two windings share their magnetic field.' })
      b.add({ id: 'out.C_w', kind: 'C', nodes: ['s1', 's2'], params: { C: num(v, 'C_w', 200e-12) }, stage: 'output', label: 'C_w', note: 'Winding capacitance across the secondary.' })
      b.add({ id: 'out.R_s1', kind: 'R', nodes: ['s1', 'outp'], params: { R: Rsec / 2 }, stage: 'output', label: 'R_sec/2', note: 'Half the secondary copper resistance, on the hot leg.' })
      // Real resistors are not identical. The half-percent mismatch below is
      // what limits common-mode rejection, and therefore how much of a ground
      // loop you actually hear — see the fault panel.
      b.add({ id: 'out.R_s2', kind: 'R', nodes: ['s2', 'outn'], params: { R: (Rsec / 2) * 1.005 }, stage: 'output', label: 'R_sec/2', note: 'Half the secondary copper resistance, on the cold leg — half a percent off, as real parts are.' })
      // An "ideal" transformer for attribution is one with infinite primary
      // inductance *and* perfect coupling. Scaling the inductance alone scales
      // the leakage inductance L_p(1 − k²) with it, which would put a spurious
      // roll-off into the reference curve.
      ctx.idealOverrides['out.L_p'] = { L: Lp * 1e3 }
      ctx.idealOverrides['out.L_s'] = { L: (Lp / (n * n)) * 1e3 }
      ctx.idealOverrides['out.K'] = { k: 1 - 1e-8 }
      ctx.idealOverrides['out.C_out'] = { C: 1 }
      ctx.idealOverrides['out.C_w'] = { C: 1e-18 }
      ctx.idealOverrides['out.R_p'] = { R: 1e-6 }
      ctx.idealOverrides['out.R_s1'] = { R: 1e-6 }
      ctx.idealOverrides['out.R_s2'] = { R: 1e-6 }
    },
    derived(v) {
      const n = num(v, 'ratio', 7)
      const Lp = num(v, 'L_p', 20)
      const Rdrv = Math.max(num(v, 'R_drv', 100), 1)
      const Rp = num(v, 'R_p', 400)
      const fLf = (Rdrv + Rp) / (2 * Math.PI * Lp)
      return [
        {
          key: 'ratio',
          label: 'Transformer loss',
          value: -20 * Math.log10(n),
          unit: 'dB',
          format: (x) => db(x),
          attachTo: 'ratio',
          sentence: (from, to) =>
            `The turns ratio now costs ${to} of level instead of ${from} — and multiplies the impedance the primary sees by the square of the ratio.`,
          why: 'A transformer trades voltage for current. Seven turns on the primary for one on the secondary gives you a seventh of the voltage, seven times the current, and a forty-ninth of the impedance. The level loss is real and you make it up in the preamp — but you gained a balanced, isolated output and a source impedance the cable is happy with.',
        },
        {
          key: 'f_lf',
          label: 'Transformer bass corner',
          value: fLf,
          unit: 'Hz',
          format: hz,
          attachTo: 'L_p',
          sentence: (from, to) =>
            `The transformer's bass corner moved from ${from} to ${to}.`,
          why: 'The primary inductance sits directly across the driving source. Its impedance is 2πfL — small at low frequencies — so below the frequency where it equals the source impedance, the primary is effectively a short and the bass disappears. This is the single reason transformer output boards bother with a driver stage: the same 20 H transformer corners at 0.8 Hz from a 100 Ω buffer and at 37 Hz from a bare 4.7 kΩ drain.',
        },
        {
          key: 'z_reflect',
          label: 'Load seen by the primary',
          value: 1500 * n * n,
          unit: 'Ω',
          format: (x) => eng(x, 'Ω'),
          attachTo: 'ratio',
          sentence: (from, to) => `A 1.5 kΩ preamp now looks like ${to} to the primary, not ${from}.`,
          why: 'Impedance transforms by the square of the turns ratio. A 7:1 transformer makes a 1.5 kΩ preamp look like 73 kΩ to the FET — which is exactly why the FET can drive it at all.',
        },
      ]
    },
  },
  {
    id: 'transformerless',
    stage: 'output',
    name: 'Transformerless balanced',
    summary: 'An electronic phase splitter — two legs, opposite polarity, no iron',
    detail:
      'Instead of a transformer, two active devices produce the same signal with opposite polarity. Balanced-ness is what matters for noise rejection, and you can get it electronically for a fraction of the cost and weight. What you lose is isolation: the microphone’s ground and the preamp’s ground are now connected, which is where ground-loop buzz comes from.',
    hardware: 'Blue Jay (U87-style board)',
    params: [
      {
        key: 'C_out',
        label: 'Output coupling capacitors',
        unit: 'F',
        min: 1e-6,
        max: 220e-6,
        default: 47e-6,
        scale: 'log',
        help: C_OUT_HELP,
        lesson: 11,
      },
      {
        key: 'R_out',
        label: 'Output build-out resistors',
        unit: 'Ω',
        min: 10,
        max: 1000,
        default: 47,
        scale: 'log',
        help: 'Small series resistors on each leg. They protect the output devices and keep RF out; they also set the microphone’s source impedance.',
        lesson: 11,
      },
    ],
    build(b, v, ctx) {
      const C = num(v, 'C_out', 47e-6)
      const R = num(v, 'R_out', 47)
      // Two ideal opposite-polarity buffers at half amplitude each, so the
      // differential output equals the single-ended signal that drives them.
      b.add({ id: 'out.Ep', kind: 'VCVS', nodes: ['bp', 'gnd', ctx.converterOut, 'gnd'], params: { gain: 0.5, Rout: 10 }, stage: 'output', label: 'phase splitter +', note: 'The hot leg of the electronic phase splitter.' })
      b.add({ id: 'out.En', kind: 'VCVS', nodes: ['bn', 'gnd', ctx.converterOut, 'gnd'], params: { gain: -0.5, Rout: 10 }, stage: 'output', label: 'phase splitter −', note: 'The cold leg — the same signal upside down.' })
      b.add({ id: 'out.C_outp', kind: 'C', nodes: ['bp', 'tp'], params: { C }, stage: 'output', label: 'C_out +', note: 'DC block on the hot leg.' })
      b.add({ id: 'out.C_outn', kind: 'C', nodes: ['bn', 'tn'], params: { C }, stage: 'output', label: 'C_out −', note: 'DC block on the cold leg.' })
      b.add({ id: 'out.R_outp', kind: 'R', nodes: ['tp', 'outp'], params: { R }, stage: 'output', label: 'R_out +', note: 'Build-out resistor, hot leg.' })
      // Half a percent of resistor tolerance: this mismatch is what sets the
      // output's common-mode rejection, and therefore how much hum a ground
      // loop puts into the signal.
      b.add({ id: 'out.R_outn', kind: 'R', nodes: ['tn', 'outn'], params: { R: R * 1.005 }, stage: 'output', label: 'R_out −', note: 'Build-out resistor, cold leg — half a percent off, as real parts are.' })
      ctx.idealOverrides['out.C_outp'] = { C: 1 }
      ctx.idealOverrides['out.C_outn'] = { C: 1 }
      ctx.idealOverrides['out.R_outp'] = { R: 1e-6 }
      ctx.idealOverrides['out.R_outn'] = { R: 1e-6 }
    },
    derived(v, ctx) {
      const C = num(v, 'C_out', 47e-6)
      const Rout = num(v, 'R_out', 47)
      const Rload = num(ctx.values.load, 'R_preamp', 1500)
      // Two capacitors in series around the loop, so the effective C is C/2.
      const f = 1 / (2 * Math.PI * (Rload + 2 * Rout) * (C / 2))
      return [
        {
          key: 'f_out',
          label: 'Output high-pass',
          value: f,
          unit: 'Hz',
          format: hz,
          attachTo: 'C_out',
          sentence: (from, to) =>
            `The output capacitors and the preamp now corner at ${to} instead of ${from}.`,
          why: 'The two output capacitors are in series around the loop through the preamp’s input, so together they behave as half of one of them. Into 1.5 kΩ, 47 µF each gives about 4.3 Hz — inaudible. Into the same load, 4.7 µF each would give 43 Hz, which you would certainly hear. This corner is the one place where the preamp you plug into changes the microphone’s frequency response, not just its level.',
        },
        {
          key: 'z_out',
          label: 'Source impedance',
          value: 2 * Rout,
          unit: 'Ω',
          format: (x) => eng(x, 'Ω'),
          attachTo: 'R_out',
          sentence: (from, to) => `The microphone's output impedance is now ${to}, was ${from}.`,
          why: 'A studio microphone is expected to look like 50–200 Ω. Low enough that cable capacitance does not matter, high enough that the output devices survive someone plugging into a phantom-powered input.',
        },
      ]
    },
  },
  {
    id: 'unbalanced',
    stage: 'output',
    name: 'Unbalanced / plug-in power',
    summary: 'One capacitor, one resistor, one wire — the contrast case',
    detail:
      'What an electret capsule module actually gives you: the FET’s drain, a capacitor, and a resistor, with the shield as the return. It works, and over a short cable in a quiet room it works well. Over ten metres next to a dimmer it does not, and that comparison is the entire argument for balanced outputs.',
    hardware: 'SDC electret build',
    params: [
      { key: 'C_out', label: 'Output coupling capacitor', unit: 'F', min: 1e-6, max: 100e-6, default: 10e-6, scale: 'log', help: C_OUT_HELP, lesson: 11 },
      { key: 'R_out', label: 'Output resistor', unit: 'Ω', min: 100, max: 10e3, default: 1e3, scale: 'log', help: 'The load resistor for the capsule’s internal FET, fed from the plug-in-power supply.', lesson: 11 },
    ],
    build(b, v, ctx) {
      b.add({ id: 'out.C_out', kind: 'C', nodes: [ctx.converterOut, 'tp'], params: { C: num(v, 'C_out', 10e-6) }, stage: 'output', label: 'C_out', note: 'DC block.' })
      b.add({ id: 'out.R_out', kind: 'R', nodes: ['tp', 'outp'], params: { R: num(v, 'R_out', 1e3) }, stage: 'output', label: 'R_out', note: 'Series output resistance.' })
      b.add({ id: 'out.gndLeg', kind: 'R', nodes: ['outn', 'gnd'], params: { R: 0.01, noiseless: 1 }, stage: 'output', label: 'return', note: 'The cold side is simply ground — which is the whole problem.' })
      ctx.idealOverrides['out.C_out'] = { C: 1 }
      ctx.idealOverrides['out.R_out'] = { R: 1e-6 }
    },
    derived(v, ctx) {
      const C = num(v, 'C_out', 10e-6)
      const Rload = num(ctx.values.load, 'R_preamp', 1500)
      const Rout = num(v, 'R_out', 1e3)
      return [
        {
          key: 'f_out',
          label: 'Output high-pass',
          value: 1 / (2 * Math.PI * (Rload + Rout) * C),
          unit: 'Hz',
          format: hz,
          attachTo: 'C_out',
          sentence: (from, to) => `The output high-pass moved from ${from} to ${to}.`,
          why: 'One capacitor into the load resistance. With a 1 kΩ output resistor feeding a 1.5 kΩ preamp, a 10 µF capacitor corners at about 6 Hz.',
        },
      ]
    },
  },
]

export const outputVariant = (id: string): Variant =>
  OUTPUT_VARIANTS.find((v) => v.id === id) ?? OUTPUT_VARIANTS[0]
