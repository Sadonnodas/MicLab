import { useEffect, useMemo, useRef, useState } from 'react'
import { useStore } from './store/store'
import { Header } from './ui/Header'
import { Schematic } from './ui/schematic/Schematic'
import { StageStrip } from './ui/StageStrip'
import { ResponseGraph } from './ui/ResponseGraph'
import { NoiseView } from './ui/NoiseView'
import { OperatingPointView } from './ui/OperatingPointView'
import { ExplanationPanel } from './ui/ExplanationPanel'
import { Transport } from './ui/Transport'
import { HardwareWarnings } from './ui/HardwareWarnings'
import { LessonDrawer } from './ui/LessonDrawer'
import { MicEngine } from './audio/engine'
import { buildCircuit } from './stages/build'
import { referenceById } from './data/references'
import { eng } from './lib/format'

/**
 * Three panes and a transport bar, as in the handoff sketch: schematic and
 * stage controls on the left, response and explanation on the right.
 */
export default function App() {
  const build = useStore((s) => s.build)
  const result = useStore((s) => s.result)
  const stage = useStore((s) => s.selectedStage)
  const selected = useStore((s) => s.selectedElement)
  const selectElement = useStore((s) => s.selectElement)
  const graphTab = useStore((s) => s.graphTab)
  const setGraphTab = useStore((s) => s.setGraphTab)
  const compareRef = useStore((s) => s.compareRef)
  const mode = useStore((s) => s.mode)

  const engineRef = useRef<MicEngine | null>(null)
  const [engine, setEngine] = useState<MicEngine | null>(null)
  const [showStages, setShowStages] = useState(true)

  // The AudioContext has to wait for a gesture, so it is created on first click.
  useEffect(() => {
    const start = () => {
      if (!engineRef.current) {
        engineRef.current = new MicEngine()
        setEngine(engineRef.current)
      }
      window.removeEventListener('pointerdown', start)
      window.removeEventListener('keydown', start)
    }
    window.addEventListener('pointerdown', start)
    window.addEventListener('keydown', start)
    return () => {
      window.removeEventListener('pointerdown', start)
      window.removeEventListener('keydown', start)
    }
  }, [])

  // Component notes for the schematic's hover strip, straight from the netlist.
  const notes = useMemo(() => {
    const map: Record<string, { label: string; note: string; value?: string }> = {}
    try {
      const { netlist } = buildCircuit(build)
      for (const el of netlist.elements) {
        map[el.id] = {
          label: el.label ?? el.id,
          note: el.note ?? '',
          value:
            el.kind === 'R'
              ? eng(el.params.R, 'Ω')
              : el.kind === 'C'
                ? eng(el.params.C, 'F')
                : el.kind === 'L'
                  ? eng(el.params.L, 'H')
                  : el.kind === 'V'
                    ? `${el.params.V} V`
                    : undefined,
        }
      }
    } catch {
      /* a half-built netlist just means no hover text this frame */
    }
    return map
  }, [build])

  const reference = compareRef ? referenceById(compareRef) : null

  return (
    <div className="flex h-full flex-col bg-zinc-950 text-zinc-100">
      <Header />
      <div className="flex min-h-0 flex-1">
        {mode === 'lesson' ? <LessonDrawer /> : null}

        <main className="flex min-h-0 min-w-0 flex-1 flex-col">
          <HardwareWarnings />
          <div className="flex min-h-0 flex-1 flex-col xl:flex-row">
            {/* left column: schematic over stage controls */}
            <div className="flex min-h-0 min-w-0 flex-col xl:w-[54%] xl:border-r xl:border-zinc-800">
              <div className="shrink-0 border-b border-zinc-800">
                <Schematic
                  build={build}
                  activeStage={stage}
                  selected={selected}
                  onSelect={selectElement}
                  notes={notes}
                />
              </div>
              <div className="min-h-0 flex-1">
                <StageStrip />
              </div>
            </div>

            {/* right column: graph over explanation */}
            <div className="flex min-h-0 min-w-0 flex-col xl:flex-1">
              <div className="flex min-h-[340px] flex-1 flex-col border-b border-zinc-800 xl:min-h-0">
                <div className="flex shrink-0 items-center gap-1 border-b border-zinc-800 px-2 py-1">
                  {(['response', 'noise', 'op'] as const).map((t) => (
                    <button
                      key={t}
                      onClick={() => setGraphTab(t)}
                      className={`rounded px-2 py-1 text-[11px] transition-colors ${
                        graphTab === t ? 'bg-copper-600/20 text-copper-200' : 'text-zinc-500 hover:text-zinc-300'
                      }`}
                    >
                      {t === 'response' ? 'Response' : t === 'noise' ? 'Noise' : 'Operating point'}
                    </button>
                  ))}
                  {graphTab === 'response' ? (
                    <label className="ml-auto flex cursor-pointer items-center gap-1.5 pr-1 text-[11px] text-zinc-500">
                      <input
                        type="checkbox"
                        checked={showStages}
                        onChange={(e) => setShowStages(e.target.checked)}
                        className="accent-copper-500"
                      />
                      Per-stage contribution
                    </label>
                  ) : null}
                </div>
                <div className="min-h-0 flex-1">
                  {!result ? (
                    <div className="flex h-full items-center justify-center text-xs text-zinc-600">Solving…</div>
                  ) : graphTab === 'response' ? (
                    <ResponseGraph
                      result={result}
                      reference={reference}
                      activeStage={stage}
                      showStages={showStages}
                    />
                  ) : graphTab === 'noise' ? (
                    <NoiseView result={result} />
                  ) : (
                    <OperatingPointView result={result} />
                  )}
                </div>
              </div>
              <div className="h-[38%] min-h-[170px] shrink-0 overflow-hidden">
                <ExplanationPanel />
              </div>
            </div>
          </div>
          <Transport engine={engine} />
        </main>
      </div>
    </div>
  )
}
