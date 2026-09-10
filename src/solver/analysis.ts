import { buildCircuit, STAGE_ORDER, type BuildSpec } from '../stages/build'
import { withOverrides, type Netlist, type StageId } from './netlist'
import { MnaIndex, buildAcMatrix } from './stamps'
import { CVector, luSolve } from './lu'
import { adjointVector, frequencyGrid } from './ac'
import { operatingPoint, type OpResult } from './op'
import { capsuleE, type CapsuleSpec } from './capsule'
import { cAbs, cMul, type Complex } from './complex'
import {
  headroomReport,
  stressReport,
  supplyReport,
  CAPSULE_MAX_POLARISATION,
  type HeadroomReport,
  type StressItem,
  type SupplyReport,
} from './hardware'
import {
  P_REF,
  aWeightedBandwidth,
  contribution,
  integrateDbA,
  noiseSources,
  type NoiseSourceKind,
} from './noise'

export interface NoiseShare {
  kind: NoiseSourceKind
  label: string
  dBA: number
  /** Fraction of the total noise power. */
  share: number
}

export interface HumLine {
  freq: number
  /** Output amplitude in volts. */
  volts: number
  /** The same, expressed as the SPL that would produce it. */
  spl: number
}

export interface FetReport {
  id: string
  label: string
  Vgs: number
  Vds: number
  Id: number
  gm: number
  gds: number
  region: 'sat' | 'triode' | 'off'
  /** gm·R_d for a common-source stage, in dB. */
  gainDb: number
}

export interface AnalysisResult {
  freqs: Float64Array
  /** Complex response, V/Pa. */
  hRe: Float64Array
  hIm: Float64Array
  /** Normalised magnitude, dB relative to 1 kHz. */
  mag: Float64Array
  phase: Float64Array
  /** Sensitivity at 1 kHz. */
  sensitivity: number
  sensitivityDbv: number
  /** Per-stage contribution in dB (normalised at 1 kHz). */
  stages: Record<string, Float64Array>
  /** The −3 dB point of each stage's own contribution, measured not calculated. */
  stageCorners: Record<string, number>
  /** Output noise density, V²/Hz. */
  noisePsd: Float64Array
  /** Equivalent input noise density, Pa/√Hz. */
  einPsd: Float64Array
  selfNoiseDbA: number
  /** Self-noise with the capsule's acoustic noise removed. */
  electronicsDbA: number
  noiseBreakdown: NoiseShare[]
  hum: HumLine[]
  humTotalSpl: number
  op: {
    fets: FetReport[]
    nodes: Record<string, number>
    vpol: number
    converged: boolean
    warning?: string
  }
  faultAudio: string[]
  solveMs: number
  /**
   * Everything that matters for building the thing rather than hearing it:
   * whether phantom power can run it, when it clips, what voltage each part
   * sees, and whether the capsule is being over-polarised.
   */
  hardware: {
    supply: SupplyReport | null
    headroom: HeadroomReport | null
    stress: StressItem[]
    warnings: string[]
  }
}

const KIND_LABELS: Record<NoiseSourceKind, string> = {
  capsule: 'Capsule (acoustic)',
  R_pol: 'Polarisation resistor',
  R_gate: 'Gate resistor',
  resistors: 'Other resistors',
  'fet-channel': 'FET channel',
  'fet-flicker': 'FET 1/f',
  'gate-leakage': 'Gate leakage',
  output: 'Output stage & load',
}

/** Solve for H(f) over the grid, given a netlist and a capsule. */
function sweep(
  nl: Netlist,
  ix: MnaIndex,
  ops: OpResult['ops'],
  caps: CapsuleSpec,
  vpol: number,
  freqs: Float64Array,
  flatCapsule = false,
): { H: Complex[]; ys: CVector[] } {
  const H: Complex[] = []
  const ys: CVector[] = []
  const br = ix.branchRow('capsule.E')
  for (let i = 0; i < freqs.length; i++) {
    const f = freqs[i]
    const A = buildAcMatrix(nl, ix, { omega: 2 * Math.PI * f, ops })
    const y = adjointVector(A, ix, nl.probes.outPlus, nl.probes.outMinus)
    const E = capsuleE(caps, vpol, f, flatCapsule)
    H.push(cMul({ re: y.re[br], im: y.im[br] }, E))
    ys.push(y)
  }
  return { H, ys }
}

function normalise(H: Complex[], freqs: Float64Array): { mag: Float64Array; phase: Float64Array; ref: number } {
  const iRef = nearest(freqs, 1000)
  const ref = Math.max(cAbs(H[iRef]), 1e-30)
  const mag = new Float64Array(H.length)
  const phase = new Float64Array(H.length)
  let prev = 0
  for (let i = 0; i < H.length; i++) {
    mag[i] = 20 * Math.log10(Math.max(cAbs(H[i]), 1e-30) / ref)
    // unwrapped phase, so the impulse-response builder can interpolate it
    let p = Math.atan2(H[i].im, H[i].re)
    while (p - prev > Math.PI) p -= 2 * Math.PI
    while (prev - p > Math.PI) p += 2 * Math.PI
    phase[i] = p
    prev = p
  }
  return { mag, phase, ref }
}

function nearest(freqs: Float64Array, f: number): number {
  let best = 0
  let bestD = Infinity
  for (let i = 0; i < freqs.length; i++) {
    const d = Math.abs(Math.log(freqs[i]) - Math.log(f))
    if (d < bestD) {
      bestD = d
      best = i
    }
  }
  return best
}

/** Full analysis: operating point, response, per-stage attribution, noise, hum. */
export function analyse(spec: BuildSpec, nPoints?: number): AnalysisResult {
  const t0 = typeof performance !== 'undefined' ? performance.now() : Date.now()
  const built = buildCircuit(spec)
  const nl = built.netlist
  const caps = built.capsule
  const freqs = frequencyGrid(nPoints)

  // --- operating point
  const op = operatingPoint(nl)
  const nDia = nl.nodeNames['dia'] ?? 0
  const nBack = nl.nodeNames['back'] ?? 0
  const dcAcross = Math.abs((op.v[nBack] ?? 0) - (op.v[nDia] ?? 0))
  const vpol = caps.fixedVpol ?? dcAcross

  const ix = new MnaIndex(nl, { dc: false })
  const { H, ys } = sweep(nl, ix, op.ops, caps, vpol, freqs)
  const { mag, phase, ref } = normalise(H, freqs)

  // --- per-stage attribution: re-solve with each stage made ideal
  const stages: Record<string, Float64Array> = {}
  for (const stage of STAGE_ORDER) {
    let curve: Float64Array
    if (stage === 'capsule') {
      const { H: Hf } = sweep(nl, ix, op.ops, caps, vpol, freqs, true)
      curve = diffCurve(H, Hf, freqs)
    } else {
      const ideals = built.stageIdeals[stage as StageId] ?? {}
      if (Object.keys(ideals).length === 0) {
        curve = new Float64Array(freqs.length)
      } else {
        const nl2 = withOverrides(nl, ideals)
        const { H: Hi } = sweep(nl2, ix, op.ops, caps, vpol, freqs)
        curve = diffCurve(H, Hi, freqs)
      }
    }
    stages[stage] = curve
  }

  // The frequency below which each stage is costing more than 3 dB. Measured
  // from the attribution curve, because the textbook R·C ignores whatever else
  // is hanging off the same node — here, a factor of four or five.
  const stageCorners: Record<string, number> = {}
  const iRef = nearest(freqs, 1000)
  for (const [stage, curve] of Object.entries(stages)) {
    let corner = 0
    // Walk *down* from 1 kHz, so a capsule's high-frequency roll-off is never
    // mistaken for a low-frequency corner.
    for (let i = iRef; i > 0; i--) {
      if (curve[i] < -3) {
        corner = freqs[i]
        break
      }
    }
    stageCorners[stage] = corner
  }

  // --- noise
  const sources = noiseSources(nl, ix, op.ops)
  const enbwA = aWeightedBandwidth()
  const pTarget = P_REF * Math.pow(10, caps.Nac / 20)
  const p0sq = caps.Nac > 0 ? (pTarget * pTarget) / enbwA : 0
  const brCaps = ix.branchRow('capsule.E')

  const noisePsd = new Float64Array(freqs.length)
  const einPsd = new Float64Array(freqs.length)
  const byKind: Record<string, Float64Array> = {}
  const kindOf: Record<string, NoiseSourceKind> = {}
  const ensure = (k: string) => (byKind[k] ??= new Float64Array(freqs.length))

  for (let i = 0; i < freqs.length; i++) {
    const f = freqs[i]
    const y = ys[i]
    let total = 0
    for (const s of sources) {
      const c = contribution(y, s, f)
      total += c
      ensure(s.kind)[i] += c
      kindOf[s.kind] = s.kind
    }
    if (p0sq > 0) {
      const E = capsuleE(caps, vpol, f)
      const t = { re: y.re[brCaps], im: y.im[brCaps] }
      const v = cMul(t, E)
      const c = (v.re * v.re + v.im * v.im) * p0sq
      total += c
      ensure('capsule')[i] += c
      kindOf.capsule = 'capsule'
    }
    noisePsd[i] = total
    const h2 = Math.max(cAbs(H[i]) ** 2, 1e-40)
    einPsd[i] = total / h2
  }

  const selfNoiseDbA = integrateDbA(freqs, einPsd)
  const breakdown: NoiseShare[] = []
  let totalPower = 0
  const powers: Record<string, number> = {}
  for (const [kind, psd] of Object.entries(byKind)) {
    const ein = new Float64Array(freqs.length)
    for (let i = 0; i < freqs.length; i++) ein[i] = psd[i] / Math.max(cAbs(H[i]) ** 2, 1e-40)
    const dBA = integrateDbA(freqs, ein)
    const power = Math.pow(10, dBA / 10)
    powers[kind] = power
    totalPower += power
    breakdown.push({ kind: kind as NoiseSourceKind, label: KIND_LABELS[kind as NoiseSourceKind] ?? kind, dBA, share: 0 })
  }
  for (const b of breakdown) b.share = totalPower > 0 ? powers[b.kind] / totalPower : 0
  breakdown.sort((a, b) => b.dBA - a.dBA)

  const electronicsPower = totalPower - (powers.capsule ?? 0)
  const electronicsDbA = electronicsPower > 0 ? 10 * Math.log10(electronicsPower) : -Infinity

  // --- hum and faults
  const hum = humAnalysis(nl, ix, op.ops, ref)
  const humPower = hum.reduce((a, l) => a + Math.pow(10, l.spl / 10), 0)
  const humTotalSpl = humPower > 0 ? 10 * Math.log10(humPower) : -Infinity

  // --- operating point report
  const fets: FetReport[] = nl.elements
    .filter((e) => e.kind === 'JFET')
    .map((e) => {
      const o = op.ops[e.id]
      const rd = nl.elements.find((x) => x.id === 'conv.R_d')?.params.R ?? 0
      return {
        id: e.id,
        label: e.label ?? e.id,
        Vgs: o?.Vgs ?? 0,
        Vds: o?.Vds ?? 0,
        Id: o?.Id ?? 0,
        gm: o?.gm ?? 0,
        gds: o?.gds ?? 0,
        region: o?.region ?? 'off',
        gainDb: 20 * Math.log10(Math.max((o?.gm ?? 0) * rd, 1e-6)),
      }
    })

  const nodes: Record<string, number> = {}
  for (const [name, id] of Object.entries(nl.nodeNames)) nodes[name] = op.v[id] ?? 0

  // --- hardware reality: one forward solve at 1 kHz gives the signal level at
  // every node, which is what the headroom estimate needs.
  const perPascal: Record<string, number> = {}
  try {
    const f = 1000
    const A = buildAcMatrix(nl, ix, { omega: 2 * Math.PI * f, ops: op.ops })
    const rhs = new CVector(ix.size)
    const E = capsuleE(caps, vpol, f)
    rhs.add(ix.branchRow('capsule.E'), E.re, E.im)
    const x = luSolve(A, rhs)
    for (const [name, id] of Object.entries(nl.nodeNames)) {
      perPascal[name] = id === 0 ? 0 : Math.hypot(x.re[ix.row(id)], x.im[ix.row(id)])
    }
  } catch {
    /* a headroom estimate is a nicety; never let it break the analysis */
  }

  const supply = supplyReport(nl, op)
  const fetEl = nl.elements.find((e) => e.kind === 'JFET')
  const headroom =
    fetEl && op.ops[fetEl.id]
      ? headroomReport({
          op,
          fetOp: op.ops[fetEl.id],
          fetId: fetEl.id,
          nl,
          perPascal,
          outNode: built.ctx.converterOut,
          vdd: built.ctx.vdd,
        })
      : null
  const stress = stressReport(nl, op)

  const warnings: string[] = []
  if (supply?.warning) warnings.push(supply.warning)
  // An electret's "polarisation voltage" is the equivalent of a charge sealed
  // into a plastic film at the factory. There is no external voltage anywhere
  // in the microphone, nothing to arc, and nothing the user can change.
  if (caps.fixedVpol === undefined && vpol > CAPSULE_MAX_POLARISATION) {
    warnings.push(
      `The capsule is polarised at ${vpol.toFixed(0)} V. Real capsules stop at 60–65 V. The electrostatic pull goes as V² and works against the diaphragm's tension, so past that the diaphragm softens, the resonance drops and distortion rises — and any dust or moisture in the gap becomes a discharge path that eventually burns a pinhole through it. The extra sensitivity on the graph is not available in hardware, and chasing it costs capsules. (It will not hurt you: the supply is behind a gigaohm and delivers microamps.)`,
    )
  }
  if (headroom && headroom.maxSpl < 110) {
    warnings.push(
      `This bias point runs out of room at about ${headroom.maxSpl.toFixed(0)} dB SPL, limited by ${headroom.limitedBy}. A microphone that distorts below about 110 dB SPL is not much use on anything loud.`,
    )
  }
  if (op.ops[fetEl?.id ?? '']?.region === 'triode') {
    warnings.push(
      'The FET has fallen out of saturation into the triode region. It is behaving as a resistor rather than an amplifier, and a real build here would be badly distorted and very quiet.',
    )
  }

  const faultAudio = spec.faults.map((f) => f.id)

  const t1 = typeof performance !== 'undefined' ? performance.now() : Date.now()

  return {
    freqs,
    hRe: Float64Array.from(H, (h) => h.re),
    hIm: Float64Array.from(H, (h) => h.im),
    mag,
    phase,
    sensitivity: ref,
    sensitivityDbv: 20 * Math.log10(Math.max(ref, 1e-12)),
    stages,
    stageCorners,
    noisePsd,
    einPsd,
    selfNoiseDbA,
    electronicsDbA,
    noiseBreakdown: breakdown,
    hum,
    humTotalSpl,
    op: {
      fets,
      nodes,
      vpol,
      converged: op.converged,
      warning: op.warning,
    },
    faultAudio,
    solveMs: t1 - t0,
    hardware: { supply, headroom, stress, warnings },
  }
}

/** dB difference between the real curve and an idealised one, both normalised at 1 kHz. */
function diffCurve(H: Complex[], Hideal: Complex[], freqs: Float64Array): Float64Array {
  const iRef = nearest(freqs, 1000)
  const r1 = Math.max(cAbs(H[iRef]), 1e-30)
  const r2 = Math.max(cAbs(Hideal[iRef]), 1e-30)
  const out = new Float64Array(H.length)
  for (let i = 0; i < H.length; i++) {
    out[i] =
      20 * Math.log10(Math.max(cAbs(H[i]), 1e-30) / r1) -
      20 * Math.log10(Math.max(cAbs(Hideal[i]), 1e-30) / r2)
  }
  return out
}

/**
 * Hum: solve at exactly the frequencies the fault sources live at, with the
 * signal source switched off. Nothing is synthesised — the amplitudes come out
 * of the same matrix as the music.
 */
function humAnalysis(
  nl: Netlist,
  ix: MnaIndex,
  ops: OpResult['ops'],
  sensitivity: number,
): HumLine[] {
  const freqs = new Set<number>()
  for (const el of nl.elements) {
    if ((el.kind === 'IAC' || el.kind === 'VAC') && el.params.freq) freqs.add(el.params.freq)
  }
  const lines: HumLine[] = []
  for (const f of [...freqs].sort((a, b) => a - b)) {
    const A = buildAcMatrix(nl, ix, { omega: 2 * Math.PI * f, ops })
    const b = new CVector(ix.size)
    for (const el of nl.elements) {
      if (el.params.freq !== f) continue
      if (el.kind === 'VAC') b.add(ix.branchRow(el.id), el.params.amplitude)
      else if (el.kind === 'IAC') {
        b.add(ix.row(el.nodes[0]), -el.params.amplitude)
        b.add(ix.row(el.nodes[1]), el.params.amplitude)
      }
    }
    const x = luSolve(A, b)
    const vp = x.get(ix.row(nl.probes.outPlus))
    const vn = x.get(ix.row(nl.probes.outMinus))
    const volts = Math.hypot(vp.re - vn.re, vp.im - vn.im)
    const pa = volts / Math.max(sensitivity, 1e-12)
    lines.push({ freq: f, volts, spl: 20 * Math.log10(Math.max(pa, 1e-12) / P_REF) })
  }
  return lines
}
