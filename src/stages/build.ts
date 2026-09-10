import { NetlistBuilder, withOverrides, type BuildStage, type Netlist, type StageId } from '../solver/netlist'
import type { CapsuleSpec } from '../solver/capsule'
import type { BuildContext, Derived, ParamValues, Variant } from './types'
import { defaults } from './types'
import { CAPSULE_VARIANTS, capsuleVariant } from './capsule'
import { POLARISATION_VARIANTS, polarisationVariant } from './polarisation'
import { CONVERTER_VARIANTS, converterVariant } from './converter'
import { OUTPUT_VARIANTS, outputVariant } from './output'
import { LOAD_VARIANT } from './load'
import { FAULTS, faultById, type Overrides } from './faults'

export interface StageSelection {
  variant: string
  values: ParamValues
}

export interface FaultSelection {
  id: string
  values: ParamValues
}

export interface BuildSpec {
  capsule: StageSelection
  polarisation: StageSelection
  converter: StageSelection
  output: StageSelection
  load: StageSelection
  faults: FaultSelection[]
}

export const STAGE_ORDER: BuildStage[] = ['capsule', 'polarisation', 'converter', 'output', 'load']

export const VARIANTS: Record<string, Variant[]> = {
  capsule: CAPSULE_VARIANTS,
  polarisation: POLARISATION_VARIANTS,
  converter: CONVERTER_VARIANTS,
  output: OUTPUT_VARIANTS,
  load: [LOAD_VARIANT],
}

export function variantFor(stage: BuildStage, id: string): Variant {
  switch (stage) {
    case 'capsule':
      return capsuleVariant(id)
    case 'polarisation':
      return polarisationVariant(id)
    case 'converter':
      return converterVariant(id)
    case 'output':
      return outputVariant(id)
    default:
      return LOAD_VARIANT
  }
}

/** A complete default build: the reference U87-style textbook microphone. */
export function defaultBuild(): BuildSpec {
  return {
    capsule: { variant: 'k67', values: defaults(capsuleVariant('k67')) },
    polarisation: { variant: 'diaphragm', values: defaults(polarisationVariant('diaphragm')) },
    converter: { variant: 'cs-deemph', values: defaults(converterVariant('cs-deemph')) },
    output: { variant: 'transformerless', values: defaults(outputVariant('transformerless')) },
    load: { variant: 'standard', values: defaults(LOAD_VARIANT) },
    faults: [],
  }
}

/** Fill in any missing values from the variant defaults. */
export function withDefaults(stage: BuildStage, sel: StageSelection): StageSelection {
  const v = variantFor(stage, sel.variant)
  return { variant: v.id, values: { ...defaults(v), ...sel.values } }
}

export interface BuiltCircuit {
  netlist: Netlist
  capsule: CapsuleSpec
  ctx: BuildContext
  /** Per-stage "make this stage ideal" parameter overrides, for attribution. */
  stageIdeals: Record<StageId, Overrides>
  /** Overrides the active faults impose on the base circuit. */
  faultOverrides: Overrides
  variants: Record<StageId, Variant>
}

const EMPTY_CAPSULE: CapsuleSpec = {
  Ccaps: 55e-12,
  S0: 20e-3,
  Vref: 60,
  fres: 0,
  Qres: 1,
  presenceDb: 0,
  presenceF: 7000,
  presenceQ: 1,
  Nac: 0,
}

/** Turn a build specification into a netlist the solver can chew on. */
export function buildCircuit(spec: BuildSpec): BuiltCircuit {
  const variants: Record<StageId, Variant> = {
    capsule: variantFor('capsule', spec.capsule.variant),
    polarisation: variantFor('polarisation', spec.polarisation.variant),
    converter: variantFor('converter', spec.converter.variant),
    output: variantFor('output', spec.output.variant),
    load: LOAD_VARIANT,
    fault: LOAD_VARIANT,
  }
  const values: BuildContext['values'] = {
    capsule: { ...defaults(variants.capsule), ...spec.capsule.values },
    polarisation: { ...defaults(variants.polarisation), ...spec.polarisation.values },
    converter: { ...defaults(variants.converter), ...spec.converter.values },
    output: { ...defaults(variants.output), ...spec.output.values },
    load: { ...defaults(LOAD_VARIANT), ...spec.load.values },
    fault: {},
    faults: {},
  }

  const b = new NetlistBuilder()
  const ctx: BuildContext = {
    values,
    converterOut: 'drn',
    vdd: 12,
    capsule: { ...EMPTY_CAPSULE },
    idealOverrides: {},
    faults: spec.faults.map((f) => f.id),
  }

  // Aliases first: a variant may decide that two node names are the same node.
  for (const stage of STAGE_ORDER) {
    variants[stage].prepare?.(b, values[stage], ctx)
  }

  const stageIdeals: Record<string, Overrides> = {}
  for (const stage of STAGE_ORDER) {
    ctx.idealOverrides = {}
    variants[stage].build(b, values[stage], ctx)
    stageIdeals[stage] = ctx.idealOverrides
  }
  ctx.idealOverrides = {}

  const faultOverrides: Overrides = {}
  for (const sel of spec.faults) {
    const fault = faultById(sel.id)
    if (!fault) continue
    const fv: ParamValues = {}
    for (const p of fault.params) fv[p.key] = sel.values[p.key] ?? p.default
    fault.apply(b, fv, ctx, faultOverrides)
  }

  const netlist = withOverrides(b.build('loadp', 'loadn'), faultOverrides)
  return {
    netlist,
    capsule: ctx.capsule,
    ctx,
    stageIdeals: stageIdeals as Record<StageId, Overrides>,
    faultOverrides,
    variants,
  }
}

export { FAULTS, defaults }

/** Every derived quantity the current build exposes, keyed by stage and key. */
export function derivedQuantities(spec: BuildSpec): Record<string, Derived> {
  const built = buildCircuit(spec)
  const out: Record<string, Derived> = {}
  for (const stage of STAGE_ORDER) {
    for (const d of built.variants[stage].derived(built.ctx.values[stage], built.ctx)) {
      out[`${stage}.${d.key}`] = d
    }
  }
  return out
}
