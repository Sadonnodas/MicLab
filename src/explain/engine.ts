import type { AnalysisResult } from '../solver/analysis'
import { derivedQuantities, variantFor, type BuildSpec } from '../stages/build'
import type { Derived } from '../stages/types'
import { interpAt } from '../solver/ac'
import type { BuildStage } from '../solver/netlist'
import { eng } from '../lib/format'
import { FAULTS } from '../stages/faults'

/**
 * The explanation engine.
 *
 * Not free text and not a lookup table of canned sentences: each stage variant
 * declares *derived quantities* — the polarisation corner, the shelf depth, the
 * stray-capacitance loss — with a formula and a template. On every change the
 * engine works out which of those moved most and renders those templates with
 * the old and new values, then adds one sentence of what the solver actually
 * measured. That way the narration is always about the thing you just touched,
 * and it is always true, because it comes from the same numbers as the graph.
 */

export interface ExplanationItem {
  key: string
  label: string
  text: string
  why: string
}

export interface Explanation {
  headline: string
  items: ExplanationItem[]
  summary: string
}

const STAGE_NAMES: Record<string, string> = {
  capsule: 'capsule',
  polarisation: 'polarisation',
  converter: 'impedance converter',
  output: 'output',
  load: 'cable and preamp',
}

const STAGES: BuildStage[] = ['capsule', 'polarisation', 'converter', 'output', 'load']

const fmt = (d: Derived, v: number): string => (d.format ? d.format(v) : `${v.toPrecision(3)} ${d.unit}`)

function paramLabel(spec: BuildSpec, stage: BuildStage, key: string): string {
  const variant = variantFor(stage, spec[stage].variant)
  return variant.params.find((p) => p.key === key)?.label ?? key
}

function paramText(spec: BuildSpec, stage: BuildStage, key: string, value: number | string): string {
  const variant = variantFor(stage, spec[stage].variant)
  const p = variant.params.find((x) => x.key === key)
  if (!p) return String(value)
  if (typeof value === 'string') return p.enumOptions?.find((o) => o.value === value)?.label ?? value
  if (p.unit === 'Ω' || p.unit === 'F' || p.unit === 'H') return eng(value, p.unit)
  if (p.unit === 'Hz') return eng(value, 'Hz')
  if (p.unit === '') return value.toPrecision(3)
  return `${Number(value.toPrecision(4))} ${p.unit}`
}

/** What changed between two builds, in words. */
function headlineFor(prev: BuildSpec, next: BuildSpec): { headline: string; touched: BuildStage[] } {
  const touched: BuildStage[] = []
  const parts: string[] = []

  for (const stage of STAGES) {
    if (prev[stage].variant !== next[stage].variant) {
      const to = variantFor(stage, next[stage].variant)
      parts.push(`switched the ${STAGE_NAMES[stage]} to “${to.name}”`)
      touched.push(stage)
      continue
    }
    for (const [key, value] of Object.entries(next[stage].values)) {
      const before = prev[stage].values[key]
      if (before === value || before === undefined) continue
      const dir =
        typeof value === 'number' && typeof before === 'number'
          ? value > before
            ? 'raised'
            : 'lowered'
          : 'changed'
      parts.push(
        `${dir} ${paramLabel(next, stage, key)} from ${paramText(next, stage, key, before)} to ${paramText(next, stage, key, value)}`,
      )
      if (!touched.includes(stage)) touched.push(stage)
    }
  }

  const prevFaults = new Set(prev.faults.map((f) => f.id))
  const nextFaults = new Set(next.faults.map((f) => f.id))
  for (const f of FAULTS) {
    if (nextFaults.has(f.id) && !prevFaults.has(f.id)) parts.push(`switched on “${f.name}”`)
    if (!nextFaults.has(f.id) && prevFaults.has(f.id)) parts.push(`cleared “${f.name}”`)
  }

  if (parts.length === 0) return { headline: '', touched }
  const list = parts.length === 1 ? parts[0] : `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`
  return { headline: `You ${list}.`, touched }
}

/** One sentence of what the solver measured, so the narration is never hand-waving. */
function summarise(prev: AnalysisResult | null, next: AnalysisResult): string {
  const at = (r: AnalysisResult, f: number) => interpAt(r.freqs, r.mag, f)
  const bits: string[] = []
  if (prev) {
    const d40 = at(next, 40) - at(prev, 40)
    const d10k = at(next, 10000) - at(prev, 10000)
    const dSens = next.sensitivityDbv - prev.sensitivityDbv
    if (Math.abs(d40) > 0.05 || Math.abs(d10k) > 0.05) {
      bits.push(`${signed(d40)} dB at 40 Hz, ${signed(d10k)} dB at 10 kHz`)
    }
    if (Math.abs(dSens) > 0.05) bits.push(`sensitivity ${signed(dSens)} dB`)
    if (Math.abs(next.selfNoiseDbA - prev.selfNoiseDbA) > 0.05) {
      bits.push(`self-noise ${prev.selfNoiseDbA.toFixed(1)} → ${next.selfNoiseDbA.toFixed(1)} dB-A`)
    }
  }
  if (next.hum.length > 0 && isFinite(next.humTotalSpl)) {
    bits.push(
      next.humTotalSpl < 0
        ? 'hum below 0 dB SPL equivalent — inaudible'
        : `hum ${next.humTotalSpl.toFixed(0)} dB SPL equivalent`,
    )
  }
  if (bits.length === 0) {
    return `Now: ${(next.sensitivity * 1000).toFixed(1)} mV/Pa, ${next.selfNoiseDbA.toFixed(1)} dB-A self-noise.`
  }
  return `Overall: ${bits.join(', ')}.`
}

/**
 * A fault that the circuit rejects is as instructive as one it does not, so the
 * panel always compares the hum it produced with the noise floor it landed in.
 */
function describeHum(r: AnalysisResult): string {
  if (r.hum.length === 0 || !isFinite(r.humTotalSpl)) return ''
  const margin = r.humTotalSpl - r.selfNoiseDbA
  const level =
    r.humTotalSpl < 0
      ? `It comes out below 0 dB SPL equivalent, against a ${r.selfNoiseDbA.toFixed(0)} dB-A noise floor`
      : `It comes out at ${r.humTotalSpl.toFixed(0)} dB SPL equivalent, against a ${r.selfNoiseDbA.toFixed(0)} dB-A noise floor`
  if (margin < -6) {
    return `${level} — so this build is rejecting it almost completely, and it is buried in the hiss. Worth asking why, and worth trying the same fault on a different output stage.`
  }
  if (margin < 6) return `${level} — about level with the microphone's own hiss.`
  return `${level}: ${margin.toFixed(0)} dB above the noise floor, and the loudest thing the microphone does when nobody is playing.`
}

const signed = (v: number): string => `${v >= 0 ? '+' : '−'}${Math.abs(v).toFixed(1)}`

export interface ExplainInput {
  prevBuild: BuildSpec | null
  nextBuild: BuildSpec
  prevResult: AnalysisResult | null
  nextResult: AnalysisResult
}

export function explain({ prevBuild, nextBuild, prevResult, nextResult }: ExplainInput): Explanation {
  const nextDerived = withSolverValues(derivedQuantities(nextBuild), nextResult)
  const prevDerived = prevBuild ? withSolverValues(derivedQuantities(prevBuild), prevResult) : {}

  const { headline, touched } = prevBuild
    ? headlineFor(prevBuild, nextBuild)
    : { headline: '', touched: [] as BuildStage[] }

  const items: ExplanationItem[] = []

  // A fault is the most interesting thing that can happen, so it goes first.
  if (prevBuild) {
    const before = new Set(prevBuild.faults.map((f) => f.id))
    for (const sel of nextBuild.faults) {
      if (before.has(sel.id)) continue
      const fault = FAULTS.find((f) => f.id === sel.id)
      if (!fault) continue
      items.push({
        key: `fault.${fault.id}`,
        label: fault.name,
        text: `${fault.symptom} ${describeHum(nextResult)}`,
        why: fault.explanation,
      })
    }
  }

  // A variant swap deserves its own paragraph — the topology changed, not a value.
  if (prevBuild) {
    for (const stage of STAGES) {
      if (prevBuild[stage].variant === nextBuild[stage].variant) continue
      const v = variantFor(stage, nextBuild[stage].variant)
      items.push({
        key: `variant.${stage}`,
        label: v.name,
        text: v.summary,
        why: v.detail,
      })
    }
  }

  // Then whichever derived quantities moved most, preferring the stage touched.
  const ranked = Object.entries(nextDerived)
    .map(([key, d]) => {
      const before = prevDerived[key]
      if (!before || !isFinite(before.value) || !isFinite(d.value)) return null
      const rel = Math.abs(Math.log(Math.abs(d.value) + 1e-30) - Math.log(Math.abs(before.value) + 1e-30))
      const abs = Math.abs(d.value - before.value)
      if (rel < 0.005 && abs < 1e-9) return null
      const stageBoost = touched.includes(key.split('.')[0] as BuildStage) ? 3 : 1
      return { key, d, before, score: rel * stageBoost }
    })
    .filter((x): x is { key: string; d: Derived; before: Derived; score: number } => x !== null)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3 - items.length)

  for (const r of ranked) {
    items.push({
      key: r.key,
      label: r.d.label,
      text: r.d.sentence(fmt(r.before, r.before.value), fmt(r.d, r.d.value)),
      why: r.d.why,
    })
  }

  // Nothing moved (first solve, or a change with no derived consequence): say
  // something useful about the build as it stands instead of nothing at all.
  if (items.length === 0) {
    for (const stage of STAGES) {
      const v = variantFor(stage, nextBuild[stage].variant)
      if (stage === 'capsule' || stage === 'converter') {
        items.push({ key: `variant.${stage}`, label: v.name, text: v.summary, why: v.detail })
      }
    }
  }

  return {
    headline: headline || describeBuild(nextBuild),
    items: items.slice(0, 3),
    summary: summarise(prevResult, nextResult),
  }
}

function describeBuild(spec: BuildSpec): string {
  const names = STAGES.slice(0, 4).map((s) => variantFor(s, spec[s].variant).name)
  return `${names[0]} → ${names[1]} → ${names[2]} → ${names[3]}.`
}

/**
 * Replace the quantities that are better measured than calculated with what the
 * solver actually found. See `Derived.fromSolver`.
 */
export function withSolverValues(
  derived: Record<string, Derived>,
  result: AnalysisResult | null,
): Record<string, Derived> {
  if (!result) return derived
  const out: Record<string, Derived> = {}
  for (const [key, d] of Object.entries(derived)) {
    const stage = key.split('.')[0]
    if (d.fromSolver === 'stageGain' && result.op.fets[0]) {
      out[key] = { ...d, value: result.op.fets[0].gainDb }
    } else if (d.fromSolver === 'stageCorner') {
      const measured = result.stageCorners[stage]
      out[key] = { ...d, value: measured > 0 ? measured : 0 }
    } else {
      out[key] = d
    }
  }
  return out
}
