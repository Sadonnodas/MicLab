import type { Variant } from '../types'
import { num } from '../types'
import { hz } from '../../lib/format'

/**
 * Stage B — polarisation.
 *
 * Puts a fixed charge on the capsule and hands the resulting voltage to the
 * impedance converter. Q = C·V: hold the charge still and let the capacitance
 * move, and the voltage moves with it. That voltage *is* the signal.
 */

const R_POL = {
  key: 'R_pol',
  label: 'Polarisation resistor',
  unit: 'Ω',
  min: 10e6,
  max: 10e9,
  default: 1e9,
  scale: 'log' as const,
  help: 'Feeds charge to the capsule slowly enough that an audio-frequency signal cannot leak away through it. With the capsule capacitance it sets the low-frequency corner of the whole microphone.',
  lesson: 3,
}

const V_POL = {
  key: 'V_pol',
  label: 'Polarisation voltage',
  unit: 'V',
  min: 20,
  max: 120,
  default: 60,
  scale: 'linear' as const,
  help: 'The DC voltage across the capsule. Sensitivity is directly proportional to it: double the volts, double the output, unchanged noise — but real capsules stop at 60–65 V, above which the diaphragm softens and any contamination in the gap starts to discharge. The graph will keep rewarding you past that point; hardware will not.',
  lesson: 2,
}

function polarisationDerived(v: Record<string, number | string>, Ccaps: number, Rgate: number) {
  const Rpol = num(v, 'R_pol', 1e9)
  const Ccouple = num(v, 'C_couple', 1e-9)
  const fPol = 1 / (2 * Math.PI * Rpol * Math.max(Ccaps, 1e-15))
  const fCouple = 1 / (2 * Math.PI * Rgate * Math.max(Ccouple, 1e-15))
  return { Rpol, Ccouple, fPol, fCouple }
}

export const POLARISATION_VARIANTS: Variant[] = [
  {
    id: 'diaphragm',
    stage: 'polarisation',
    name: 'Diaphragm-polarised',
    summary: 'Classic U87 / U47-FET wiring: the diaphragm carries the voltage',
    detail:
      'The polarisation supply charges the diaphragm through the big resistor; the backplate is grounded. Because the diaphragm now sits at 60 V, a coupling capacitor is needed to keep that voltage off the FET gate — and that capacitor, with the gate resistor, adds a second high-pass corner.',
    hardware: 'Blue Jay (U87-style board)',
    params: [
      V_POL,
      R_POL,
      {
        key: 'C_couple',
        label: 'Coupling capacitor',
        unit: 'F',
        min: 100e-12,
        max: 10e-9,
        default: 1e-9,
        scale: 'log',
        help: 'Blocks the 60 V polarisation voltage from the FET gate while letting audio through. It also forms a capacitive divider with the capsule — too small and you lose signal, not just bass.',
        lesson: 3,
      },
    ],
    build(b, v, ctx) {
      b.add({
        id: 'pol.V',
        kind: 'V',
        nodes: ['vpol', 'gnd'],
        params: { V: num(v, 'V_pol', 60) },
        stage: 'polarisation',
        label: 'V_pol',
        note: 'The polarisation supply. In a real mic this comes from a voltage multiplier running off phantom power.',
      })
      b.add({
        id: 'pol.R_pol',
        kind: 'R',
        nodes: ['vpol', 'dia'],
        params: { R: num(v, 'R_pol', 1e9) },
        stage: 'polarisation',
        label: 'R_pol',
        note: 'The gigaohm. Charges the capsule and then gets out of the way.',
      })
      b.add({
        id: 'pol.C_couple',
        kind: 'C',
        nodes: ['dia', 'gate'],
        params: { C: num(v, 'C_couple', 1e-9) },
        stage: 'polarisation',
        label: 'C_couple',
        note: 'DC block between the charged diaphragm and the FET gate.',
      })
      // The backplate is at signal ground in this wiring.
      b.add({
        id: 'pol.backGnd',
        kind: 'R',
        nodes: ['back', 'gnd'],
        params: { R: 1, noiseless: 1 },
        stage: 'polarisation',
        label: 'backplate to ground',
        note: 'The backplate is bonded to the capsule body and therefore to ground.',
      })
      ctx.idealOverrides['pol.R_pol'] = { R: 1e15 }
      ctx.idealOverrides['pol.C_couple'] = { C: 1 }
    },
    derived(v, ctx) {
      const Ccaps = ctx.capsule.Ccaps
      const Rgate = num(ctx.values.converter, 'R_gate', 1e9)
      const { Ccouple, fPol, fCouple } = polarisationDerived(v, Ccaps, Rgate)
      return [
        {
          key: 'V_pol',
          label: 'Polarisation voltage',
          value: num(v, 'V_pol', 60),
          unit: 'V',
          format: (x) => `${x.toFixed(0)} V`,
          attachTo: 'V_pol',
          sentence: (from, to) =>
            `Polarisation voltage ${from} → ${to}. Sensitivity moves in step with it and the noise does not, so this is signal-to-noise for nothing — up to about 65 V. Past that the graph keeps rewarding you and a real capsule does not.`,
          why: 'Q = C·V. The charge stored on the capsule is proportional to the polarisation voltage; the signal is the change in voltage that a change in capacitance produces at constant charge, so it scales with V too.\n\nReal microphones stop around 60–65 V, and it is worth being precise about why. The electrostatic pull between the plates goes as V², and it acts against the diaphragm’s tension — so more volts means a softer diaphragm, a lower resonance and more distortion, ending at the pull-in instability where the diaphragm collapses onto the backplate. What does *not* happen is the air breaking down: Paschen’s law puts that at several hundred volts across a 25 µm gap. The practical failure is contamination — a speck of dust or a film of moisture bridging the gap gives a discharge path, which you hear as crackle and which eventually burns a pinhole through the diaphragm. That is a capsule ruined. The supply itself is fed through a gigaohm and can deliver microamps: it will not hurt you, but it can certainly finish your capsule.',
        },
        {
          key: 'f_hp_pol',
          label: 'Polarisation corner (measured)',
          value: fPol,
          fromSolver: 'stageCorner',
          unit: 'Hz',
          format: hz,
          attachTo: 'R_pol',
          sentence: (from, to) =>
            `The polarisation high-pass moved from ${from} to ${to}. Below that corner the charge leaks away through the resistor faster than the sound can change the capacitance, and the output falls at 6 dB/octave.`,
          why: `R_pol and the capsule capacitance form a high-pass: R·C is the time constant and 1/(2πRC) is the corner. With 55 pF, that arithmetic says ${hz(fPol)} — and the number above is not that number.\n\nThe difference is worth understanding. The textbook formula assumes the capsule is the only capacitance at that node, and it is not: the coupling capacitor, and through it the FET's gate capacitance, hang off the same node and add to it. More capacitance at the same resistance means a lower corner, and in this circuit that is a factor of four or five. So the figure shown is the −3 dB point the solver actually measured on this stage's contribution, not the one on the back of the envelope.\n\nEither way the conclusion holds: with tens of picofarads you need a gigaohm, which is why the polarisation resistor is the most exotic component in a condenser microphone, and why a fingerprint on the board beside it is audible.`,
        },
        {
          key: 'f_hp_couple',
          label: 'Coupling corner',
          value: fCouple,
          unit: 'Hz',
          format: hz,
          attachTo: 'C_couple',
          sentence: (from, to) =>
            `The coupling capacitor's high-pass moved from ${from} to ${to}.`,
          why: 'C_couple works against the gate resistor to make a second high-pass. It also divides the signal: the capsule’s 55 pF against the coupling cap’s 1 nF loses about 0.5 dB, but drop the coupling cap to 100 pF and you throw away a third of the signal at every frequency.',
        },
        {
          key: 'couple_loss',
          label: 'Divider loss',
          value: 20 * Math.log10(Ccouple / (Ccouple + Ccaps)),
          unit: 'dB',
          format: (x) => `${x.toFixed(2)} dB`,
          sentence: (from, to) =>
            `The capacitive divider between capsule and coupling cap now costs ${to} instead of ${from}.`,
          why: 'Two capacitors in series divide a voltage by their ratio — the *smaller* one keeps most of the signal. The capsule is small (55 pF), so the coupling cap has to be much bigger than it for the divider to be harmless.',
        },
      ]
    },
  },
  {
    id: 'backplate',
    stage: 'polarisation',
    name: 'Backplate-polarised',
    summary: 'The voltage sits on the backplate; the diaphragm goes straight to the gate',
    detail:
      'Put the polarisation voltage on the backplate instead and the diaphragm can be wired directly to the FET gate, which is held near 0 V by the gate resistor. No coupling capacitor: one fewer high-pass, one fewer leakage path, one fewer part to go microphonic. The price is that the capsule body and grille now have to be a proper shield, because the highest-impedance node in the microphone is sitting inside them unbuffered.\n\nOne part that is easy to miss on the schematic and impossible to leave out: the backplate needs a capacitor to ground. The polarisation resistor feeds it DC, but for audio the backplate has to be a solid reference — it is the other plate of the capacitor the signal comes from. Leave that bypass off and the gigaohm ends up in series with the signal instead of beside it, and the microphone loses fifty decibels.',
    hardware: 'Raven (U247-style board)',
    params: [
      V_POL,
      R_POL,
      {
        key: 'C_bypass',
        label: 'Backplate bypass capacitor',
        unit: 'F',
        min: 100e-12,
        max: 1e-6,
        default: 10e-9,
        scale: 'log',
        help: 'Holds the backplate at audio ground while the polarisation resistor feeds it DC. Without it the polarisation resistor sits in series with the signal instead of across it.',
        lesson: 3,
      },
    ],
    prepare(b) {
      // The diaphragm *is* the gate node.
      b.alias('dia', 'gate')
    },
    build(b, v, ctx) {
      b.add({
        id: 'pol.V',
        kind: 'V',
        nodes: ['vpol', 'gnd'],
        params: { V: num(v, 'V_pol', 60) },
        stage: 'polarisation',
        label: 'V_pol',
        note: 'The polarisation supply, here feeding the backplate.',
      })
      b.add({
        id: 'pol.R_pol',
        kind: 'R',
        nodes: ['vpol', 'back'],
        params: { R: num(v, 'R_pol', 1e9) },
        stage: 'polarisation',
        label: 'R_pol',
        note: 'Charges the backplate through a gigaohm, so nothing from the supply reaches the capsule.',
      })
      b.add({
        id: 'pol.C_bypass',
        kind: 'C',
        nodes: ['back', 'gnd'],
        params: { C: num(v, 'C_bypass', 10e-9) },
        stage: 'polarisation',
        label: 'C_bypass',
        note: 'Ties the backplate to ground for audio. The signal is the voltage across the capsule, so one of its two plates has to be a fixed reference.',
      })
      ctx.idealOverrides['pol.R_pol'] = { R: 1e15 }
      ctx.idealOverrides['pol.C_bypass'] = { C: 1 }
    },
    derived(v, ctx) {
      const Ccaps = ctx.capsule.Ccaps
      const Rgate = num(ctx.values.converter, 'R_gate', 1e9)
      const fGate = 1 / (2 * Math.PI * Rgate * Math.max(Ccaps, 1e-15))
      const fBypass =
        1 / (2 * Math.PI * num(v, 'R_pol', 1e9) * Math.max(num(v, 'C_bypass', 10e-9), 1e-15))
      return [
        {
          key: 'V_pol',
          label: 'Polarisation voltage',
          value: num(v, 'V_pol', 60),
          unit: 'V',
          format: (x) => `${x.toFixed(0)} V`,
          attachTo: 'V_pol',
          sentence: (from, to) => `Polarisation voltage ${from} → ${to}; sensitivity follows it exactly.`,
          why: 'Q = C·V — see lesson 2. Backplate or diaphragm, it is the same voltage across the same gap.',
        },
        {
          key: 'f_hp_gate',
          label: 'Low-frequency corner (measured)',
          value: fGate,
          fromSolver: 'stageCorner',
          unit: 'Hz',
          format: hz,
          attachTo: 'R_pol',
          sentence: (from, to) =>
            `The microphone's low-frequency corner is at ${to} instead of ${from} — and note that in this wiring it is the *gate* resistor that sets it, not the polarisation resistor.`,
          why: 'This is the surprise of backplate polarisation. The signal node is the diaphragm, which goes straight to the gate, so the resistor working against the capsule capacitance is the gate resistor. The polarisation resistor sits on the backplate, which the bypass capacitor holds at audio ground — it feeds DC and does nothing else. There is no coupling capacitor at all, so this single corner is the whole low end of the microphone.',
        },
        {
          key: 'f_bypass',
          label: 'Backplate bypass corner',
          value: fBypass,
          unit: 'Hz',
          format: hz,
          attachTo: 'C_bypass',
          sentence: (from, to) =>
            `The backplate stops being an audio ground below ${to}, was ${from}.`,
          why: 'The bypass capacitor and the polarisation resistor form a low-pass on the supply side. Below its corner the backplate is no longer a solid reference, the polarisation resistor starts appearing in series with the signal instead of across it, and the output collapses. Keep this corner far below anything you care about.',
        },
      ]
    },
  },
  {
    id: 'electret',
    stage: 'polarisation',
    name: 'Electret (no supply)',
    summary: 'The charge is baked into the capsule; nothing to polarise',
    detail:
      'An electret capsule carries a permanently trapped charge — the equivalent of about 100 V, put there at the factory and held for decades. So there is no polarisation supply and no gigaohm resistor. The mic still needs power, but only for the FET. That is exactly why plug-in power exists: a few volts is enough for a FET and useless for a true condenser.',
    hardware: 'SDC electret build',
    params: [],
    prepare(b) {
      b.alias('dia', 'gate')
    },
    build(b) {
      b.add({
        id: 'pol.backGnd',
        kind: 'R',
        nodes: ['back', 'gnd'],
        params: { R: 1, noiseless: 1 },
        stage: 'polarisation',
        label: 'backplate to ground',
        note: 'The electret backplate is grounded; the charge lives in the electret film itself.',
      })
    },
    derived(_v, ctx) {
      const Rgate = num(ctx.values.converter, 'R_gate', 1e9)
      const f = 1 / (2 * Math.PI * Rgate * Math.max(ctx.capsule.Ccaps, 1e-15))
      return [
        {
          key: 'f_hp_gate',
          label: 'Gate-resistor corner',
          value: f,
          unit: 'Hz',
          format: hz,
          sentence: (from, to) => `The only low-frequency corner in the front end moved from ${from} to ${to}.`,
          why: 'With no polarisation resistor, the gate resistor is the sole DC path at the capsule node, so it — not a polarisation resistor — sets the low-frequency corner together with the capsule capacitance.',
        },
      ]
    },
  },
]

export const polarisationVariant = (id: string): Variant =>
  POLARISATION_VARIANTS.find((v) => v.id === id) ?? POLARISATION_VARIANTS[0]
