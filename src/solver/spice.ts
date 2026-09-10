import type { Netlist } from './netlist'

/**
 * Export a netlist as an ngspice deck.
 *
 * This exists purely so the solver can be checked against a real SPICE for the
 * Phase 0 golden file (§4.8 item 4). It is a dev-time tool — nothing in the
 * running app calls it.
 *
 * Two deliberate choices keep the comparison exact rather than approximate:
 *  - the JFET's gate capacitances are exported as discrete capacitors with the
 *    model's CGS/CGD set to zero, because SPICE's built-in junction capacitance
 *    varies with bias and this model's does not;
 *  - a 1 TΩ resistor is placed from every node to ground, matching the gmin the
 *    solver adds for numerical robustness, so both tools see the same circuit.
 */

const nodeName = (n: number): string => (n === 0 ? '0' : `n${n}`)

const sane = (id: string): string => id.replace(/[^A-Za-z0-9]/g, '_')

export interface SpiceOptions {
  title?: string
  /** Conductance from every node to ground, mirroring the solver's gmin. */
  gmin?: number
}

export function toSpice(nl: Netlist, o: SpiceOptions = {}): string {
  const gmin = o.gmin ?? 1e-12
  const lines: string[] = [`* ${o.title ?? 'Mic Lab export'}`]
  const models: string[] = []
  const inductorNames = new Map<string, string>()

  for (const el of nl.elements) {
    const id = sane(el.id)
    const n = el.nodes.map(nodeName)
    switch (el.kind) {
      case 'R':
        lines.push(`R${id} ${n[0]} ${n[1]} ${el.params.R}`)
        break
      case 'C':
        lines.push(`C${id} ${n[0]} ${n[1]} ${el.params.C}`)
        break
      case 'L':
        inductorNames.set(el.id, `L${id}`)
        lines.push(`L${id} ${n[0]} ${n[1]} ${el.params.L}`)
        break
      case 'K':
        break // emitted after all inductors are named
      case 'V':
        lines.push(`V${id} ${n[0]} ${n[1]} DC ${el.params.V} AC 0`)
        break
      case 'VAC':
        lines.push(`V${id} ${n[0]} ${n[1]} DC 0 AC ${el.params.amplitude}`)
        break
      case 'E_BEHAV':
        // The capsule's behavioural source becomes a plain 1 V AC source: the
        // mechanical response is a closed-form multiplier, tested separately.
        lines.push(`V${id} ${n[0]} ${n[1]} DC 0 AC 1`)
        break
      case 'I':
        lines.push(`I${id} ${n[0]} ${n[1]} DC ${el.params.I} AC 0`)
        break
      case 'IAC':
        lines.push(`I${id} ${n[0]} ${n[1]} DC 0 AC ${el.params.amplitude}`)
        break
      case 'VCVS': {
        const rout = el.params.Rout ?? 0
        if (rout > 0) {
          lines.push(`E${id} ${id}_i ${n[1]} ${n[2]} ${n[3]} ${el.params.gain}`)
          lines.push(`R${id}_o ${id}_i ${n[0]} ${rout}`)
        } else {
          lines.push(`E${id} ${n[0]} ${n[1]} ${n[2]} ${n[3]} ${el.params.gain}`)
        }
        break
      }
      case 'VCCS':
        lines.push(`G${id} ${n[0]} ${n[1]} ${n[2]} ${n[3]} ${el.params.gm}`)
        break
      case 'JFET': {
        lines.push(`J${id} ${n[0]} ${n[1]} ${n[2]} M${id}`)
        lines.push(`C${id}_gs ${n[1]} ${n[2]} ${el.params.Cgs}`)
        lines.push(`C${id}_gd ${n[1]} ${n[0]} ${el.params.Cgd}`)
        models.push(
          `.model M${id} NJF(BETA=${el.params.beta} VTO=${el.params.Vp} LAMBDA=${el.params.lambda} CGS=0 CGD=0 IS=1e-20)`,
        )
        break
      }
    }
  }

  for (const el of nl.elements) {
    if (el.kind !== 'K' || !el.refs) continue
    const a = inductorNames.get(el.refs[0])
    const b = inductorNames.get(el.refs[1])
    if (a && b) lines.push(`K${sane(el.id)} ${a} ${b} ${el.params.k}`)
  }

  for (let node = 1; node < nl.nodeCount; node++) {
    lines.push(`Rgmin${node} ${nodeName(node)} 0 ${1 / gmin}`)
  }

  lines.push(...models)
  return lines.join('\n')
}

/** A complete deck that sweeps and writes the differential output. */
export function spiceDeck(nl: Netlist, csvPath: string, o: SpiceOptions = {}): string {
  return [
    toSpice(nl, o),
    '.control',
    'ac dec 200 5 40000',
    `let vout = v(${nodeName(nl.probes.outPlus)}) - v(${nodeName(nl.probes.outMinus)})`,
    `wrdata ${csvPath} vout`,
    'quit',
    '.endc',
    '.end',
    '',
  ].join('\n')
}
