import type { Variant, ParamDef, ParamValues } from '../types'
import { num, str } from '../types'
import { JFET_MODELS, jfetById } from '../../solver/jfet'
import { eng, hz } from '../../lib/format'
import type { NetlistBuilder } from '../../solver/netlist'
import type { BuildContext } from '../types'

/**
 * Stage C — the impedance converter.
 *
 * The capsule is a 55 pF source: at 20 Hz that is a 145 MΩ impedance, and any
 * ordinary load would simply short it out. The JFET's gate draws essentially no
 * current, so it can look at that voltage without disturbing it, and copies it
 * onto a node that can actually drive something.
 */

const JFET_PARAM: ParamDef = {
  key: 'jfet',
  label: 'JFET',
  unit: '',
  min: 0,
  max: 0,
  default: 0,
  scale: 'linear',
  kind: 'enum',
  enumOptions: JFET_MODELS.map((m) => ({ value: m.id, label: m.name })),
  enumDefault: '2SK170',
  help: 'Which transistor is on the board. Idss and pinch-off set where it biases; the gate capacitance loads the capsule; the channel noise sets the hiss floor.',
  lesson: 6,
}

const SPREAD: ParamDef = {
  key: 'spread',
  label: 'Device spread (Idss)',
  unit: '×',
  min: 0.5,
  max: 1.5,
  default: 1,
  scale: 'linear',
  help: 'JFETs vary wildly from unit to unit — ±50 % on Idss is normal. This is why people buy fifty and match them.',
  lesson: 6,
}

const C_STRAY: ParamDef = {
  key: 'C_stray',
  label: 'Stray capacitance at the gate',
  unit: 'F',
  min: 0,
  max: 50e-12,
  default: 5e-12,
  scale: 'linear',
  help: 'Everything near the gate — wire, pad, solder blob, your finger — adds capacitance in parallel with the capsule. It is a straight divider against the capsule’s own 55 pF.',
  lesson: 5,
}

const R_GATE: ParamDef = {
  key: 'R_gate',
  label: 'Gate resistor',
  unit: 'Ω',
  min: 10e6,
  max: 10e9,
  default: 1e9,
  scale: 'log',
  help: 'Holds the gate at a defined DC voltage. It has to be enormous for the same reason R_pol does: anything smaller drains the signal away.',
  lesson: 6,
}

const V_DD: ParamDef = {
  key: 'V_dd',
  label: 'Supply rail',
  unit: 'V',
  min: 5,
  max: 30,
  default: 12,
  scale: 'linear',
  help: 'The DC rail the stage runs from, derived from phantom power inside the mic. It sets how much headroom the drain has.',
  lesson: 6,
}

const R_S: ParamDef = {
  key: 'R_s',
  label: 'Source resistor',
  unit: 'Ω',
  min: 100,
  max: 22e3,
  default: 1.5e3,
  scale: 'log',
  help: 'Sets the bias: the drain current through it makes the source positive, so the gate sits negative relative to the source. Unbypassed it also sets the gain.',
  lesson: 7,
}

const C_S: ParamDef = {
  key: 'C_s',
  label: 'Source bypass capacitor',
  unit: 'F',
  min: 1e-9,
  max: 470e-6,
  default: 100e-6,
  scale: 'log',
  help: 'Shorts the source resistor for audio, so the stage gets its full gain. Its corner with R_s decides where that gain arrives.',
  lesson: 7,
}

const R_D: ParamDef = {
  key: 'R_d',
  label: 'Drain resistor',
  unit: 'Ω',
  min: 470,
  max: 47e3,
  default: 4.7e3,
  scale: 'log',
  help: 'Turns the FET’s drain current into a voltage. Gain is roughly gm × R_d — but a bigger R_d also drops more DC, so the bias moves.',
  lesson: 7,
}

function addJfet(b: NetlistBuilder, v: ParamValues, ctx: BuildContext, id = 'conv.J') {
  const model = jfetById(str(v, 'jfet', '2SK170'))
  const spread = num(v, 'spread', 1)
  const Idss = model.Idss * spread
  b.add({
    id,
    kind: 'JFET',
    nodes: ['drn', 'gate', 'src'],
    params: {
      beta: Idss / (model.Vp * model.Vp),
      Vp: model.Vp,
      lambda: model.lambda,
      Cgs: model.Cgs,
      Cgd: model.Cgd,
      Igss: model.Igss,
      KF: model.KF,
      Idss,
    },
    stage: 'converter',
    label: model.name,
    note: model.note,
  })
  ctx.idealOverrides[id] = { Cgs: 1e-18, Cgd: 1e-18 }
  b.add({
    id: 'conv.C_stray',
    kind: 'C',
    nodes: ['gate', 'gnd'],
    params: { C: Math.max(num(v, 'C_stray', 5e-12), 1e-18) },
    stage: 'converter',
    label: 'C_stray',
    note: 'Wiring and PCB capacitance at the gate node.',
  })
  ctx.idealOverrides['conv.C_stray'] = { C: 1e-18 }
  b.add({
    id: 'conv.V_dd',
    kind: 'V',
    nodes: ['vdd', 'gnd'],
    params: { V: num(v, 'V_dd', 12) },
    stage: 'converter',
    label: 'V_dd',
    note: 'The internal supply rail.',
  })
  ctx.vdd = num(v, 'V_dd', 12)
  return model
}

function strayLoss(v: ParamValues, ctx: BuildContext): number {
  const model = jfetById(str(v, 'jfet', '2SK170'))
  const Cc = ctx.capsule.Ccaps
  const Cs = num(v, 'C_stray', 5e-12) + model.Cgs
  return 20 * Math.log10(Cc / (Cc + Cs))
}

function commonDerived(v: ParamValues, ctx: BuildContext) {
  const Rgate = num(v, 'R_gate', 1e9)
  const fGate = 1 / (2 * Math.PI * Rgate * Math.max(ctx.capsule.Ccaps, 1e-15))
  return [
    {
      key: 'stray_loss',
      label: 'Stray-capacitance loss',
      value: strayLoss(v, ctx),
      unit: 'dB',
      format: (x: number) => `${x.toFixed(2)} dB`,
      attachTo: 'C_stray',
      sentence: (from: string, to: string) =>
        `The capacitive divider at the gate now costs ${to} instead of ${from} — at every frequency, evenly.`,
      why: 'The capsule is a 55 pF source. Any capacitance you put in parallel with it forms a divider: C_caps/(C_caps + C_stray). Ten picofarads of badly routed wire is a decibel of signal thrown away before anything has amplified it, and you never get it back — the noise that follows is unchanged. This is why the FET sits millimetres from the capsule, why the gate track is short, and why good boards have a guard ring around it.',
    },
    {
      key: 'f_hp_gate',
      label: 'Gate-resistor corner',
      value: fGate,
      unit: 'Hz',
      format: hz,
      attachTo: 'R_gate',
      sentence: (from: string, to: string) => `The gate resistor's corner moved from ${from} to ${to}.`,
      why: 'The gate resistor is a DC path to ground at the highest-impedance node in the microphone. Together with whatever capacitance sits there it makes a high-pass, and its thermal noise current flows straight into the signal.',
    },
  ]
}

function gainDerived(v: ParamValues, _ctx: BuildContext, mode: 'cs' | 'follower') {
  const Rs = num(v, 'R_s', 1.5e3)
  const Cs = num(v, 'C_s', 100e-6)
  const fBypass = Cs > 0 ? 1 / (2 * Math.PI * Rs * Cs) : 0
  const out = [] as ReturnType<typeof commonDerived>
  if (mode === 'cs') {
    out.push({
      key: 'f_bypass',
      label: 'Bypass corner',
      value: fBypass,
      unit: 'Hz',
      format: hz,
      attachTo: 'C_s',
      sentence: (from: string, to: string) =>
        `The source bypass corner moved from ${from} to ${to}. Above it the stage has its full gain; below it the source resistor fights back and the gain drops.`,
      why: 'An unbypassed source resistor is negative feedback: when the drain current rises, the source voltage rises with it, which reduces V_gs and pushes the current back down. The bypass capacitor removes that feedback for audio — but only above 1/(2πR_s·C_s). Undersize it and you have accidentally built a bass roll-off.',
    })
  }
  out.push({
    key: 'stage_gain',
    label: mode === 'cs' ? 'Stage gain (gm·R_d)' : 'Stage gain',
    value: 0, // filled in from the solver's operating point
    unit: 'dB',
    format: (x: number) => `${x.toFixed(1)} dB`,
    sentence: (from: string, to: string) => `Stage gain ${from} → ${to}.`,
    why:
      mode === 'cs'
        ? 'A common-source stage turns a gate voltage into a drain current (that is gm) and then back into a voltage across the drain resistor. Gain is gm·R_d, inverted.'
        : 'A source follower has a gain just under one. It gives you no voltage at all — what it gives you is the ability to drive a load, which the capsule could never do.',
    attachTo: mode === 'cs' ? 'R_d' : 'R_s',
  })
  return out
}

const CS_PARAMS = [JFET_PARAM, SPREAD, R_GATE, C_STRAY, R_S, C_S, R_D, V_DD]

export const CONVERTER_VARIANTS: Variant[] = [
  {
    id: 'cs-deemph',
    stage: 'converter',
    name: 'Common-source, de-emphasised',
    summary: 'Gain, with the top end pulled back down — the U87 answer to the K67 capsule',
    detail:
      'A common-source stage with a series resistor and capacitor from the drain back to the source. The capacitor’s impedance falls with frequency, so the higher you go the more the network loads the drain and the more gain the stage gives away — a shelf, pulled down at exactly the frequencies where the K67 capsule has too much. Same capsule, different board, different microphone.\n\nNote that the network returns to the *source*, not the gate. Hang a 47 kΩ resistor off the gate node and you have connected a thermal-noise generator to a hundred-megohm node: the microphone gets about 25 dB noisier and loses most of its signal to the loading. Feedback always goes back to a low-impedance node.',
    hardware: 'Blue Jay (U87-style board)',
    params: [
      ...CS_PARAMS,
      {
        key: 'R_fb',
        label: 'De-emphasis resistor',
        unit: 'Ω',
        min: 220,
        max: 47e3,
        default: 1e3,
        scale: 'log',
        help: 'Sets how hard the network loads the drain at high frequencies, and therefore how much top end comes back off.',
        lesson: 8,
      },
      {
        key: 'C_fb',
        label: 'De-emphasis capacitor',
        unit: 'F',
        min: 1e-9,
        max: 220e-9,
        default: 22e-9,
        scale: 'log',
        help: 'Decides where the cut starts. Bigger capacitor, lower turnover, more of the spectrum pulled down.',
        lesson: 8,
      },
    ],
    build(b, v, ctx) {
      addJfet(b, v, ctx)
      b.add({ id: 'conv.R_gate', kind: 'R', nodes: ['gate', 'gnd'], params: { R: num(v, 'R_gate', 1e9) }, stage: 'converter', label: 'R_gate', note: 'Holds the gate at 0 V DC.' })
      b.add({ id: 'conv.R_s', kind: 'R', nodes: ['src', 'gnd'], params: { R: num(v, 'R_s', 1.5e3) }, stage: 'converter', label: 'R_s', note: 'Sets the bias current, and the gain when unbypassed.' })
      b.add({ id: 'conv.C_s', kind: 'C', nodes: ['src', 'gnd'], params: { C: num(v, 'C_s', 100e-6) }, stage: 'converter', label: 'C_s', note: 'Bypasses the source resistor for audio.' })
      b.add({ id: 'conv.R_d', kind: 'R', nodes: ['vdd', 'drn'], params: { R: num(v, 'R_d', 4.7e3) }, stage: 'converter', label: 'R_d', note: 'Turns drain current into output voltage.' })
      b.add({ id: 'conv.R_fb', kind: 'R', nodes: ['drn', 'fb'], params: { R: num(v, 'R_fb', 1e3) }, stage: 'converter', label: 'R_fb', note: 'De-emphasis resistor. At high frequencies it ends up in parallel with R_d and the gain drops.' })
      b.add({ id: 'conv.C_fb', kind: 'C', nodes: ['fb', 'src'], params: { C: num(v, 'C_fb', 22e-9) }, stage: 'converter', label: 'C_fb', note: 'De-emphasis capacitor — the part that makes the network frequency-dependent. It returns to the source, the low-impedance node.' })
      ctx.idealOverrides['conv.R_gate'] = { R: 1e15 }
      ctx.idealOverrides['conv.C_s'] = { C: 1 }
      ctx.idealOverrides['conv.R_fb'] = { R: 1e15 }
      ctx.converterOut = 'drn'
    },
    derived(v, ctx) {
      const Rfb = num(v, 'R_fb', 1e3)
      const Cfb = num(v, 'C_fb', 22e-9)
      const Rd = num(v, 'R_d', 4.7e3)
      return [
        ...commonDerived(v, ctx),
        ...gainDerived(v, ctx, 'cs'),
        {
          key: 'f_deemph',
          label: 'De-emphasis turnover',
          value: 1 / (2 * Math.PI * (Rfb + Rd) * Cfb),
          unit: 'Hz',
          format: hz,
          attachTo: 'C_fb',
          sentence: (from, to) =>
            `The de-emphasis turnover moved from ${from} to ${to} — that is where the network starts taking the top end back.`,
          why: 'The network is a resistor and a capacitor in series from the drain back to the source. At low frequencies the capacitor is a large impedance and the network is not there. Above 1/(2π(R_fb+R_d)·C_fb) the capacitor stops mattering and R_fb sits in parallel with the drain resistor, so the gain settles at a lower value and stays there. The result is a shelf, not a slope — and a shelf is exactly the right shape for cancelling a capsule’s presence bump.',
        },
        {
          key: 'deemph_depth',
          label: 'Drain load above the turnover',
          value: 20 * Math.log10(Rfb / (Rfb + Rd)),
          unit: 'dB',
          format: (x) => `${x.toFixed(1)} dB`,
          attachTo: 'R_fb',
          sentence: (from, to) =>
            `Above the turnover the network now loads the drain down by ${to} instead of ${from} — though you will see less than that on the graph, for a reason worth knowing.`,
          why: 'Above the turnover the de-emphasis resistor sits in parallel with the drain resistor, so the raw stage gain falls by R_fb/(R_fb + R_d). The graph never shows the whole of that, and the reason is the Miller effect: the gate sees the drain–gate capacitance multiplied by (1 + gain), so when you take gain away you also take away input capacitance, the capsule is loaded less, and some of the loss comes straight back. The two effects fight, which is why the de-emphasis on a real board is always tuned by ear or by sweep rather than calculated — and why this circuit needs a much bigger capacitor than the arithmetic alone suggests.',
        },
      ]
    },
  },
  {
    id: 'cs-plain',
    stage: 'converter',
    name: 'Common-source, no de-emphasis',
    summary: 'The same stage with the feedback network left off — the capsule speaks for itself',
    detail:
      'U47-FET and U247-style boards do not de-emphasise. Whatever the capsule does at the top comes through untouched, which is why these boards sound forward and airy on a K67 and can sound harsh on a bright source.',
    hardware: 'Raven (U247-style board)',
    params: CS_PARAMS,
    build(b, v, ctx) {
      addJfet(b, v, ctx)
      b.add({ id: 'conv.R_gate', kind: 'R', nodes: ['gate', 'gnd'], params: { R: num(v, 'R_gate', 1e9) }, stage: 'converter', label: 'R_gate', note: 'Holds the gate at 0 V DC.' })
      b.add({ id: 'conv.R_s', kind: 'R', nodes: ['src', 'gnd'], params: { R: num(v, 'R_s', 1.5e3) }, stage: 'converter', label: 'R_s', note: 'Sets the bias current.' })
      b.add({ id: 'conv.C_s', kind: 'C', nodes: ['src', 'gnd'], params: { C: num(v, 'C_s', 100e-6) }, stage: 'converter', label: 'C_s', note: 'Bypasses the source resistor for audio.' })
      b.add({ id: 'conv.R_d', kind: 'R', nodes: ['vdd', 'drn'], params: { R: num(v, 'R_d', 4.7e3) }, stage: 'converter', label: 'R_d', note: 'Turns drain current into output voltage.' })
      ctx.idealOverrides['conv.R_gate'] = { R: 1e15 }
      ctx.idealOverrides['conv.C_s'] = { C: 1 }
      ctx.converterOut = 'drn'
    },
    derived(v, ctx) {
      return [...commonDerived(v, ctx), ...gainDerived(v, ctx, 'cs')]
    },
  },
  {
    id: 'follower',
    stage: 'converter',
    name: 'Source follower',
    summary: 'Gain of one, very linear, very low output impedance',
    detail:
      'Drain straight to the rail, output taken from the source. The gain is just under unity, so this stage adds nothing but the ability to drive a cable — which is the whole job of an impedance converter. Schoeps-style small-diaphragm circuits work this way and rely on a transformer or a following stage for level.',
    hardware: 'Schoeps-style small-diaphragm circuits',
    params: [JFET_PARAM, SPREAD, R_GATE, C_STRAY, R_S, V_DD],
    build(b, v, ctx) {
      addJfet(b, v, ctx)
      b.add({ id: 'conv.R_gate', kind: 'R', nodes: ['gate', 'gnd'], params: { R: num(v, 'R_gate', 1e9) }, stage: 'converter', label: 'R_gate', note: 'Holds the gate at 0 V DC.' })
      b.add({ id: 'conv.R_s', kind: 'R', nodes: ['src', 'gnd'], params: { R: num(v, 'R_s', 2.2e3) }, stage: 'converter', label: 'R_s', note: 'Sets the bias current; the output is taken across it.' })
      b.add({ id: 'conv.R_d', kind: 'R', nodes: ['vdd', 'drn'], params: { R: 1, noiseless: 1 }, stage: 'converter', label: 'drain to rail', note: 'The drain goes straight to the supply in a follower.' })
      ctx.idealOverrides['conv.R_gate'] = { R: 1e15 }
      ctx.converterOut = 'src'
    },
    derived(v, ctx) {
      return [...commonDerived(v, ctx), ...gainDerived(v, ctx, 'follower')]
    },
  },
  {
    id: 'bootstrap',
    stage: 'converter',
    name: 'Bootstrapped source follower',
    summary: 'A follower that hides its own gate resistor',
    detail:
      'Split the gate resistor and drive the bottom of it from the source through a capacitor. The source follows the gate almost exactly, so both ends of the big resistor move together — and a resistor with the same voltage at both ends carries no current. The gate resistor effectively becomes tens of gigaohms: lower corner frequency, and less of its thermal noise reaching the signal. Elegant, cheap, and completely invisible on a schematic unless you know what you are looking at.',
    params: [
      JFET_PARAM,
      SPREAD,
      R_GATE,
      {
        key: 'R_gate2',
        label: 'Bootstrap return resistor',
        unit: 'Ω',
        min: 1e6,
        max: 100e6,
        default: 10e6,
        scale: 'log',
        help: 'The lower half of the split gate resistor. It sets the DC path to ground; the bootstrap capacitor keeps audio off it.',
        lesson: 6,
      },
      {
        key: 'C_boot',
        label: 'Bootstrap capacitor',
        unit: 'F',
        min: 10e-9,
        max: 47e-6,
        default: 1e-6,
        scale: 'log',
        help: 'Couples the source signal to the bottom of the gate resistor, so both ends move together and no signal current flows through it.',
        lesson: 6,
      },
      C_STRAY,
      R_S,
      V_DD,
    ],
    build(b, v, ctx) {
      addJfet(b, v, ctx)
      b.add({ id: 'conv.R_gate', kind: 'R', nodes: ['gate', 'boot'], params: { R: num(v, 'R_gate', 1e9) }, stage: 'converter', label: 'R_gate', note: 'The upper half of the split gate resistor.' })
      b.add({ id: 'conv.R_gate2', kind: 'R', nodes: ['boot', 'gnd'], params: { R: num(v, 'R_gate2', 10e6) }, stage: 'converter', label: 'R_gate2', note: 'DC return for the gate.' })
      b.add({ id: 'conv.C_boot', kind: 'C', nodes: ['src', 'boot'], params: { C: num(v, 'C_boot', 1e-6) }, stage: 'converter', label: 'C_boot', note: 'Bootstraps the gate resistor from the source.' })
      b.add({ id: 'conv.R_s', kind: 'R', nodes: ['src', 'gnd'], params: { R: num(v, 'R_s', 2.2e3) }, stage: 'converter', label: 'R_s', note: 'Sets the bias current; the output is taken across it.' })
      b.add({ id: 'conv.R_d', kind: 'R', nodes: ['vdd', 'drn'], params: { R: 1, noiseless: 1 }, stage: 'converter', label: 'drain to rail', note: 'The drain goes straight to the supply in a follower.' })
      ctx.idealOverrides['conv.R_gate'] = { R: 1e15 }
      ctx.idealOverrides['conv.C_boot'] = { C: 1 }
      ctx.converterOut = 'src'
    },
    derived(v, ctx) {
      const Rgate = num(v, 'R_gate', 1e9)
      // A follower's gain is a hair under 1; the bootstrap multiplies the gate
      // resistance by 1/(1 − A), so the effective value is very sensitive to it.
      const A = 0.95
      const effective = Rgate / (1 - A)
      return [
        ...commonDerived(v, ctx),
        {
          key: 'R_gate_eff',
          label: 'Effective gate resistance',
          value: effective,
          unit: 'Ω',
          format: (x) => eng(x, 'Ω'),
          attachTo: 'C_boot',
          sentence: (from, to) =>
            `Bootstrapping makes the gate resistor look like ${to} instead of ${from}.`,
          why: 'If both ends of a resistor move by the same voltage, no current flows through it — so as far as the signal is concerned it is not there. A source follower has a gain of about 0.95, so the bottom of the resistor follows the top to within 5 %, and the resistor looks about twenty times bigger than it is. Lower corner, and less thermal noise current into the gate.',
        },
        ...gainDerived(v, ctx, 'follower'),
      ]
    },
  },
]

export const converterVariant = (id: string): Variant =>
  CONVERTER_VARIANTS.find((v) => v.id === id) ?? CONVERTER_VARIANTS[0]
