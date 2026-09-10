import { CMatrix, CVector } from './lu'
import type { Element, Netlist, NodeId } from './netlist'
import type { JfetOp } from './jfet'

/**
 * Row/column layout for Modified Nodal Analysis.
 *
 * Rows 0..(nodeCount-2) are the non-ground node voltages (node n → row n-1).
 * After those come one extra unknown per element that carries its own branch
 * current: voltage sources, behavioural sources, VCVSs and inductors.
 */
export class MnaIndex {
  readonly nodeRows: number
  readonly size: number
  private readonly branch: Map<string, number> = new Map()

  constructor(netlist: Netlist, opts: { dc: boolean }) {
    this.nodeRows = Math.max(netlist.nodeCount - 1, 0)
    let extra = this.nodeRows
    for (const el of netlist.elements) {
      if (needsBranch(el, opts.dc)) {
        this.branch.set(el.id, extra++)
      }
    }
    this.size = extra
  }

  /** Row for a node voltage; -1 for ground (whose equation is dropped). */
  row(n: NodeId): number {
    return n === 0 ? -1 : n - 1
  }

  branchRow(id: string): number {
    const r = this.branch.get(id)
    if (r === undefined) throw new Error(`element ${id} has no branch unknown`)
    return r
  }

  hasBranch(id: string): boolean {
    return this.branch.has(id)
  }
}

function needsBranch(el: Element, _dc: boolean): boolean {
  switch (el.kind) {
    case 'V':
    case 'VAC':
    case 'E_BEHAV':
    case 'VCVS':
      return true
    case 'L':
      return true // AC: jωL branch; DC: an ideal short, still an extra unknown
    case 'C':
      return false
    default:
      return false
  }
}

/** Stamp a resistor-like conductance g between a and b. */
function stampG(A: CMatrix, ix: MnaIndex, a: NodeId, b: NodeId, gRe: number, gIm = 0): void {
  const ra = ix.row(a)
  const rb = ix.row(b)
  A.add(ra, ra, gRe, gIm)
  A.add(rb, rb, gRe, gIm)
  A.add(ra, rb, -gRe, -gIm)
  A.add(rb, ra, -gRe, -gIm)
}

/**
 * Stamp a branch whose current is an extra unknown.
 *
 * Row: v(a) − v(b) − z·i = V, with the branch current appearing in the KCL of
 * both nodes. `z` is the branch's series impedance in the natural sense — pass
 * +R for a source whose terminal voltage sags under load, and +jωL for an
 * inductor. (Both signs are pinned down by tests: the LC resonance test in
 * passive.test.ts fails outright if the inductor sign is flipped, and the
 * ngspice golden file catches a flipped source impedance.)
 */
function stampVBranch(
  A: CMatrix,
  ix: MnaIndex,
  a: NodeId,
  b: NodeId,
  br: number,
  zRe = 0,
  zIm = 0,
): void {
  const ra = ix.row(a)
  const rb = ix.row(b)
  A.add(br, ra, 1)
  A.add(br, rb, -1)
  A.add(ra, br, 1)
  A.add(rb, br, -1)
  if (zRe !== 0 || zIm !== 0) A.add(br, br, -zRe, -zIm)
}

/** Stamp a transconductance gm: current gm·(v(cp) − v(cm)) flows from op to om. */
function stampVCCS(
  A: CMatrix,
  ix: MnaIndex,
  op: NodeId,
  om: NodeId,
  cp: NodeId,
  cm: NodeId,
  gm: number,
): void {
  const rop = ix.row(op)
  const rom = ix.row(om)
  const rcp = ix.row(cp)
  const rcm = ix.row(cm)
  A.add(rop, rcp, gm)
  A.add(rop, rcm, -gm)
  A.add(rom, rcp, -gm)
  A.add(rom, rcm, gm)
}

export interface AcStampOptions {
  /** Angular frequency. */
  omega: number
  /** Small-signal operating points, keyed by JFET element id. */
  ops: Record<string, JfetOp>
  /** Conductance from every node to ground, for numerical robustness. */
  gmin?: number
}

/**
 * Build the complex MNA matrix for one frequency. The right-hand side is built
 * separately by the caller, because the same matrix is reused for the signal
 * solve, the noise adjoint solve and the hum solve.
 */
export function buildAcMatrix(nl: Netlist, ix: MnaIndex, o: AcStampOptions): CMatrix {
  const A = new CMatrix(ix.size)
  const w = o.omega
  const gmin = o.gmin ?? 1e-13
  for (let n = 1; n < nl.nodeCount; n++) {
    const r = ix.row(n)
    A.add(r, r, gmin)
  }

  const inductors = new Map<string, Element>()

  for (const el of nl.elements) {
    const [a, b] = el.nodes
    switch (el.kind) {
      case 'R': {
        stampG(A, ix, a, b, 1 / Math.max(el.params.R, 1e-12))
        break
      }
      case 'C': {
        stampG(A, ix, a, b, 0, w * el.params.C)
        break
      }
      case 'L': {
        inductors.set(el.id, el)
        stampVBranch(A, ix, a, b, ix.branchRow(el.id), 0, w * el.params.L)
        break
      }
      case 'V':
      case 'VAC':
      case 'E_BEHAV': {
        stampVBranch(A, ix, a, b, ix.branchRow(el.id))
        break
      }
      case 'I':
      case 'IAC':
        break // RHS only
      case 'VCVS': {
        const [op, om, cp, cm] = el.nodes
        const br = ix.branchRow(el.id)
        stampVBranch(A, ix, op, om, br, el.params.Rout ?? 0)
        A.add(br, ix.row(cp), -el.params.gain)
        A.add(br, ix.row(cm), el.params.gain)
        break
      }
      case 'VCCS': {
        const [op, om, cp, cm] = el.nodes
        stampVCCS(A, ix, op, om, cp, cm, el.params.gm)
        break
      }
      case 'JFET': {
        const [d, g, s] = el.nodes
        const op = o.ops[el.id]
        if (!op) throw new Error(`no operating point for JFET ${el.id}`)
        stampVCCS(A, ix, d, s, g, s, op.gm)
        stampG(A, ix, d, s, op.gds)
        stampG(A, ix, g, s, 0, w * el.params.Cgs)
        stampG(A, ix, g, d, 0, w * el.params.Cgd)
        break
      }
      case 'K':
        break // handled after the inductors are known
    }
  }

  // Coupled inductors: mutual term M = k·√(L1·L2) links the two branch rows.
  for (const el of nl.elements) {
    if (el.kind !== 'K' || !el.refs) continue
    const [id1, id2] = el.refs
    const l1 = inductors.get(id1)
    const l2 = inductors.get(id2)
    if (!l1 || !l2) continue
    const M = el.params.k * Math.sqrt(l1.params.L * l2.params.L)
    const br1 = ix.branchRow(id1)
    const br2 = ix.branchRow(id2)
    A.add(br1, br2, 0, -o.omega * M)
    A.add(br2, br1, 0, -o.omega * M)
  }

  return A
}

/** Right-hand side for the DC operating point (independent DC sources only). */
export function dcRhs(nl: Netlist, ix: MnaIndex): CVector {
  const b = new CVector(ix.size)
  for (const el of nl.elements) {
    if (el.kind === 'V') b.add(ix.branchRow(el.id), el.params.V)
    else if (el.kind === 'VAC' || el.kind === 'E_BEHAV') b.add(ix.branchRow(el.id), 0)
    else if (el.kind === 'I') {
      const [a, bb] = el.nodes
      b.add(ix.row(a), -el.params.I)
      b.add(ix.row(bb), el.params.I)
    }
  }
  return b
}

/** Build the DC (operating point) matrix, with capacitors open and inductors shorted. */
export function buildDcMatrix(
  nl: Netlist,
  ix: MnaIndex,
  ops: Record<string, JfetOp>,
  gmin = 1e-12,
): CMatrix {
  const A = new CMatrix(ix.size)
  for (let n = 1; n < nl.nodeCount; n++) {
    const r = ix.row(n)
    A.add(r, r, gmin)
  }
  for (const el of nl.elements) {
    const [a, b] = el.nodes
    switch (el.kind) {
      case 'R':
        stampG(A, ix, a, b, 1 / Math.max(el.params.R, 1e-12))
        break
      case 'C':
        break // open at DC
      case 'L':
        stampVBranch(A, ix, a, b, ix.branchRow(el.id)) // short at DC
        break
      case 'V':
      case 'VAC':
      case 'E_BEHAV':
        stampVBranch(A, ix, a, b, ix.branchRow(el.id))
        break
      case 'VCVS': {
        const [op, om, cp, cm] = el.nodes
        const br = ix.branchRow(el.id)
        stampVBranch(A, ix, op, om, br, el.params.Rout ?? 0)
        A.add(br, ix.row(cp), -el.params.gain)
        A.add(br, ix.row(cm), el.params.gain)
        break
      }
      case 'VCCS': {
        const [op, om, cp, cm] = el.nodes
        stampVCCS(A, ix, op, om, cp, cm, el.params.gm)
        break
      }
      case 'JFET': {
        const [d, g, s] = el.nodes
        const op = ops[el.id]
        if (!op) throw new Error(`no operating point for JFET ${el.id}`)
        // Linearised companion model at the current guess.
        stampVCCS(A, ix, d, s, g, s, op.gm)
        stampG(A, ix, d, s, op.gds)
        break
      }
      default:
        break
    }
  }
  return A
}
