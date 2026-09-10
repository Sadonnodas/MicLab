import type { NetlistBuilder } from '../../solver/netlist'
import type { BuildContext, ParamDef, ParamValues } from '../types'
import { num } from '../types'

/**
 * The real-world fault panel.
 *
 * Faults are extra netlist elements and parameter overrides, never sound
 * effects: the hum comes out of the same matrix solve as the signal, so it
 * responds correctly to everything else you change.
 */

export interface Fault {
  id: string
  name: string
  /** What you hear. */
  symptom: string
  /** Why it happens. */
  explanation: string
  params: ParamDef[]
  /** Extra elements and parameter overrides. */
  apply: (b: NetlistBuilder, v: ParamValues, ctx: BuildContext, overrides: Overrides) => void
  /** Extra audio-domain behaviour the linear solve cannot express. */
  audio?: 'gsm-burst' | 'crackle'
}

export type Overrides = Record<string, Record<string, number>>

/** Mains frequency. Belgium. */
export const F_MAINS = 50

const HARMONICS: Array<[number, number]> = [
  [1, 1],
  [3, 0.45],
  [5, 0.25],
  [7, 0.14],
]

export const FAULTS: Fault[] = [
  {
    id: 'floating-body',
    name: 'Capsule body / grille floating',
    symptom: 'A low hum that gets worse when you move your hand near the microphone.',
    explanation:
      'The grille is not decoration — it is the shield around the highest-impedance node in the microphone. Break its path to ground and the mains field couples straight into the capsule through a few femtofarads of air. A few femtofarads is nothing, but the capsule node is a hundred-megohm source, so a nothing of a coupling is enough.',
    params: [
      {
        key: 'C_couple_mains',
        label: 'Coupling to the mains field',
        unit: 'F',
        min: 0.1e-15,
        max: 50e-15,
        default: 2e-15,
        scale: 'log',
        help: 'How much capacitance there is between the mains wiring in the room (and you) and the unshielded capsule node. Femtofarads — and that is plenty, because the node it lands on is a hundred megohms.',
      },
      {
        key: 'R_body',
        label: 'Body-to-ground path',
        unit: 'Ω',
        min: 1,
        max: 1e9,
        default: 10e6,
        scale: 'log',
        help: 'What is left of the grounding path — a dirty thread, a paint film, a screw that was never tightened.',
      },
    ],
    apply(b, v, ctx, overrides) {
      overrides['pol.backGnd'] = { R: num(v, 'R_body', 10e6) }
      b.add({
        id: 'fault.mains',
        kind: 'VAC',
        nodes: ['mains', 'gnd'],
        params: { amplitude: 230, freq: F_MAINS },
        stage: 'fault',
        label: '230 V mains field',
        note: 'The mains wiring in the walls, as seen capacitively from inside the microphone.',
      })
      const C = num(v, 'C_couple_mains', 2e-15)
      b.add({ id: 'fault.Cmains_back', kind: 'C', nodes: ['mains', 'back'], params: { C }, stage: 'fault', label: 'stray to backplate', note: 'Capacitive coupling from the mains field to the unshielded backplate.' })
      b.add({ id: 'fault.Cmains_gate', kind: 'C', nodes: ['mains', 'gate'], params: { C: C / 4 }, stage: 'fault', label: 'stray to gate', note: 'Capacitive coupling from the mains field to the gate node.' })
      void ctx
    },
  },
  {
    id: 'ground-loop',
    name: 'Ground loop on the preamp side',
    symptom: 'Buzz — harmonic-rich, not the smooth hum of a floating capsule.',
    explanation:
      'Two pieces of equipment, two paths to earth, one loop, and mains current circulating in the cable screen. The voltage that current develops along the screen appears between the microphone’s ground and the preamp’s ground — as common mode. A balanced output rejects almost all of it, and what gets through is set by how well matched the two legs are. Switch the output stage to unbalanced and listen to the same fault: that comparison is the entire argument for balanced lines.',
    params: [
      {
        key: 'I_loop',
        label: 'Loop current',
        unit: 'A',
        min: 1e-3,
        max: 2,
        default: 0.3,
        scale: 'log',
        help: 'How much mains current is circulating in the screen. Milliamps in a good installation; amps when two racks are fed from different phases.',
      },
    ],
    apply(b, v) {
      const I = num(v, 'I_loop', 0.3)
      for (const [h, rel] of HARMONICS) {
        b.add({
          id: `fault.loop${h}`,
          kind: 'IAC',
          nodes: ['gnd', 'shield'],
          params: { amplitude: I * rel, freq: F_MAINS * h },
          stage: 'fault',
          label: `${F_MAINS * h} Hz screen current`,
          note: 'Mains current flowing in the cable screen. Its odd harmonics are what makes a ground loop buzz rather than hum.',
        })
      }
    },
  },
  {
    id: 'no-rf-caps',
    name: 'Missing RF filter caps at the XLR',
    symptom: 'The dit-dit-dit of a phone about to ring.',
    explanation:
      'A microphone cable is a fine antenna at 900 MHz. Radio frequency itself is far outside the audio band and would be harmless — except that a semiconductor junction is a rectifier, so the FET demodulates whatever arrives at its gate. What you hear is the envelope: a GSM handset transmits in bursts at 217 per second, which is why the interference is a buzz at 217 Hz and its harmonics rather than a whistle. The cure is two 100 pF capacitors at the connector, shorting radio frequency to the shield before it can reach anything that rectifies.',
    audio: 'gsm-burst',
    params: [
      {
        key: 'field',
        label: 'RF field strength',
        unit: '×',
        min: 0.05,
        max: 4,
        default: 1,
        scale: 'log',
        help: 'How close the phone is. The demodulated level rises roughly with the square of the field.',
      },
    ],
    apply(b, v, _ctx, overrides) {
      overrides['load.C_rfp'] = { C: 1e-18 }
      overrides['load.C_rfn'] = { C: 1e-18 }
      // The rectified envelope, injected where the rectification happens: the gate.
      const amp = 5e-12 * num(v, 'field', 1) ** 2
      for (const [h, rel] of [[1, 1], [2, 0.6], [3, 0.4], [4, 0.25]] as Array<[number, number]>) {
        b.add({
          id: `fault.gsm${h}`,
          kind: 'IAC',
          nodes: ['gnd', 'gate'],
          params: { amplitude: amp * rel, freq: 217 * h },
          stage: 'fault',
          label: `${217 * h} Hz demodulated RF`,
          note: 'The audio-band remains of a radio signal the FET rectified. Modelled as a current into the gate, because that is where the rectifying junction is.',
        })
      }
    },
  },
  {
    id: 'cold-solder',
    name: 'Cold solder joint on the shield',
    symptom: 'Crackle, and hum that comes and goes when you wiggle the cable.',
    explanation:
      'A dull, grainy solder joint is not a connection, it is a variable resistor made of tin oxide. It turns the shield from a screen into a partial antenna, and because its resistance changes as the cable moves, the hum it lets through changes with it. The crackle is the joint making and breaking contact.\n\nHow much you actually hear depends entirely on the output stage. On the unbalanced output it is unbearable. On the balanced one it is a quiet crackly hum. On the transformer output it is silent, because the two windings share no copper and nothing on the screen has any route into the signal at all — which is the strongest possible argument for transformers, and the reason they survived the transistor.',
    audio: 'crackle',
    params: [
      {
        key: 'R_joint',
        label: 'Joint resistance',
        unit: 'Ω',
        min: 1,
        max: 5000,
        default: 500,
        scale: 'log',
        help: 'What the joint actually measures. A good one is milliohms.',
      },
    ],
    apply(b, v, _ctx, overrides) {
      overrides['load.R_shield'] = { R: num(v, 'R_joint', 500) }
      // Even without a ground loop, a mains field induces some current in the screen.
      for (const [h, rel] of HARMONICS) {
        b.add({
          id: `fault.cold${h}`,
          kind: 'IAC',
          nodes: ['gnd', 'shield'],
          params: { amplitude: 5e-3 * rel, freq: F_MAINS * h },
          stage: 'fault',
          label: `${F_MAINS * h} Hz induced screen current`,
          note: 'Small mains current induced in the screen by the fields in the room.',
        })
      }
    },
  },
  {
    id: 'stray',
    name: 'Too much stray capacitance',
    symptom: 'Quieter, and slightly duller.',
    explanation:
      'Long gate wiring, a fat solder blob, a PCB without a guard ring, or simply humidity on the board. Every picofarad is a divider against the capsule’s 55 pF, and unlike almost everything else in a microphone, what it takes away it never gives back: the signal drops and the noise that follows does not.',
    params: [
      {
        key: 'C_stray_bad',
        label: 'Stray capacitance',
        unit: 'F',
        min: 10e-12,
        max: 100e-12,
        default: 40e-12,
        scale: 'log',
        help: 'The total capacitance from the gate node to everything around it.',
      },
    ],
    apply(_b, v, _ctx, overrides) {
      overrides['conv.C_stray'] = { C: num(v, 'C_stray_bad', 40e-12) }
    },
  },
  {
    id: 'leaky-pol',
    name: 'Leaky polarisation (dirty PCB)',
    symptom: 'Thin bass, more hiss, and less output than it should have.',
    explanation:
      'Flux residue and humidity are resistors. A film of them across the polarisation network puts a few hundred megohms in parallel with the gigaohm, which does three things at once: it raises the low-frequency corner, it adds its own thermal noise, and — because it forms a DC divider with the polarisation resistor — it pulls the actual voltage on the capsule down, so the microphone gets quieter too. This is why boards get washed and conformally coated.',
    params: [
      {
        key: 'R_leak',
        label: 'Leakage resistance',
        unit: 'Ω',
        min: 1e6,
        max: 5e9,
        default: 500e6,
        scale: 'log',
        help: 'The resistance of the contamination film from the capsule node to ground.',
      },
    ],
    apply(b, v) {
      b.add({
        id: 'fault.R_leak',
        kind: 'R',
        nodes: ['dia', 'gnd'],
        params: { R: num(v, 'R_leak', 500e6) },
        stage: 'fault',
        label: 'PCB leakage',
        note: 'Contamination across the board, in parallel with everything at the capsule node.',
      })
    },
  },
]

export const faultById = (id: string): Fault | undefined => FAULTS.find((f) => f.id === id)
