import type { BuildSpec } from '../stages/build'
import { STAGE_ORDER, variantFor, withDefaults } from '../stages/build'
import { defaults } from '../stages/types'
import { FAULTS } from '../stages/faults'

/**
 * Builds are URL-encodable so one can be bookmarked or sent to someone.
 *
 * Only values that differ from the variant's defaults are written, which keeps
 * a shared link short and readable: `?capsule=k67&pol=diaphragm.R_pol:1e8&...`
 */

const KEYS: Record<string, string> = {
  capsule: 'cap',
  polarisation: 'pol',
  converter: 'conv',
  output: 'out',
  load: 'load',
}

export function encodeBuild(spec: BuildSpec): string {
  const parts: string[] = []
  for (const stage of STAGE_ORDER) {
    const sel = spec[stage]
    const variant = variantFor(stage, sel.variant)
    const base = defaults(variant)
    const diffs: string[] = []
    for (const [k, v] of Object.entries(sel.values)) {
      if (base[k] === v) continue
      diffs.push(`${k}:${typeof v === 'number' ? shortNum(v) : v}`)
    }
    parts.push(`${KEYS[stage]}=${[variant.id, ...diffs].join('.')}`)
  }
  if (spec.faults.length > 0) {
    parts.push(
      `f=${spec.faults
        .map((f) => [f.id, ...Object.entries(f.values).map(([k, v]) => `${k}:${shortNum(Number(v))}`)].join('.'))
        .join('!')}`,
    )
  }
  return parts.join('&')
}

const shortNum = (v: number): string => {
  const s = v.toPrecision(6)
  return String(Number(s))
}

export function decodeBuild(query: string, base: BuildSpec): BuildSpec {
  const params = new URLSearchParams(query)
  const next: BuildSpec = { ...base, faults: [] }
  for (const stage of STAGE_ORDER) {
    const raw = params.get(KEYS[stage])
    if (!raw) continue
    const [variantId, ...pairs] = raw.split('.')
    const values: Record<string, number | string> = {}
    for (const p of pairs) {
      const idx = p.indexOf(':')
      if (idx < 0) continue
      const k = p.slice(0, idx)
      const v = p.slice(idx + 1)
      const n = Number(v)
      values[k] = isFinite(n) && v.trim() !== '' ? n : v
    }
    next[stage] = withDefaults(stage, { variant: variantId, values })
  }
  const f = params.get('f')
  if (f) {
    next.faults = f
      .split('!')
      .map((entry) => {
        const [id, ...pairs] = entry.split('.')
        if (!FAULTS.some((x) => x.id === id)) return null
        const values: Record<string, number> = {}
        for (const p of pairs) {
          const [k, v] = p.split(':')
          if (k && v !== undefined) values[k] = Number(v)
        }
        return { id, values }
      })
      .filter((x): x is { id: string; values: Record<string, number> } => x !== null)
  }
  return next
}
