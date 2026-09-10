import type { AnalysisResult } from '../solver/analysis'
import { eng } from '../lib/format'

/**
 * Where the FET is biased. "Where is the FET sitting" is lesson 6, and it is
 * the number that explains every gain figure downstream.
 */

const REGION_TEXT: Record<string, string> = {
  sat: 'Saturation — the useful region. Drain current depends on the gate voltage and barely on the drain voltage, which is what makes it an amplifier.',
  triode:
    'Triode — the FET is behaving like a voltage-controlled resistor, not an amplifier. Gain has collapsed. Raise the supply or lower the drain resistor.',
  off: 'Pinched off — no drain current at all. V_gs is below the pinch-off voltage, usually because the source resistor is far too large for this device.',
}

const REGION_COLOUR: Record<string, string> = {
  sat: 'text-emerald-400',
  triode: 'text-amber-400',
  off: 'text-red-400',
}

export function OperatingPointView({ result }: { result: AnalysisResult }) {
  const nodes = Object.entries(result.op.nodes)
    .filter(([n]) => n !== 'gnd')
    .sort((a, b) => b[1] - a[1])

  return (
    <div className="flex h-full min-h-0 flex-col gap-4 overflow-y-auto p-3 text-sm">
      {result.op.warning ? (
        <div className="rounded border border-amber-700/50 bg-amber-950/30 p-3 text-xs text-amber-200">
          {result.op.warning}
        </div>
      ) : null}

      {result.op.fets.map((f) => (
        <div key={f.id} className="rounded border border-zinc-800 bg-zinc-900/50 p-3">
          <div className="mb-2 flex items-baseline justify-between">
            <span className="font-medium text-zinc-200">{f.label}</span>
            <span className={`text-xs uppercase tracking-wider ${REGION_COLOUR[f.region]}`}>{f.region}</span>
          </div>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-xs sm:grid-cols-3">
            <Stat label="V_gs" value={`${f.Vgs.toFixed(3)} V`} />
            <Stat label="V_ds" value={`${f.Vds.toFixed(2)} V`} />
            <Stat label="I_d" value={eng(f.Id, 'A')} />
            <Stat label="gm" value={eng(f.gm, 'S')} />
            <Stat label="r_ds" value={eng(1 / Math.max(f.gds, 1e-12), 'Ω')} />
            <Stat label="gm·R_d" value={`${f.gainDb.toFixed(1)} dB`} />
          </dl>
          <p className="mt-3 text-[11px] leading-relaxed text-zinc-500">{REGION_TEXT[f.region]}</p>
        </div>
      ))}

      <div className="rounded border border-zinc-800 bg-zinc-900/50 p-3">
        <div className="mb-2 text-xs uppercase tracking-wider text-zinc-500">DC node voltages</div>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs sm:grid-cols-3">
          {nodes.map(([name, v]) => (
            <Stat key={name} label={name} value={`${Math.abs(v) < 0.001 ? '0' : v.toFixed(3)} V`} />
          ))}
        </dl>
        <p className="mt-3 text-[11px] leading-relaxed text-zinc-500">
          The capsule is polarised at {result.op.vpol.toFixed(1)} V. That is the voltage the solver actually
          found across the diaphragm and backplate, not the number on the slider — so a leaky board, which
          forms a DC divider with the polarisation resistor, really does make the microphone quieter here.
        </p>
      </div>

      <HardwareSection result={result} />

      <div className="text-[11px] text-zinc-600">Solved in {result.solveMs.toFixed(0)} ms.</div>
    </div>
  )
}

/**
 * Everything that decides whether a real build works rather than how it sounds.
 *
 * The solver is linear, so the response graph will happily draw a perfect curve
 * for a circuit that clips at 95 dB SPL, cannot be run from phantom power, or
 * needs a 100 V capacitor where you fitted a 16 V one. These are the checks the
 * graph cannot make.
 */
function HardwareSection({ result }: { result: AnalysisResult }) {
  const { supply, headroom, stress } = result.hardware
  const caps = stress.filter((s) => s.kind === 'C')
  const totalWatts = stress.reduce((a, s) => a + s.watts, 0)

  return (
    <div className="rounded border border-zinc-800 bg-zinc-900/50 p-3">
      <div className="mb-2 flex items-baseline justify-between">
        <span className="text-xs uppercase tracking-wider text-zinc-500">Before you build it</span>
        <span className="text-[10px] text-zinc-600">estimates from the linear model</span>
      </div>

      <dl className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-xs sm:grid-cols-3">
        {supply ? (
          <>
            <Stat label="converter draws" value={`${(supply.current * 1000).toFixed(2)} mA`} />
            <Stat label="phantom rail sags to" value={`${supply.phantomRail.toFixed(1)} V`} />
            <Stat label="of the 10 mA budget" value={`${((supply.current / 10e-3) * 100).toFixed(0)} %`} />
          </>
        ) : null}
        {headroom ? (
          <>
            <Stat label="max SPL (est.)" value={`${headroom.maxSpl.toFixed(0)} dB`} />
            <Stat label="gate swing" value={`${(headroom.gateMargin * 1000).toFixed(0)} mV`} />
            <Stat label="output swing" value={`${headroom.outputMargin.toFixed(2)} V`} />
          </>
        ) : null}
        <Stat label="total dissipation" value={`${(totalWatts * 1000).toFixed(2)} mW`} />
      </dl>

      {supply ? (
        <p className="mt-3 text-[11px] leading-relaxed text-zinc-500">
          That current is the impedance converter alone. A real board’s polarisation multiplier and output
          stage draw their own, typically another one to three milliamps, and neither is modelled here — so
          the figure is a floor, not a total. Phantom power is specified as 48 V through 6.81 kΩ in each
          leg, and a microphone is allowed to draw 10 mA.
        </p>
      ) : null}

      {headroom ? (
        <p className="mt-3 text-[11px] leading-relaxed text-zinc-500">
          First thing to run out of room is <span className="text-zinc-300">{headroom.limitedBy}</span>.{' '}
          {headroom.explanation} This is worked out from the small-signal operating point, not from a
          transient simulation — the solver is linear and cannot actually clip — so treat it as an order of
          magnitude rather than a specification.
        </p>
      ) : null}

      {caps.length > 0 ? (
        <>
          <div className="mb-1 mt-3 text-[11px] uppercase tracking-wider text-zinc-500">
            DC across each capacitor — what to buy
          </div>
          <ul className="space-y-0.5 text-[11px]">
            {caps.map((c) => (
              <li key={c.id} className="flex items-baseline gap-2 border-b border-zinc-800/60 pb-0.5">
                <span className="w-28 shrink-0 text-zinc-400">{c.label}</span>
                <span className="w-20 shrink-0 text-right tabular text-zinc-200">
                  {c.volts.toFixed(2)} V
                </span>
                <span className="text-zinc-500">
                  fit at least a {c.ratingHint} V part
                  {c.polarised
                    ? ' — big enough to be an electrolytic, and it has a DC polarity, so orient it correctly or use a bipolar one'
                    : ''}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[11px] leading-relaxed text-zinc-500">
            Small film and ceramic parts are rated at 1.5× the DC stress here, electrolytics at 2×, which
            is ordinary derating practice. Note what sits at the full polarisation voltage: the capsule’s
            coupling capacitor, or the backplate bypass capacitor on a backplate-polarised board. Sixty
            volts on a part means buying a 100 V one — that is where people fit a 50 V capacitor by mistake
            and then wonder why the microphone crackles and dies.
          </p>
        </>
      ) : null}
    </div>
  )
}

const Stat = ({ label, value }: { label: string; value: string }) => (
  <div className="flex items-baseline justify-between gap-2 border-b border-zinc-800/60 pb-1">
    <dt className="text-zinc-500">{label}</dt>
    <dd className="tabular text-zinc-200">{value}</dd>
  </div>
)
