import tlm103 from './references/tlm103.json'
import sphere from './references/sphere.json'

export interface ReferenceMic {
  id: string
  name: string
  approximate: boolean
  note: string
  selfNoiseDbA: number
  freqs: number[]
  db: number[]
}

export const REFERENCES: ReferenceMic[] = [tlm103, sphere]

export const referenceById = (id: string): ReferenceMic | undefined =>
  REFERENCES.find((r) => r.id === id)
