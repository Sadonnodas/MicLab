import { luSolve, CVector, SingularMatrixError } from './lu'
import { MnaIndex, buildDcMatrix, dcRhs } from './stamps'
import type { Netlist } from './netlist'
import { jfetEval, type JfetOp, type JfetParams } from './jfet'

export interface OpResult {
  /** Node voltages, indexed by node id (index 0 is ground = 0 V). */
  v: Float64Array
  /** DC current through each element that carries a branch unknown, by id.
   *  Positive means current leaving the element's first node. */
  branchCurrents: Record<string, number>
  ops: Record<string, JfetOp>
  iterations: number
  converged: boolean
  /** Plain-language note when something went wrong, for the UI. */
  warning?: string
}

const MAX_ITER = 100
const V_TOL = 1e-6

/** Newton step limiting: keeps the FET from being thrown into a wild bias by one bad step. */
function limitStep(vNew: number, vOld: number, maxDelta: number): number {
  const d = vNew - vOld
  if (d > maxDelta) return vOld + maxDelta
  if (d < -maxDelta) return vOld - maxDelta
  return vNew
}

interface JfetState {
  id: string
  d: number
  g: number
  s: number
  p: JfetParams
  Igss: number
  Vgs: number
  Vds: number
}

function collectJfets(nl: Netlist): JfetState[] {
  return nl.elements
    .filter((e) => e.kind === 'JFET')
    .map((e) => {
      const [d, g, s] = e.nodes
      const p: JfetParams = {
        beta: e.params.beta,
        Vp: e.params.Vp,
        lambda: e.params.lambda,
      }
      return { id: e.id, d, g, s, p, Igss: e.params.Igss ?? 0, Vgs: p.Vp / 2, Vds: 1, }
    })
}

function newton(nl: Netlist, ix: MnaIndex, fets: JfetState[], scale: number): OpResult {
  const nodeV = new Float64Array(nl.nodeCount)
  const branchCurrents: Record<string, number> = {}
  let converged = false
  let iter = 0
  let ops: Record<string, JfetOp> = {}

  for (; iter < MAX_ITER; iter++) {
    ops = {}
    for (const f of fets) ops[f.id] = jfetEval(f.p, f.Vgs, f.Vds)

    const A = buildDcMatrix(nl, ix, ops)
    const b = dcRhs(nl, ix)
    // Scale independent DC voltage sources for source stepping.
    if (scale !== 1) {
      for (const el of nl.elements) {
        if (el.kind === 'V') {
          const r = ix.branchRow(el.id)
          b.re[r] = el.params.V * scale
        }
      }
    }
    // JFET companion-model current sources.
    for (const f of fets) {
      const o = ops[f.id]
      const Ieq = o.Id - o.gm * f.Vgs - o.gds * f.Vds
      b.add(ix.row(f.d), -Ieq)
      b.add(ix.row(f.s), Ieq)
      // Gate leakage: reverse current in the gate–channel junction leaves the
      // gate pin, so it is injected into the gate node from the channel.
      if (f.Igss) {
        b.add(ix.row(f.g), f.Igss)
        b.add(ix.row(f.s), -f.Igss)
      }
    }

    let x: CVector
    try {
      x = luSolve(A, b)
    } catch (e) {
      if (e instanceof SingularMatrixError) {
        return { v: nodeV, branchCurrents, ops, iterations: iter, converged: false, warning: e.message }
      }
      throw e
    }

    let maxDelta = 0
    for (let n = 1; n < nl.nodeCount; n++) {
      const nv = x.re[ix.row(n)]
      maxDelta = Math.max(maxDelta, Math.abs(nv - nodeV[n]))
      nodeV[n] = nv
    }
    for (const el of nl.elements) {
      if (ix.hasBranch(el.id)) branchCurrents[el.id] = x.re[ix.branchRow(el.id)]
    }

    for (const f of fets) {
      const vg = nodeV[f.g]
      const vs = nodeV[f.s]
      const vd = nodeV[f.d]
      f.Vgs = limitStep(vg - vs, f.Vgs, 0.5)
      f.Vds = limitStep(vd - vs, f.Vds, 2)
    }

    if (maxDelta < V_TOL && iter > 1) {
      converged = true
      break
    }
  }

  for (const f of fets) ops[f.id] = jfetEval(f.p, f.Vgs, f.Vds)
  return { v: nodeV, branchCurrents, ops, iterations: iter, converged }
}

/**
 * DC operating point. Straight Newton first; if that fails, ramp the supplies
 * from zero in ten steps, each starting from the previous solution.
 */
export function operatingPoint(nl: Netlist): OpResult {
  const ix = new MnaIndex(nl, { dc: true })
  const fets = collectJfets(nl)
  const first = newton(nl, ix, fets, 1)
  if (first.converged || fets.length === 0) return first

  // Source stepping.
  for (const f of fets) {
    f.Vgs = f.p.Vp / 2
    f.Vds = 0
  }
  let last: OpResult = first
  for (let k = 1; k <= 10; k++) {
    last = newton(nl, ix, fets, k / 10)
    if (!last.converged && k === 10) {
      return {
        ...last,
        warning: describeBiasFailure(fets),
      }
    }
  }
  return last
}

function describeBiasFailure(fets: JfetState[]): string {
  const f = fets[0]
  if (!f) return 'The bias solve did not converge.'
  if (f.Vgs < f.p.Vp) {
    return `The FET is pinched off: V_gs = ${f.Vgs.toFixed(2)} V is below the pinch-off voltage ${f.p.Vp} V, so no drain current flows. Lower the source resistor or pick a FET with a more negative V_p.`
  }
  return `The bias solve did not settle (V_gs = ${f.Vgs.toFixed(2)} V, V_ds = ${f.Vds.toFixed(2)} V). Check the drain and source resistors.`
}

/** Index into the operating-point node voltage array, safe for ground. */
export const nodeVoltage = (op: OpResult, n: number): number => (n === 0 ? 0 : op.v[n])
