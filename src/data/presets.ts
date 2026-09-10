import type { BuildSpec, StageSelection } from '../stages/build'
import { variantFor } from '../stages/build'
import { defaults } from '../stages/types'
import type { BuildStage } from '../solver/netlist'

import textbookU87 from './presets/textbook-u87.json'
import bluejay from './presets/bluejay.json'
import raven from './presets/raven.json'
import sdc from './presets/sdc-electret.json'
import schoeps from './presets/textbook-schoeps.json'
import blank from './presets/blank.json'

export interface Preset {
  id: string
  name: string
  description: string
  /** False when the values are textbook defaults standing in for a real board. */
  verified: boolean
  hardware?: string
  /** Parameter keys whose values are assumed rather than measured. */
  unverified?: string[]
  build: BuildSpec
}

interface RawPreset {
  id: string
  name: string
  description: string
  verified: boolean
  hardware?: string
  unverified?: string[]
  stages: Record<string, { variant: string; values: Record<string, number | string> }>
  faults: Array<{ id: string; values?: Record<string, number> }>
}

const STAGES: BuildStage[] = ['capsule', 'polarisation', 'converter', 'output', 'load']

function hydrate(raw: RawPreset): Preset {
  const stages = {} as Record<BuildStage, StageSelection>
  for (const stage of STAGES) {
    const s = raw.stages[stage]
    const variant = variantFor(stage, s?.variant ?? '')
    stages[stage] = { variant: variant.id, values: { ...defaults(variant), ...(s?.values ?? {}) } }
  }
  return {
    id: raw.id,
    name: raw.name,
    description: raw.description,
    verified: raw.verified,
    hardware: raw.hardware,
    unverified: raw.unverified,
    build: {
      capsule: stages.capsule,
      polarisation: stages.polarisation,
      converter: stages.converter,
      output: stages.output,
      load: stages.load,
      faults: (raw.faults ?? []).map((f) => ({ id: f.id, values: f.values ?? {} })),
    },
  }
}

export const PRESETS: Preset[] = [
  bluejay,
  raven,
  sdc,
  textbookU87,
  schoeps,
  blank,
].map((p) => hydrate(p as RawPreset))

export const presetById = (id: string): Preset | undefined => PRESETS.find((p) => p.id === id)

/** The build the solver's golden file is generated from. */
export const referenceBuild = (): BuildSpec =>
  structuredClone(presetById('textbook-u87')!.build)
