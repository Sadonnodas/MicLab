/**
 * Netlist representation and fragment concatenation.
 *
 * A build is four stage fragments (capsule, polarisation, converter, output)
 * plus the load and any faults, chained in signal order. Each fragment names
 * its nodes with strings; concatenation maps those names onto integer node ids,
 * with named *ports* shared between adjacent fragments.
 */

export type NodeId = number
export const GROUND: NodeId = 0

export type ElementKind =
  | 'R'
  | 'C'
  | 'L'
  | 'K' // coupled inductors: params { k }, nodes unused, refs two 'L' element ids
  | 'V'
  | 'I'
  | 'VAC'
  | 'IAC'
  | 'E_BEHAV' // behavioural AC voltage source, value supplied per frequency
  | 'VCVS'
  | 'VCCS'
  | 'JFET'

/** The five stages a build is made of, in signal order. */
export type BuildStage = 'capsule' | 'polarisation' | 'converter' | 'output' | 'load'
/** Anything that can own an element — the five stages plus injected faults. */
export type StageId = BuildStage | 'fault'

export interface Element {
  id: string
  kind: ElementKind
  /** Node ids. R/C/L/V/I/VAC/IAC/E_BEHAV: [a, b]. VCVS/VCCS: [out+, out-, ctrl+, ctrl-]. JFET: [d, g, s]. */
  nodes: NodeId[]
  params: Record<string, number>
  /** For 'K': the ids of the two coupled 'L' elements. */
  refs?: [string, string]
  stage?: StageId
  label?: string
  /** Human-readable one-liner, shown on hover in the UI. */
  note?: string
}

export interface Netlist {
  elements: Element[]
  /** Number of nodes including ground. */
  nodeCount: number
  probes: { outPlus: NodeId; outMinus: NodeId }
  /** name → node id, for debugging and for the UI's node read-outs. */
  nodeNames: Record<string, NodeId>
}

/** A stage's contribution, written against string node names. */
export interface Fragment {
  elements: Array<Omit<Element, 'nodes'> & { nodes: string[] }>
  /** Node names this fragment exposes; the chainer aliases them to shared nodes. */
  ports: Record<string, string>
}

/**
 * Builds a netlist from named nodes. Node name 'gnd' is always node 0.
 * Aliases let two fragments agree that e.g. capsule 'out' is polarisation 'in'.
 */
export class NetlistBuilder {
  private ids: Record<string, NodeId> = { gnd: GROUND }
  private aliases: Record<string, string> = {}
  private next: NodeId = 1
  readonly elements: Element[] = []

  /** Make `from` refer to the same node as `to`. */
  alias(from: string, to: string): void {
    this.aliases[this.resolveName(from)] = this.resolveName(to)
  }

  private resolveName(name: string): string {
    let n = name
    const seen = new Set<string>()
    while (this.aliases[n] && !seen.has(n)) {
      seen.add(n)
      n = this.aliases[n]
    }
    return n
  }

  node(name: string): NodeId {
    const n = this.resolveName(name)
    if (n === 'gnd' || n === '0') return GROUND
    if (this.ids[n] === undefined) this.ids[n] = this.next++
    return this.ids[n]
  }

  add(el: Omit<Element, 'nodes'> & { nodes: string[] }): void {
    this.elements.push({ ...el, nodes: el.nodes.map((n) => this.node(n)) })
  }

  build(outPlus: string, outMinus: string): Netlist {
    const probes = { outPlus: this.node(outPlus), outMinus: this.node(outMinus) }
    const nodeNames: Record<string, NodeId> = { gnd: 0 }
    for (const [k, v] of Object.entries(this.ids)) nodeNames[k] = v
    return { elements: this.elements, nodeCount: this.next, probes, nodeNames }
  }
}

/** Element ids are prefixed by stage so two stages can both have an `R_out`. */
export const eid = (stage: string, name: string): string => `${stage}.${name}`

/**
 * Return a copy of the netlist with some element parameters replaced.
 *
 * Used for stage attribution: "what does the polarisation stage contribute?"
 * is answered by re-solving with R_pol at 1 PΩ and C_couple at 1 F — the same
 * circuit with that stage made ideal — and comparing the two curves.
 */
export function withOverrides(
  nl: Netlist,
  overrides: Record<string, Record<string, number>>,
): Netlist {
  if (Object.keys(overrides).length === 0) return nl
  return {
    ...nl,
    elements: nl.elements.map((el) =>
      overrides[el.id] ? { ...el, params: { ...el.params, ...overrides[el.id] } } : el,
    ),
  }
}
