import type { Variant } from '../types'
import { num } from '../types'
import { eng, hz } from '../../lib/format'

/**
 * The load — cable and preamp.
 *
 * Not part of the microphone, and completely part of how it sounds. The preamp's
 * input impedance loads the output stage, and the cable's capacitance hangs off
 * whatever source impedance the microphone presents.
 */
export const LOAD_VARIANT: Variant = {
  id: 'standard',
  stage: 'load',
  name: 'Cable and preamp',
  summary: 'What the microphone is actually plugged into',
  detail:
    'Every metre of microphone cable is about 100 pF from each signal leg to the shield, and every preamp presents a finite input impedance. A transformer output barely notices; a transformerless one, whose output capacitors work against that impedance, notices in the bass.',
  params: [
    {
      key: 'R_preamp',
      label: 'Preamp input impedance',
      unit: 'Ω',
      min: 200,
      max: 20e3,
      default: 1500,
      scale: 'log',
      choices: [
        { value: 1500, label: '1.5 kΩ' },
        { value: 2400, label: '2.4 kΩ' },
        { value: 10000, label: '10 kΩ' },
      ],
      help: 'What the preamp presents across pins 2 and 3. Console preamps are often 1.5 kΩ; modern boutique ones 2–10 kΩ.',
      lesson: 12,
    },
    {
      key: 'cable_m',
      label: 'Cable length',
      unit: 'm',
      min: 1,
      max: 50,
      default: 5,
      scale: 'linear',
      help: 'At roughly 100 pF per metre per leg, cable capacitance is a low-pass against the microphone’s source impedance.',
      lesson: 12,
    },
    {
      key: 'R_shield',
      label: 'Shield resistance',
      unit: 'Ω',
      min: 0.01,
      max: 1000,
      default: 0.1,
      scale: 'log',
      help: 'The resistance of the screen and its two solder joints. Should be milliohms. When it is not, it becomes an antenna terminal.',
      lesson: 13,
    },
    {
      key: 'C_rf',
      label: 'RF filter caps at the XLR',
      unit: 'F',
      min: 0,
      max: 1e-9,
      default: 100e-12,
      scale: 'linear',
      help: 'Small capacitors from each pin to the shell. They short radio frequencies to the shield before they can reach anything that might rectify them.',
      lesson: 13,
    },
  ],
  build(b, v, ctx) {
    const Rl = num(v, 'R_preamp', 1500)
    const Ccable = num(v, 'cable_m', 5) * 100e-12
    const Crf = num(v, 'C_rf', 100e-12)
    b.add({ id: 'load.R_cablep', kind: 'R', nodes: ['outp', 'loadp'], params: { R: 0.5, noiseless: 1 }, stage: 'load', label: 'cable +', note: 'Copper resistance of the hot conductor.' })
    b.add({ id: 'load.R_cablen', kind: 'R', nodes: ['outn', 'loadn'], params: { R: 0.5, noiseless: 1 }, stage: 'load', label: 'cable −', note: 'Copper resistance of the cold conductor.' })
    b.add({ id: 'load.C_cablep', kind: 'C', nodes: ['loadp', 'shield'], params: { C: Ccable }, stage: 'load', label: 'C_cable +', note: 'Capacitance from the hot leg to the screen.' })
    b.add({ id: 'load.C_cablen', kind: 'C', nodes: ['loadn', 'shield'], params: { C: Ccable }, stage: 'load', label: 'C_cable −', note: 'Capacitance from the cold leg to the screen.' })
    if (Crf > 0) {
      b.add({ id: 'load.C_rfp', kind: 'C', nodes: ['outp', 'shield'], params: { C: Crf }, stage: 'load', label: 'RF cap +', note: 'Shorts radio frequency to the shield at the connector.' })
      b.add({ id: 'load.C_rfn', kind: 'C', nodes: ['outn', 'shield'], params: { C: Crf }, stage: 'load', label: 'RF cap −', note: 'Shorts radio frequency to the shield at the connector.' })
    }
    b.add({ id: 'load.R_preamp', kind: 'R', nodes: ['loadp', 'loadn'], params: { R: Rl }, stage: 'load', label: 'R_preamp', note: 'The preamp’s differential input impedance.' })
    // Common-mode path: a real balanced input also has an impedance to its own
    // ground, which is the route through which shield current becomes signal.
    b.add({ id: 'load.R_cmp', kind: 'R', nodes: ['loadp', 'shield'], params: { R: Rl * 50 }, stage: 'load', label: 'CM +', note: 'Common-mode input impedance, hot leg.' })
    b.add({ id: 'load.R_cmn', kind: 'R', nodes: ['loadn', 'shield'], params: { R: Rl * 50 * 1.01 }, stage: 'load', label: 'CM −', note: 'Common-mode input impedance, cold leg — one percent off its partner, as real inputs are.' })
    b.add({ id: 'load.R_shield', kind: 'R', nodes: ['shield', 'gnd'], params: { R: num(v, 'R_shield', 0.1) }, stage: 'load', label: 'R_shield', note: 'Screen resistance plus both solder joints.' })
    ctx.idealOverrides['load.C_cablep'] = { C: 1e-18 }
    ctx.idealOverrides['load.C_cablen'] = { C: 1e-18 }
    ctx.idealOverrides['load.R_preamp'] = { R: 1e9 }
    ctx.idealOverrides['load.R_cmp'] = { R: 1e12 }
    ctx.idealOverrides['load.R_cmn'] = { R: 1e12 }
  },
  derived(v) {
    const Rl = num(v, 'R_preamp', 1500)
    const Ccable = num(v, 'cable_m', 5) * 100e-12
    return [
      {
        key: 'R_preamp',
        label: 'Preamp impedance',
        value: Rl,
        unit: 'Ω',
        format: (x) => eng(x, 'Ω'),
        attachTo: 'R_preamp',
        sentence: (from, to) =>
          `The preamp's input impedance went from ${from} to ${to}. A transformer output will barely notice; a transformerless one will move its bass corner.`,
        why: 'The classic rule is that a preamp should present at least five times the microphone’s source impedance — high enough not to load it, low enough to damp a transformer sensibly. Some preamps make it switchable precisely because the difference is audible on transformer microphones, where the load is reflected back into the primary multiplied by the square of the turns ratio.',
      },
      {
        key: 'f_cable',
        label: 'Cable low-pass (from 200 Ω)',
        value: 1 / (2 * Math.PI * 200 * Math.max(Ccable, 1e-15)),
        unit: 'Hz',
        format: hz,
        attachTo: 'cable_m',
        sentence: (from, to) => `The cable's low-pass corner moved from ${from} to ${to}.`,
        why: 'A hundred picofarads per metre against a 200 Ω source is a corner near 8 MHz at one metre and 160 kHz at fifty — inaudible either way. That is the point of a low output impedance: it makes cable length a non-issue. Try the same cable on the unbalanced electret output, whose source impedance is a kilohm, and the sums change.',
      },
    ]
  },
}
