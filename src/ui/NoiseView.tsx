import type { AnalysisResult } from '../solver/analysis'
import { P_REF } from '../solver/noise'

/**
 * The noise view: where the hiss comes from, as a breakdown and as a curve.
 *
 * The breakdown is the interesting half. In a healthy large-diaphragm build the
 * capsule's own acoustic noise wins, which surprises almost everybody.
 */

const COLOURS: Record<string, string> = {
  capsule: 'var(--cat-capsule)',
  R_pol: 'var(--cat-polarisation)',
  R_gate: 'var(--cat-gate)',
  resistors: 'var(--cat-resistors)',
  'fet-channel': 'var(--cat-converter)',
  'fet-flicker': 'var(--cat-flicker)',
  'gate-leakage': 'var(--cat-leakage)',
  output: 'var(--cat-output)',
}

const W = 760
const H = 200
const PAD = { l: 44, r: 14, t: 14, b: 26 }
const F_LO = 20
const F_HI = 20000

export function NoiseView({ result }: { result: AnalysisResult }) {
  const x = (f: number) =>
    PAD.l + ((Math.log10(f) - Math.log10(F_LO)) / (Math.log10(F_HI) - Math.log10(F_LO))) * (W - PAD.l - PAD.r)

  // Equivalent input noise, as a spectral SPL density.
  const spl = Array.from(result.einPsd, (p) => 10 * Math.log10(Math.max(p, 1e-30) / (P_REF * P_REF)))
  const lo = -20
  const hi = 40
  const y = (v: number) => PAD.t + ((hi - v) / (hi - lo)) * (H - PAD.t - PAD.b)

  let d = ''
  for (let i = 0; i < result.freqs.length; i++) {
    const f = result.freqs[i]
    if (f < F_LO || f > F_HI) continue
    d += `${d ? 'L' : 'M'} ${x(f).toFixed(2)} ${y(Math.max(Math.min(spl[i], hi), lo)).toFixed(2)} `
  }

  const total = result.noiseBreakdown.reduce((a, b) => a + b.share, 0) || 1

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 overflow-y-auto p-3">
      <div className="flex items-baseline gap-4">
        <div>
          <div className="text-3xl font-light tabular text-copper-300">
            {result.selfNoiseDbA.toFixed(1)}
            <span className="ml-1 text-base text-zinc-500">dB-A</span>
          </div>
          <div className="text-[11px] text-zinc-500">self-noise, A-weighted</div>
        </div>
        <div>
          <div className="text-xl font-light tabular text-zinc-300">
            {isFinite(result.electronicsDbA) ? result.electronicsDbA.toFixed(1) : '—'}
            <span className="ml-1 text-xs text-zinc-500">dB-A</span>
          </div>
          <div className="text-[11px] text-zinc-500">electronics alone</div>
        </div>
        <div>
          <div className="text-xl font-light tabular text-zinc-300">
            {(94 - result.selfNoiseDbA).toFixed(0)}
            <span className="ml-1 text-xs text-zinc-500">dB</span>
          </div>
          <div className="text-[11px] text-zinc-500">signal-to-noise at 94 dB SPL</div>
        </div>
      </div>

      {/* breakdown bar */}
      <div>
        <div className="flex h-4 w-full overflow-hidden rounded-sm">
          {result.noiseBreakdown.map((b) => (
            <div
              key={b.kind}
              title={`${b.label}: ${b.dBA.toFixed(1)} dB-A`}
              style={{ width: `${(b.share / total) * 100}%`, backgroundColor: COLOURS[b.kind] ?? 'var(--color-zinc-500)' }}
            />
          ))}
        </div>
        <ul className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-[11px]">
          {result.noiseBreakdown
            .filter((b) => b.share > 0.001)
            .map((b) => (
              <li key={b.kind} className="flex items-center gap-2">
                <span
                  className="inline-block h-2 w-2 shrink-0 rounded-full"
                  style={{ backgroundColor: COLOURS[b.kind] ?? 'var(--color-zinc-500)' }}
                />
                <span className="truncate text-zinc-400">{b.label}</span>
                <span className="ml-auto shrink-0 tabular text-zinc-500">
                  {b.dBA.toFixed(1)} dB-A · {(b.share * 100).toFixed(0)}%
                </span>
              </li>
            ))}
        </ul>
      </div>

      <div>
        <div className="mb-1 text-[11px] uppercase tracking-wider text-zinc-500">
          Equivalent input noise — the hiss expressed as the sound that would cause it
        </div>
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
          {[20, 100, 1000, 10000, 20000].map((f) => (
            <g key={f}>
              <line x1={x(f)} y1={PAD.t} x2={x(f)} y2={H - PAD.b} stroke="var(--graph-grid)" />
              <text x={x(f)} y={H - PAD.b + 14} fontSize={9} textAnchor="middle" fill="var(--graph-axis)">
                {f >= 1000 ? `${f / 1000}k` : f}
              </text>
            </g>
          ))}
          {[-20, 0, 20, 40].map((v) => (
            <g key={v}>
              <line x1={PAD.l} y1={y(v)} x2={W - PAD.r} y2={y(v)} stroke="var(--graph-grid)" />
              <text x={PAD.l - 6} y={y(v) + 3} fontSize={9} textAnchor="end" fill="var(--graph-axis)">
                {v}
              </text>
            </g>
          ))}
          <path d={d} fill="none" stroke="var(--color-copper-400)" strokeWidth={2} />
          <text x={PAD.l} y={H - 4} fontSize={9} fill="var(--graph-axis)">
            dB SPL per √Hz
          </text>
        </svg>
      </div>

      {result.hum.length > 0 ? (
        <div>
          <div className="mb-1 text-[11px] uppercase tracking-wider text-zinc-500">
            Hum and interference lines
          </div>
          <ul className="space-y-1 text-[11px]">
            {result.hum.map((l) => (
              <li key={l.freq} className="flex items-center gap-2">
                <span className="w-16 shrink-0 tabular text-zinc-400">{l.freq.toFixed(0)} Hz</span>
                <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-zinc-800">
                  <span
                    className="block h-full bg-red-400/70"
                    style={{ width: `${Math.min(100, Math.max(0, (l.spl + 20) * 1.4))}%` }}
                  />
                </span>
                <span className="w-28 shrink-0 text-right tabular text-zinc-500">
                  {l.spl.toFixed(0)} dB SPL equiv.
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[11px] text-zinc-500">
            Compare these with the self-noise above: anything below it is inaudible, and anything above it is
            the loudest thing your microphone does when nobody is playing.
          </p>
        </div>
      ) : null}
    </div>
  )
}
