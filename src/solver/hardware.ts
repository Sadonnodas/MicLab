import type { Netlist } from './netlist'
import type { OpResult } from './op'
import type { JfetOp } from './jfet'

/**
 * The numbers you need before you solder anything.
 *
 * None of this changes the sound. All of it decides whether a real build works,
 * survives, or quietly destroys a capsule — so it is separated out here and
 * shown on the operating-point tab rather than buried.
 */

/** IEC 61938 P48: 48 V through 6.81 kΩ in each leg, both legs in parallel. */
export const PHANTOM_VOLTS = 48
export const PHANTOM_SOURCE_OHMS = 6810 / 2
/** The standard allows a microphone to draw no more than this. */
export const PHANTOM_MAX_CURRENT = 10e-3

/**
 * Above this a capsule is being over-polarised. The electrostatic pull goes as
 * V² and works against the diaphragm's tension, so the diaphragm softens, the
 * resonance drops and distortion rises — and any contamination in the gap
 * becomes a discharge path that eventually burns a pinhole through it. (Clean
 * air across a 25 µm gap needs several hundred volts to break down, so the gap
 * itself is never the problem; the dust in it is.) Real designs stop at
 * 60–65 V. This is not a modelling limit, it is a hardware one.
 */
export const CAPSULE_MAX_POLARISATION = 65

export interface SupplyReport {
  /** Rail the stage runs from. */
  vdd: number
  /**
   * DC current the impedance converter draws from that rail.
   *
   * This is the converter only. The polarisation multiplier and, on a real
   * board, the output stage draw their own current on top — typically another
   * one to three milliamps — and neither is modelled here, so treat this as a
   * floor rather than a total.
   */
  current: number
  /** What phantom power can actually deliver at that rail voltage. */
  available: number
  /** The rail voltage phantom would sag to at this current. */
  phantomRail: number
  ok: boolean
  warning?: string
}

export interface HeadroomReport {
  /** Estimated maximum SPL before something clips, dB SPL. */
  maxSpl: number
  limitedBy: string
  explanation: string
  /** Volts of swing available at the gate and at the output node. */
  gateMargin: number
  outputMargin: number
}

export interface StressItem {
  id: string
  label: string
  kind: 'C' | 'R'
  /** DC volts across the part. */
  volts: number
  /** DC power dissipated in it. */
  watts: number
  /** Suggested minimum voltage rating, at roughly twice the DC stress. */
  ratingHint?: number
  /** True where the DC has a defined polarity and an electrolytic must follow it. */
  polarised?: boolean
}

/**
 * Can phantom power actually run this? The mic's regulator has to drop from the
 * phantom rail to V_dd, and the phantom rail sags with the current drawn.
 */
export function supplyReport(nl: Netlist, op: OpResult): SupplyReport | null {
  const vddEl = nl.elements.find((e) => e.id === 'conv.V_dd')
  if (!vddEl) return null
  const vdd = vddEl.params.V
  // The branch current of a voltage source is the current leaving its + node.
  const current = Math.abs(op.branchCurrents['conv.V_dd'] ?? 0)
  const available = Math.max((PHANTOM_VOLTS - vdd) / PHANTOM_SOURCE_OHMS, 0)
  const phantomRail = PHANTOM_VOLTS - current * PHANTOM_SOURCE_OHMS

  let warning: string | undefined
  let ok = true
  if (current > PHANTOM_MAX_CURRENT) {
    ok = false
    warning = `This stage draws ${(current * 1000).toFixed(1)} mA. Phantom power is only required to supply 10 mA, and at that current a 48 V supply has already sagged to about ${phantomRail.toFixed(1)} V. A real build would misbehave or refuse to start.`
  } else if (phantomRail < vdd + 1) {
    ok = false
    warning = `At ${(current * 1000).toFixed(2)} mA the phantom rail sags to about ${phantomRail.toFixed(1)} V, which is not enough headroom above the ${vdd.toFixed(0)} V this stage wants. Lower V_dd or draw less current.`
  } else if (current > PHANTOM_MAX_CURRENT * 0.5) {
    warning = `The converter alone draws ${(current * 1000).toFixed(1)} mA, half the 10 mA phantom budget, before the polarisation multiplier and the output stage have taken their share. Neither of those is modelled here, so check the real total against the standard before you build.`
  }
  return { vdd, current, available, phantomRail, ok, warning }
}

export interface HeadroomInput {
  op: OpResult
  fetOp: JfetOp
  fetId: string
  nl: Netlist
  /** Signal volts per pascal at each node, from a 1 kHz AC solve. */
  perPascal: Record<string, number>
  /** Node the output stage takes its signal from. */
  outNode: string
  vdd: number
}

const P_REF = 20e-6

/**
 * Estimate the SPL at which the stage stops behaving linearly.
 *
 * The solver is linear, so it cannot show clipping — it will happily draw a
 * beautiful curve for a circuit that distorts at 95 dB SPL. This works out how
 * far each node can actually swing from the operating point and reports the
 * first thing to run out of room. It is an estimate from the small-signal
 * model, not a transient simulation, so treat it as an order of magnitude.
 */
export function headroomReport(i: HeadroomInput): HeadroomReport | null {
  const { fetOp, perPascal, vdd } = i
  const vov = fetOp.Vgs - (i.nl.elements.find((e) => e.id === i.fetId)?.params.Vp ?? -1)
  if (fetOp.region !== 'sat' || vov <= 0) return null

  const gateSig = Math.abs(perPascal.gate ?? 0)
  const outSig = Math.abs(perPascal[i.outNode] ?? 0)

  // V_gs must stay between pinch-off and roughly zero (a forward-biased gate
  // junction is the classic condenser overload, and it rectifies).
  const gateDown = vov // towards pinch-off
  const gateUp = Math.max(-fetOp.Vgs, 0) // towards a conducting gate junction
  const gateMargin = Math.min(gateDown, gateUp)

  // The output node has to stay inside the rails, and the drain has to stay in
  // saturation (V_ds above V_ov).
  const vOut = i.op.v[i.nl.nodeNames[i.outNode] ?? 0] ?? 0
  const outUp = Math.max(vdd - vOut, 0)
  const outDown = Math.max(i.outNode === 'drn' ? fetOp.Vds - vov : vOut, 0)
  const outputMargin = Math.min(outUp, outDown)

  const candidates: Array<{ pa: number; by: string; why: string }> = []
  if (gateSig > 0) {
    candidates.push({
      pa: gateMargin / gateSig,
      by: gateDown < gateUp ? 'the FET pinching off' : 'the gate junction conducting',
      why:
        gateDown < gateUp
          ? `V_gs sits ${(vov * 1000).toFixed(0)} mV above pinch-off, so a loud enough sound drives the FET into cut-off on one half of the waveform. More bias current (a smaller source resistor) buys headroom here.`
          : `V_gs sits only ${(gateUp * 1000).toFixed(0)} mV below zero, so a loud enough sound forward-biases the gate junction — which then rectifies, and the microphone produces a thump rather than distortion.`,
    })
  }
  if (outSig > 0) {
    candidates.push({
      pa: outputMargin / outSig,
      by: outUp < outDown ? 'the output hitting the supply rail' : 'the FET leaving saturation',
      why:
        outUp < outDown
          ? `The drain sits only ${outUp.toFixed(2)} V below the supply, so it clips against the rail on the positive half. A larger drain resistor drops more DC and moves the operating point down away from the rail.`
          : `The drain has ${outDown.toFixed(2)} V before V_ds falls to V_ov and the FET leaves saturation.`,
    })
  }
  if (candidates.length === 0) return null

  candidates.sort((a, b) => a.pa - b.pa)
  const worst = candidates[0]
  // Peak volts of margin against a sine: r.m.s. pressure is peak/√2.
  const paRms = worst.pa / Math.SQRT2
  return {
    maxSpl: 20 * Math.log10(Math.max(paRms, 1e-9) / P_REF),
    limitedBy: worst.by,
    explanation: worst.why,
    gateMargin,
    outputMargin,
  }
}

/** DC voltage and power on every part, so you can choose ratings. */
export function stressReport(nl: Netlist, op: OpResult): StressItem[] {
  const V = (n: number) => (n === 0 ? 0 : (op.v[n] ?? 0))
  const out: StressItem[] = []
  for (const el of nl.elements) {
    if (el.kind !== 'C' && el.kind !== 'R') continue
    if (el.params.noiseless) continue
    if (el.stage === 'fault') continue
    const dv = V(el.nodes[0]) - V(el.nodes[1])
    if (el.kind === 'C') {
      if (Math.abs(dv) < 0.05) continue
      // The capsule is not a part you buy, and neither is cable capacitance.
      if (el.id === 'capsule.C' || el.stage === 'load') continue
      const isElectrolytic = el.params.C >= 1e-6
      out.push({
        id: el.id,
        label: el.label ?? el.id,
        kind: 'C',
        volts: dv,
        watts: 0,
        // Electrolytics want real derating; a film or ceramic part at 1.5× the
        // DC stress is ordinary practice — which is why a 60 V polarisation
        // node gets a 100 V film capacitor rather than a 160 V one.
        ratingHint: nextStandardRating(Math.abs(dv) * (isElectrolytic ? 2 : 1.5)),
        // Only worth mentioning where the part would actually be an electrolytic.
        polarised: isElectrolytic && Math.abs(dv) > 0.5,
      })
    } else {
      const w = (dv * dv) / Math.max(el.params.R, 1e-12)
      if (w < 1e-6) continue
      out.push({ id: el.id, label: el.label ?? el.id, kind: 'R', volts: dv, watts: w })
    }
  }
  return out.sort((a, b) => Math.abs(b.volts) - Math.abs(a.volts))
}

const STANDARD_RATINGS = [6.3, 10, 16, 25, 35, 50, 63, 100, 160, 250, 400, 630]
function nextStandardRating(v: number): number {
  return STANDARD_RATINGS.find((r) => r >= v) ?? Math.ceil(v / 100) * 100
}
