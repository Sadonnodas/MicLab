import { CMatrix, CVector, luSolve } from './lu'
import { MnaIndex, buildAcMatrix } from './stamps'
import type { Netlist } from './netlist'
import type { JfetOp } from './jfet'
import type { Complex } from './complex'
import { cAbs } from './complex'

export const F_MIN = 5
export const F_MAX = 40000
export const N_POINTS = 512

/** Log-spaced analysis grid, 5 Hz – 40 kHz. */
export function frequencyGrid(n = N_POINTS, fMin = F_MIN, fMax = F_MAX): Float64Array {
  const f = new Float64Array(n)
  const a = Math.log(fMin)
  const b = Math.log(fMax)
  for (let i = 0; i < n; i++) f[i] = Math.exp(a + ((b - a) * i) / (n - 1))
  return f
}

/** Transpose of a complex matrix (plain transpose, not conjugate). */
function transpose(A: CMatrix): CMatrix {
  const n = A.n
  const T = new CMatrix(n)
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      T.re[c * n + r] = A.re[r * n + c]
      T.im[c * n + r] = A.im[r * n + c]
    }
  }
  return T
}

/**
 * The adjoint (transposed) solve.
 *
 * The output voltage for *any* right-hand side b is y·b, where Aᵀy = c and c
 * picks out the output nodes. One extra solve per frequency therefore gives the
 * transfer function from every possible source position at once — which is what
 * makes the noise analysis (dozens of sources) as cheap as the signal analysis.
 */
export function adjointVector(A: CMatrix, ix: MnaIndex, outPlus: number, outMinus: number): CVector {
  const c = new CVector(ix.size)
  c.add(ix.row(outPlus), 1)
  c.add(ix.row(outMinus), -1)
  return luSolve(transpose(A), c)
}

export interface AcPoint {
  A: CMatrix
  y: CVector
}

/** Build the matrix and adjoint vector at one frequency. */
export function acPoint(
  nl: Netlist,
  ix: MnaIndex,
  f: number,
  ops: Record<string, JfetOp>,
): AcPoint {
  const A = buildAcMatrix(nl, ix, { omega: 2 * Math.PI * f, ops })
  const y = adjointVector(A, ix, nl.probes.outPlus, nl.probes.outMinus)
  return { A, y }
}

/** Interpolate a dB curve given on the log grid at an arbitrary frequency. */
export function interpAt(freqs: Float64Array, values: Float64Array, f: number): number {
  if (f <= freqs[0]) return values[0]
  const n = freqs.length
  if (f >= freqs[n - 1]) return values[n - 1]
  let lo = 0
  let hi = n - 1
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1
    if (freqs[mid] > f) hi = mid
    else lo = mid
  }
  const t = (Math.log(f) - Math.log(freqs[lo])) / (Math.log(freqs[hi]) - Math.log(freqs[lo]))
  return values[lo] + t * (values[hi] - values[lo])
}

export const magDb = (h: Complex): number => 20 * Math.log10(Math.max(cAbs(h), 1e-30))
