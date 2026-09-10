import { useMemo, useState } from 'react'
import type { AnalysisResult } from '../solver/analysis'
import type { ReferenceMic } from '../data/references'
import { interpAt } from '../solver/ac'

/**
 * The response graph: 20 Hz – 20 kHz on a log axis, ±20 dB, normalised at 1 kHz.
 *
 * On top of the build's own curve it can show what each stage contributes (as
 * shaded bands), what the capsule alone would do, and a reference microphone.
 */

interface Props {
  result: AnalysisResult
  reference?: ReferenceMic | null
  activeStage: string
  showStages: boolean
}

const F_LO = 20
const F_HI = 20000
const DB_RANGE = 20
const W = 760
const H = 430
const PAD = { l: 44, r: 14, t: 14, b: 28 }

const STAGE_COLOURS: Record<string, string> = {
  capsule: '#e08a52',
  polarisation: '#60a5fa',
  converter: '#34d399',
  output: '#c084fc',
  load: '#fbbf24',
}

const STAGE_NAMES: Record<string, string> = {
  capsule: 'Capsule',
  polarisation: 'Polarisation',
  converter: 'Converter',
  output: 'Output',
  load: 'Cable & preamp',
}

const GRID_F = [20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000]
const GRID_DB = [-20, -15, -10, -5, 0, 5, 10, 15, 20]

const fmtF = (f: number) => (f >= 1000 ? `${f / 1000}k` : String(f))

export function ResponseGraph({ result, reference, activeStage, showStages }: Props) {
  const [probe, setProbe] = useState<number | null>(null)

  const x = (f: number) =>
    PAD.l + ((Math.log10(f) - Math.log10(F_LO)) / (Math.log10(F_HI) - Math.log10(F_LO))) * (W - PAD.l - PAD.r)
  const y = (db: number) => PAD.t + ((DB_RANGE - db) / (2 * DB_RANGE)) * (H - PAD.t - PAD.b)
  const fAt = (px: number) =>
    Math.pow(
      10,
      Math.log10(F_LO) + ((px - PAD.l) / (W - PAD.l - PAD.r)) * (Math.log10(F_HI) - Math.log10(F_LO)),
    )

  const path = useMemo(() => curve(result.freqs, result.mag, x, y), [result])

  const stagePaths = useMemo(() => {
    if (!showStages) return []
    return Object.entries(result.stages)
      .map(([stage, values]) => ({
        stage,
        d: curve(result.freqs, values, x, y),
        significant: Math.max(...Array.from(values, Math.abs)) > 0.15,
      }))
      .filter((s) => s.significant)
  }, [result, showStages])

  const refPath = useMemo(() => {
    if (!reference) return null
    const freqs = Float64Array.from(reference.freqs)
    const db = Float64Array.from(reference.db)
    return curve(freqs, db, x, y)
  }, [reference])

  const probeF = probe !== null ? Math.min(Math.max(fAt(probe), F_LO), F_HI) : null

  return (
    <div className="flex h-full flex-col">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full flex-1"
        onMouseMove={(e) => {
          const r = e.currentTarget.getBoundingClientRect()
          setProbe(((e.clientX - r.left) / r.width) * W)
        }}
        onMouseLeave={() => setProbe(null)}
      >
        {/* grid */}
        {GRID_F.map((f) => (
          <g key={f}>
            <line x1={x(f)} y1={PAD.t} x2={x(f)} y2={H - PAD.b} stroke="#27272a" strokeWidth={1} />
            <text x={x(f)} y={H - PAD.b + 15} fontSize={9} textAnchor="middle" fill="#71717a">
              {fmtF(f)}
            </text>
          </g>
        ))}
        {GRID_DB.map((db) => (
          <g key={db}>
            <line
              x1={PAD.l}
              y1={y(db)}
              x2={W - PAD.r}
              y2={y(db)}
              stroke={db === 0 ? '#3f3f46' : '#27272a'}
              strokeWidth={db === 0 ? 1.4 : 1}
            />
            <text x={PAD.l - 6} y={y(db) + 3} fontSize={9} textAnchor="end" fill="#71717a">
              {db > 0 ? `+${db}` : db}
            </text>
          </g>
        ))}

        {/* per-stage contributions */}
        {stagePaths.map((s) => (
          <path
            key={s.stage}
            d={s.d}
            fill="none"
            stroke={STAGE_COLOURS[s.stage]}
            strokeWidth={s.stage === activeStage ? 1.8 : 1}
            strokeDasharray="4 3"
            opacity={s.stage === activeStage ? 0.95 : 0.4}
          />
        ))}

        {refPath ? (
          <path d={refPath} fill="none" stroke="#a1a1aa" strokeWidth={1.4} strokeDasharray="2 4" opacity={0.8} />
        ) : null}

        <path d={path} fill="none" stroke="var(--color-copper-400)" strokeWidth={2.2} strokeLinejoin="round" />

        {probeF !== null ? (
          <g>
            <line x1={x(probeF)} y1={PAD.t} x2={x(probeF)} y2={H - PAD.b} stroke="#52525b" strokeWidth={1} />
            <circle cx={x(probeF)} cy={y(interpAt(result.freqs, result.mag, probeF))} r={3.5} fill="var(--color-copper-300)" />
          </g>
        ) : null}
      </svg>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-zinc-800 px-3 py-2 text-[11px]">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-0.5 w-4 bg-copper-400" />
          <span className="text-zinc-300">This build</span>
        </span>
        {stagePaths.map((s) => (
          <span key={s.stage} className="flex items-center gap-1.5">
            <span
              className="inline-block h-0.5 w-4"
              style={{ backgroundColor: STAGE_COLOURS[s.stage], opacity: s.stage === activeStage ? 1 : 0.5 }}
            />
            <span className={s.stage === activeStage ? 'text-zinc-300' : 'text-zinc-500'}>
              {STAGE_NAMES[s.stage]}
            </span>
          </span>
        ))}
        {reference ? (
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-0.5 w-4 bg-zinc-400" />
            <span className="text-zinc-400">{reference.name}</span>
          </span>
        ) : null}
        <span className="ml-auto tabular text-zinc-400">
          {probeF !== null
            ? `${fmtHz(probeF)} · ${interpAt(result.freqs, result.mag, probeF).toFixed(2)} dB`
            : `${(result.sensitivity * 1000).toFixed(1)} mV/Pa · ${result.sensitivityDbv.toFixed(1)} dBV/Pa`}
        </span>
      </div>
    </div>
  )
}

const fmtHz = (f: number) => (f >= 1000 ? `${(f / 1000).toFixed(f >= 10000 ? 1 : 2)} kHz` : `${f.toFixed(0)} Hz`)

function curve(
  freqs: Float64Array | number[],
  values: Float64Array | number[],
  x: (f: number) => number,
  y: (db: number) => number,
): string {
  let d = ''
  let started = false
  for (let i = 0; i < freqs.length; i++) {
    const f = freqs[i]
    if (f < F_LO * 0.98 || f > F_HI * 1.02) continue
    const px = x(f)
    const py = y(Math.max(Math.min(values[i], DB_RANGE + 5), -DB_RANGE - 5))
    d += `${started ? 'L' : 'M'} ${px.toFixed(2)} ${py.toFixed(2)} `
    started = true
  }
  return d
}
