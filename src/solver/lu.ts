import type { Complex } from './complex'

/**
 * Dense complex matrix stored as two flat Float64Arrays (real and imaginary
 * parts, row-major). Matrices here are at most ~40x40, so a dense
 * representation with LU + partial pivoting is both simple and fast enough:
 * a full 512-point AC sweep is a few hundred solves of a tiny system.
 */
export class CMatrix {
  readonly n: number
  readonly re: Float64Array
  readonly im: Float64Array

  constructor(n: number) {
    this.n = n
    this.re = new Float64Array(n * n)
    this.im = new Float64Array(n * n)
  }

  /** M[r][c] += (re, im). All MNA stamps are accumulations, never assignments. */
  add(r: number, c: number, re: number, im = 0): void {
    if (r < 0 || c < 0) return // ground rows/columns are not part of the system
    const k = r * this.n + c
    this.re[k] += re
    this.im[k] += im
  }

  get(r: number, c: number): Complex {
    const k = r * this.n + c
    return { re: this.re[k], im: this.im[k] }
  }
}

export class CVector {
  readonly n: number
  readonly re: Float64Array
  readonly im: Float64Array

  constructor(n: number) {
    this.n = n
    this.re = new Float64Array(n)
    this.im = new Float64Array(n)
  }

  add(r: number, re: number, im = 0): void {
    if (r < 0) return
    this.re[r] += re
    this.im[r] += im
  }

  get(r: number): Complex {
    if (r < 0) return { re: 0, im: 0 }
    return { re: this.re[r], im: this.im[r] }
  }
}

export class SingularMatrixError extends Error {
  readonly row: number
  constructor(row: number) {
    super(`Circuit matrix is singular at row ${row} — a node is floating or a source is shorted.`)
    this.name = 'SingularMatrixError'
    this.row = row
  }
}

/**
 * Solve A·x = b by LU decomposition with partial pivoting.
 * A and b are destroyed; the solution is returned as a new CVector.
 */
export function luSolve(A: CMatrix, b: CVector): CVector {
  const n = A.n
  const { re: ar, im: ai } = A
  const br = Float64Array.from(b.re)
  const bi = Float64Array.from(b.im)

  for (let k = 0; k < n; k++) {
    // --- pivot: largest magnitude in column k at or below the diagonal
    let piv = k
    let best = Math.hypot(ar[k * n + k], ai[k * n + k])
    for (let r = k + 1; r < n; r++) {
      const m = Math.hypot(ar[r * n + k], ai[r * n + k])
      if (m > best) {
        best = m
        piv = r
      }
    }
    if (best < 1e-300) throw new SingularMatrixError(k)
    if (piv !== k) {
      for (let c = 0; c < n; c++) {
        const i1 = k * n + c
        const i2 = piv * n + c
        let t = ar[i1]
        ar[i1] = ar[i2]
        ar[i2] = t
        t = ai[i1]
        ai[i1] = ai[i2]
        ai[i2] = t
      }
      let t = br[k]
      br[k] = br[piv]
      br[piv] = t
      t = bi[k]
      bi[k] = bi[piv]
      bi[piv] = t
    }

    // --- eliminate
    const dr = ar[k * n + k]
    const di = ai[k * n + k]
    const dd = dr * dr + di * di
    for (let r = k + 1; r < n; r++) {
      const nr = ar[r * n + k]
      const ni = ai[r * n + k]
      if (nr === 0 && ni === 0) continue
      // factor = A[r][k] / A[k][k]
      const fr = (nr * dr + ni * di) / dd
      const fi = (ni * dr - nr * di) / dd
      ar[r * n + k] = 0
      ai[r * n + k] = 0
      for (let c = k + 1; c < n; c++) {
        const ik = k * n + c
        const ir = r * n + c
        ar[ir] -= fr * ar[ik] - fi * ai[ik]
        ai[ir] -= fr * ai[ik] + fi * ar[ik]
      }
      br[r] -= fr * br[k] - fi * bi[k]
      bi[r] -= fr * bi[k] + fi * br[k]
    }
  }

  // --- back substitution
  const x = new CVector(n)
  for (let r = n - 1; r >= 0; r--) {
    let sr = br[r]
    let si = bi[r]
    for (let c = r + 1; c < n; c++) {
      const i = r * n + c
      sr -= ar[i] * x.re[c] - ai[i] * x.im[c]
      si -= ar[i] * x.im[c] + ai[i] * x.re[c]
    }
    const dr = ar[r * n + r]
    const di = ai[r * n + r]
    const dd = dr * dr + di * di
    x.re[r] = (sr * dr + si * di) / dd
    x.im[r] = (si * dr - sr * di) / dd
  }
  return x
}
