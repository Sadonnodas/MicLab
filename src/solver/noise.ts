import type { CVector } from './lu'
import type { MnaIndex } from './stamps'
import type { Netlist } from './netlist'
import type { JfetOp } from './jfet'

export const K_BOLTZMANN = 1.380649e-23
export const Q_ELECTRON = 1.602176634e-19
export const T_ROOM = 300
export const P_REF = 20e-6 // 0 dB SPL, pascals

/**
 * IEC 61672 A-weighting, as a linear gain (not dB).
 * Normalised so |A(1 kHz)| = 1.
 */
export function aWeight(f: number): number {
  const f2 = f * f
  const num = 12194 * 12194 * f2 * f2
  const den =
    (f2 + 20.6 * 20.6) *
    Math.sqrt((f2 + 107.7 * 107.7) * (f2 + 737.9 * 737.9)) *
    (f2 + 12194 * 12194)
  return (num / den) * 1.258925412 // +1.9997 dB normalisation at 1 kHz
}

/** Where a given noise contribution comes from — drives the breakdown pie. */
export type NoiseSourceKind =
  | 'capsule'
  | 'R_pol'
  | 'R_gate'
  | 'resistors'
  | 'fet-channel'
  | 'fet-flicker'
  | 'gate-leakage'
  | 'output'

export interface NoiseSourceDef {
  id: string
  kind: NoiseSourceKind
  label: string
  /** Rows in the MNA right-hand side and their weights, e.g. +1 at b, −1 at a. */
  rows: Array<{ row: number; w: number }>
  /** Power spectral density of the source at frequency f (A²/Hz or V²/Hz). */
  psd: (f: number) => number
}

const rowsFor = (ix: MnaIndex, a: number, b: number) => [
  { row: ix.row(b), w: 1 },
  { row: ix.row(a), w: -1 },
]

function classify(el: { id: string; stage?: string; label?: string }): NoiseSourceKind {
  if (el.id.endsWith('R_pol')) return 'R_pol'
  if (el.id.endsWith('R_gate') || el.id.endsWith('R_gate2')) return 'R_gate'
  if (el.stage === 'output' || el.stage === 'load') return 'output'
  return 'resistors'
}

/**
 * Enumerate every noise source in the circuit.
 *
 * Resistors get Johnson current noise 4kT/R; the FET gets channel noise from
 * its gm, a 1/f term and gate shot noise. The capsule's acoustic self-noise is
 * added separately by the caller, because it needs the signal scaling.
 */
export function noiseSources(
  nl: Netlist,
  ix: MnaIndex,
  ops: Record<string, JfetOp>,
): NoiseSourceDef[] {
  const out: NoiseSourceDef[] = []
  for (const el of nl.elements) {
    if (el.kind === 'R') {
      const R = Math.max(el.params.R, 1e-12)
      if (el.params.noiseless) continue
      const psd = (4 * K_BOLTZMANN * T_ROOM) / R
      out.push({
        id: el.id,
        kind: classify(el),
        label: el.label ?? el.id,
        rows: rowsFor(ix, el.nodes[0], el.nodes[1]),
        psd: () => psd,
      })
    } else if (el.kind === 'JFET') {
      const [d, g, s] = el.nodes
      const op = ops[el.id]
      if (!op) continue
      const channel = 4 * K_BOLTZMANN * T_ROOM * (2 / 3) * Math.max(op.gm, 1e-9)
      out.push({
        id: `${el.id}.channel`,
        kind: 'fet-channel',
        label: `${el.label ?? 'JFET'} channel noise`,
        rows: rowsFor(ix, d, s),
        psd: () => channel,
      })
      const kf = el.params.KF ?? 0
      out.push({
        id: `${el.id}.flicker`,
        kind: 'fet-flicker',
        label: `${el.label ?? 'JFET'} 1/f noise`,
        rows: rowsFor(ix, d, s),
        psd: (f) => (kf * Math.max(op.Id, 1e-9)) / Math.max(f, 1e-3),
      })
      const shot = 2 * Q_ELECTRON * Math.max(el.params.Igss ?? 0, 1e-15)
      out.push({
        id: `${el.id}.gate`,
        kind: 'gate-leakage',
        label: `${el.label ?? 'JFET'} gate leakage shot noise`,
        rows: rowsFor(ix, g, s),
        psd: () => shot,
      })
    }
  }
  return out
}

/** Output PSD contribution of one source at one frequency, given the adjoint vector. */
export function contribution(y: CVector, src: NoiseSourceDef, f: number): number {
  let re = 0
  let im = 0
  for (const { row, w } of src.rows) {
    if (row < 0) continue
    re += w * y.re[row]
    im += w * y.im[row]
  }
  return (re * re + im * im) * src.psd(f)
}

/**
 * Equivalent noise bandwidth of the A-weighting curve over 20 Hz – 20 kHz.
 * A flat pressure-noise density p0²  integrates to p0²·ENBW_A.
 */
export function aWeightedBandwidth(): number {
  let sum = 0
  const n = 4000
  const a = Math.log(20)
  const b = Math.log(20000)
  let fPrev = 20
  let vPrev = aWeight(20) ** 2
  for (let i = 1; i < n; i++) {
    const f = Math.exp(a + ((b - a) * i) / (n - 1))
    const v = aWeight(f) ** 2
    sum += ((v + vPrev) / 2) * (f - fPrev)
    fPrev = f
    vPrev = v
  }
  return sum
}

/**
 * Integrate an equivalent-input-noise density (Pa²/Hz on the log grid) with
 * A-weighting and return the level in dB-A SPL.
 */
export function integrateDbA(freqs: Float64Array, einPsd: Float64Array): number {
  let sum = 0
  for (let i = 1; i < freqs.length; i++) {
    const f0 = freqs[i - 1]
    const f1 = freqs[i]
    if (f1 < 20) continue
    if (f0 > 20000) break
    const lo = Math.max(f0, 20)
    const hi = Math.min(f1, 20000)
    if (hi <= lo) continue
    const w0 = aWeight(f0) ** 2 * einPsd[i - 1]
    const w1 = aWeight(f1) ** 2 * einPsd[i]
    // trapezoid over the clipped interval
    const t0 = (lo - f0) / (f1 - f0)
    const t1 = (hi - f0) / (f1 - f0)
    const v0 = w0 + (w1 - w0) * t0
    const v1 = w0 + (w1 - w0) * t1
    sum += ((v0 + v1) / 2) * (hi - lo)
  }
  const pRms = Math.sqrt(Math.max(sum, 1e-30))
  return 20 * Math.log10(pRms / P_REF)
}
