import { useMemo } from 'react'
import { useStore } from '../store/store'
import { STAGE_ORDER, VARIANTS, derivedQuantities, variantFor } from '../stages/build'
import type { BuildStage } from '../solver/netlist'
import { ParamControl } from './ParamControl'
import { unlockedFor } from '../lessons/lessons'
import { withSolverValues } from '../explain/engine'
import { FaultPanel } from './FaultPanel'

/**
 * The stage strip: pick a topology, then set its values.
 *
 * In lesson mode the controls a lesson has not reached yet are visible but
 * locked, so the shape of the whole microphone is always on screen even when
 * only one part of it is yours to touch.
 */

const STAGE_LABELS: Record<BuildStage, string> = {
  capsule: 'Capsule',
  polarisation: 'Polarisation',
  converter: 'Converter',
  output: 'Output',
  load: 'Load',
}

export function StageStrip() {
  const build = useStore((s) => s.build)
  const result = useStore((s) => s.result)
  const stage = useStore((s) => s.selectedStage)
  const selectStage = useStore((s) => s.selectStage)
  const setVariant = useStore((s) => s.setVariant)
  const setParam = useStore((s) => s.setParam)
  const selected = useStore((s) => s.selectedElement)
  const lesson = useStore((s) => s.lesson)
  const mode = useStore((s) => s.mode)

  const variant = variantFor(stage, build[stage].variant)
  const unlocked = unlockedFor(mode === 'lesson' ? lesson : null)

  const derived = useMemo(() => {
    try {
      return withSolverValues(derivedQuantities(build), result)
    } catch {
      return {}
    }
  }, [build, result])

  // The derived quantity a slider should show sits next to it via `attachTo`.
  const derivedFor = (key: string) => {
    for (const [k, d] of Object.entries(derived)) {
      if (!k.startsWith(`${stage}.`)) continue
      if (d.attachTo !== key) continue
      const text = d.format ? d.format(d.value) : `${d.value.toPrecision(3)} ${d.unit}`
      return { label: d.label, text: d.fromSolver === 'stageCorner' && d.value === 0 ? 'below 5 Hz' : text }
    }
    return undefined
  }

  const selectedParam = selected?.startsWith(`${stagePrefix(stage)}.`)
    ? selected.slice(stagePrefix(stage).length + 1)
    : null

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 border-b border-zinc-800">
        {STAGE_ORDER.map((s, i) => (
          <button
            key={s}
            onClick={() => selectStage(s)}
            className={`relative flex-1 border-r border-zinc-800 px-1 py-2 text-[10.5px] uppercase tracking-wider transition-colors last:border-r-0 ${
              s === stage ? 'bg-copper-600/15 text-copper-300' : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            {i > 0 ? <span className="absolute left-0 top-1/2 -translate-x-1/2 -translate-y-1/2 text-zinc-700">›</span> : null}
            {STAGE_LABELS[s]}
          </button>
        ))}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="border-b border-zinc-800 p-3">
          <label className="mb-1 block text-[10.5px] uppercase tracking-wider text-zinc-500">Topology</label>
          <select
            value={variant.id}
            onChange={(e) => setVariant(stage, e.target.value)}
            disabled={VARIANTS[stage].length < 2}
            className="w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-xs text-zinc-200 disabled:opacity-50"
          >
            {VARIANTS[stage].map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
          </select>
          <p className="mt-1.5 text-[11px] leading-snug text-zinc-500">{variant.summary}</p>
          {variant.hardware ? (
            <p className="mt-1 text-[10.5px] text-copper-400/70">as built in: {variant.hardware}</p>
          ) : null}
        </div>

        <div className="p-1">
          {variant.params.length === 0 ? (
            <p className="p-3 text-[11px] text-zinc-500">
              This topology has nothing to adjust — which is rather the point of it.
            </p>
          ) : null}
          {variant.params.map((p) => (
            <ParamControl
              key={p.key}
              def={p}
              value={build[stage].values[p.key] ?? p.default}
              derived={derivedFor(p.key)}
              locked={!unlocked(p.lesson)}
              lockReason={`Unlocked in lesson ${p.lesson}.`}
              highlighted={selectedParam === p.key}
              onChange={(v) => setParam(stage, p.key, v)}
            />
          ))}
        </div>

        {stage === 'load' ? <FaultPanel /> : null}
      </div>
    </div>
  )
}

const stagePrefix = (stage: BuildStage) =>
  ({ capsule: 'capsule', polarisation: 'pol', converter: 'conv', output: 'out', load: 'load' })[stage]
