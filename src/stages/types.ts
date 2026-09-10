import type { NetlistBuilder, StageId } from '../solver/netlist'
import type { CapsuleSpec } from '../solver/capsule'

/** How a slider behaves and what it means. */
export interface ParamDef {
  key: string
  label: string
  /** Engineering unit; '' for dimensionless. */
  unit: string
  min: number
  max: number
  default: number
  scale: 'log' | 'linear'
  /** One sentence, shown on hover — "what this component does". */
  help: string
  /** Discrete options instead of a continuous slider. */
  choices?: Array<{ value: number; label: string }>
  /** A named choice that is not a number (JFET model, transformer type). */
  kind?: 'number' | 'enum'
  enumOptions?: Array<{ value: string; label: string }>
  enumDefault?: string
  /** Number of significant digits to show. */
  digits?: number
  /** Lesson that unlocks this control (undefined = always available). */
  lesson?: number
}

export type ParamValues = Record<string, number | string>

/** A quantity the explanation engine talks about, e.g. "polarisation corner". */
export interface Derived {
  key: string
  label: string
  value: number
  unit: string
  /** How to render the number. */
  format?: (v: number) => string
  /** Template sentence: receives old and new formatted values. */
  sentence: (from: string, to: string) => string
  /** Longer "Why?" text. */
  why: string
  /** Which slider this hangs off, so the UI can show it inline. */
  attachTo?: string
  /**
   * Some quantities are better measured than calculated. 'stageCorner' replaces
   * the formula's value with the −3 dB point of this stage's own contribution
   * curve, and 'stageGain' with the FET's actual gm·R_d. A textbook R·C corner
   * ignores everything else hanging off the same node, and in this circuit that
   * is a factor of four or five — so the number on screen comes from the solve.
   */
  fromSolver?: 'stageCorner' | 'stageGain'
}

export interface BuildContext {
  values: Record<StageId | 'faults', ParamValues>
  /** Set by the converter variant: the node its signal comes out of. */
  converterOut: string
  /** Supply rail voltage. */
  vdd: number
  /** Filled in by the capsule variant. */
  capsule: CapsuleSpec
  /** Element ids that make each stage non-ideal, with their ideal values. */
  idealOverrides: Record<string, Record<string, number>>
  /** Which faults are switched on. */
  faults: string[]
}

export interface Variant {
  id: string
  stage: StageId
  name: string
  /** One line under the variant selector. */
  summary: string
  /** Longer description shown in the explanation panel when selected. */
  detail: string
  params: ParamDef[]
  /** Runs before any fragment is built, so a variant can alias node names
   *  (the backplate-polarised capsule wires its diaphragm straight to the gate). */
  prepare?: (b: NetlistBuilder, v: ParamValues, ctx: BuildContext) => void
  /** Add this variant's elements to the netlist. */
  build: (b: NetlistBuilder, v: ParamValues, ctx: BuildContext) => void
  /** Derived quantities for the explanation engine and the slider read-outs. */
  derived: (v: ParamValues, ctx: BuildContext) => Derived[]
  /** Real hardware this topology comes from. */
  hardware?: string
}

export const num = (v: ParamValues, k: string, fallback = 0): number => {
  const x = v[k]
  return typeof x === 'number' ? x : fallback
}
export const str = (v: ParamValues, k: string, fallback = ''): string => {
  const x = v[k]
  return typeof x === 'string' ? x : fallback
}

/** Default values for a variant, as a plain object. */
export function defaults(variant: Variant): ParamValues {
  const out: ParamValues = {}
  for (const p of variant.params) {
    if (p.kind === 'enum') out[p.key] = p.enumDefault ?? p.enumOptions?.[0]?.value ?? ''
    else out[p.key] = p.default
  }
  return out
}
