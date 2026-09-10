import { useEffect, useMemo, useState } from 'react'
import { useStore } from '../store/store'
import { Schematic } from './schematic/Schematic'
import { ResponseGraph } from './ResponseGraph'
import { buildCircuit } from '../stages/build'
import { MicEngine } from '../audio/engine'
import { DEMOS } from '../audio/demo'
import { interpAt } from '../solver/ac'
import type { AnalysisResult } from '../solver/analysis'
import { PRESETS } from '../data/presets'
import { ModelNotice } from './ModelNotice'
import { Explained } from './Explained'

/**
 * The assembly walkthrough — one part at a time.
 *
 * Deliberately not the three-pane builder. There is one thing to read, one
 * picture, one graph and one button. Everything you can adjust in free build is
 * absent here on purpose: the question this screen answers is "what is this part
 * for", and every extra control is a chance to lose the thread.
 */
export function AssemblyMode({ engine }: { engine: MicEngine | null }) {
  const build = useStore((s) => s.build)
  const steps = useStore((s) => s.assembly)
  const index = useStore((s) => s.assemblyIndex)
  const goto = useStore((s) => s.assemblyGoto)
  const result = useStore((s) => s.result)
  const baseline = useStore((s) => s.stepBaseline)
  const solving = useStore((s) => s.solving)
  const setMode = useStore((s) => s.exitLesson)
  const startAssembly = useStore((s) => s.startAssembly)
  const presetId = useStore((s) => s.presetId)

  const [playing, setPlaying] = useState(false)
  const [clip, setClip] = useState(DEMOS[1].id)

  const step = steps[index]
  const next = steps[index + 1]

  useEffect(() => {
    if (!engine || !result) return
    engine.update(result, [])
  }, [engine, result])

  const notes = useMemo(() => {
    const map: Record<string, { label: string; note: string }> = {}
    try {
      for (const el of buildCircuit(build).netlist.elements) {
        map[el.id] = { label: el.label ?? el.id, note: el.note ?? '' }
      }
    } catch {
      /* nothing to show this frame */
    }
    return map
  }, [build])

  if (!step) return null

  const toggle = async () => {
    if (!engine) return
    await engine.resume()
    if (playing) {
      engine.stop()
      setPlaying(false)
    } else {
      const demo = DEMOS.find((d) => d.id === clip)
      if (demo) engine.loadDemo(demo)
      engine.play()
      setPlaying(true)
    }
  }

  return (
    <div className="flex h-full flex-col bg-zinc-950">
      {/* ---------------------------------------------------------- header */}
      <header className="flex shrink-0 items-center gap-3 border-b border-zinc-800 px-4 py-2.5">
        <span className="text-sm font-semibold tracking-tight text-zinc-100">Mic Lab</span>
        <span className="text-xs text-zinc-500">
          Building a microphone, one part at a time
        </span>

        <label className="ml-auto flex items-center gap-1.5 text-xs">
          <span className="text-zinc-500">Board</span>
          <select
            value={presetId ?? ''}
            onChange={(e) => startAssembly(e.target.value)}
            className="rounded border border-zinc-700 bg-zinc-900 px-1.5 py-1 text-zinc-200"
          >
            {PRESETS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <ModelNotice compact />
        <button
          onClick={setMode}
          className="rounded px-2 py-1 text-xs text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300"
          title="The full builder, with every value adjustable"
        >
          Free build →
        </button>
      </header>

      {/* ------------------------------------------------------- progress */}
      <div className="flex shrink-0 items-center gap-2 border-b border-zinc-800 px-4 py-2">
        <span className="w-24 shrink-0 text-[11px] tabular text-zinc-500">
          Part {index + 1} of {steps.length}
        </span>
        <div className="flex flex-1 gap-1">
          {steps.map((s, i) => (
            <button
              key={s.id}
              onClick={() => goto(i)}
              title={s.title}
              className={`h-1.5 flex-1 rounded-full transition-colors ${
                i < index ? 'bg-copper-700' : i === index ? 'bg-copper-400' : 'bg-zinc-800 hover:bg-zinc-700'
              }`}
            />
          ))}
        </div>
      </div>

      {/* ----------------------------------------------------------- body */}
      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <div className="flex min-w-0 flex-col lg:w-[58%]">
          <div className="shrink-0 border-b border-zinc-800">
            <Schematic
              build={build}
              activeStage="capsule"
              selected={null}
              onSelect={() => {}}
              notes={notes}
              fitted={step.enabled}
              justAdded={new Set(step.adds)}
              quiet
            />
          </div>
          <div className="min-h-0 flex-1 border-b border-zinc-800 lg:border-b-0">
            {result ? (
              <ResponseGraph
                result={result}
                activeStage="capsule"
                showStages={false}
                before={baseline}
                beforeLabel={steps[index - 1] ? `before “${steps[index - 1].title}”` : 'before'}
              />
            ) : (
              <div className="flex h-full items-center justify-center text-xs text-zinc-600">Solving…</div>
            )}
          </div>
        </div>

        {/* ------------------------------------------------------ the text */}
        <div className="min-h-0 flex-1 overflow-y-auto border-zinc-800 lg:border-l">
          <div className="p-5">
            <h2 className="text-lg font-medium text-zinc-100">{step.title}</h2>
            <p className="mt-1 text-[11px] text-zinc-600">
              Words with a dotted underline are explained — hover or tap them.
            </p>

            {step.what.split('\n\n').map((para, i) => (
              <Explained key={i} className="mt-3 text-[13.5px] leading-relaxed text-zinc-300">
                {para}
              </Explained>
            ))}

            <h3 className="mt-5 text-[11px] uppercase tracking-wider text-copper-400">
              What to look for
            </h3>
            <Explained className="mt-1.5 text-[13px] leading-relaxed text-zinc-400">
              {step.expect}
            </Explained>

            {result ? <Changed result={result} prev={baseline} solving={solving} /> : null}
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------ transport */}
      <div className="flex shrink-0 flex-wrap items-center gap-3 border-t border-zinc-800 px-4 py-2.5">
        <button
          onClick={() => goto(index - 1)}
          disabled={index === 0}
          className="rounded border border-zinc-700 px-3 py-1.5 text-xs text-zinc-300 transition-colors hover:border-zinc-600 disabled:opacity-30"
        >
          ← Back
        </button>

        <button
          onClick={toggle}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-copper-600 text-zinc-950 transition-colors hover:bg-copper-500"
          aria-label={playing ? 'Stop' : 'Play'}
        >
          {playing ? '■' : '▶'}
        </button>
        <select
          value={clip}
          onChange={(e) => {
            setClip(e.target.value)
            const demo = DEMOS.find((d) => d.id === e.target.value)
            if (demo && engine) engine.loadDemo(demo)
          }}
          className="rounded border border-zinc-700 bg-zinc-900 px-1.5 py-1 text-xs text-zinc-200"
        >
          {DEMOS.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
        {result?.silent ? (
          <span className="text-[11px] text-amber-300/80">
            Nothing to hear yet — that is the point of this step.
          </span>
        ) : null}

        <button
          onClick={() => goto(index + 1)}
          disabled={index >= steps.length - 1}
          className="ml-auto flex items-baseline gap-2 rounded bg-copper-600 px-3 py-1.5 text-xs text-zinc-950 transition-colors hover:bg-copper-500 disabled:opacity-30"
        >
          {next ? (
            <>
              <span className="hidden text-copper-900/70 sm:inline">Next:</span>
              <span className="max-w-[190px] truncate">{next.title}</span>
            </>
          ) : (
            <span>Finished</span>
          )}
          <span>→</span>
        </button>
      </div>
    </div>
  )
}

/**
 * What fitting this part actually did, measured rather than asserted.
 *
 * Only the numbers that moved are shown: a step where nothing changes says so,
 * which is more useful than a table of identical figures.
 */
function Changed({
  result,
  prev,
  solving,
}: {
  result: AnalysisResult
  prev: AnalysisResult | null
  solving: boolean
}) {
  const rows: Array<{ label: string; value: string }> = []

  if (result.silent) {
    rows.push({ label: 'Output', value: 'none at all' })
  } else {
    const level =
      prev && !prev.silent
        ? `${(result.sensitivity * 1000).toFixed(1)} mV/Pa (${signed(
            result.sensitivityDbv - prev.sensitivityDbv,
          )} dB)`
        : `${(result.sensitivity * 1000).toFixed(1)} mV/Pa`
    rows.push({ label: 'Output', value: level })
    rows.push({ label: 'Self-noise', value: `${result.selfNoiseDbA.toFixed(1)} dB-A` })
    if (prev && !prev.silent) {
      const d40 = interpAt(result.freqs, result.mag, 40) - interpAt(prev.freqs, prev.mag, 40)
      const d10k = interpAt(result.freqs, result.mag, 10000) - interpAt(prev.freqs, prev.mag, 10000)
      if (Math.abs(d40) > 0.1 || Math.abs(d10k) > 0.1) {
        rows.push({ label: 'Shape', value: `${signed(d40)} dB at 40 Hz, ${signed(d10k)} dB at 10 kHz` })
      }
    }
  }

  const nothingMoved =
    prev &&
    !result.silent &&
    !prev.silent &&
    Math.abs(result.sensitivityDbv - prev.sensitivityDbv) < 0.05 &&
    Math.abs(result.selfNoiseDbA - prev.selfNoiseDbA) < 0.05

  return (
    <div className="mt-5 rounded border border-zinc-800 bg-zinc-900/40 p-3">
      <div className="mb-2 flex items-baseline justify-between">
        <span className="text-[11px] uppercase tracking-wider text-zinc-500">
          What fitting it did
        </span>
        {solving ? <span className="text-[10px] text-copper-500/70">solving…</span> : null}
      </div>
      <dl className="space-y-1 text-xs">
        {rows.map((r) => (
          <div key={r.label} className="flex items-baseline justify-between gap-3">
            <dt className="text-zinc-500">{r.label}</dt>
            <dd className="tabular text-zinc-200">{r.value}</dd>
          </div>
        ))}
      </dl>
      {nothingMoved ? (
        <p className="mt-2 text-[11px] leading-relaxed text-zinc-500">
          Nothing measurable changed. That is a real answer, not a missing one — some parts are there to
          make the next one possible.
        </p>
      ) : null}
    </div>
  )
}

const signed = (v: number): string => `${v >= 0 ? '+' : '−'}${Math.abs(v).toFixed(1)}`
