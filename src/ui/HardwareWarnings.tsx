import { useStore } from '../store/store'

/**
 * Warnings that a real build would not survive.
 *
 * The response graph is happy to draw a beautiful curve for a circuit that
 * cannot be run from phantom power, distorts at conversational level, or asks a
 * capsule to hold a voltage that would arc across its gap. Those are the ways
 * this app could cost somebody a capsule, so they get a red bar rather than a
 * footnote.
 */
export function HardwareWarnings() {
  const result = useStore((s) => s.result)
  const setGraphTab = useStore((s) => s.setGraphTab)
  const warnings = result?.hardware.warnings ?? []
  if (warnings.length === 0) return null

  return (
    <div className="shrink-0 border-b border-amber-900/60 bg-amber-950/25 px-3 py-1.5">
      {warnings.map((w, i) => (
        <p key={i} className="flex items-start gap-2 text-[11px] leading-snug text-amber-200/90">
          <span aria-hidden className="shrink-0 pt-px">
            ⚠
          </span>
          <span>{w}</span>
        </p>
      ))}
      <button
        onClick={() => setGraphTab('op')}
        className="mt-0.5 pl-5 text-[10.5px] text-amber-300/70 underline-offset-2 hover:underline"
      >
        See the numbers on the operating-point tab
      </button>
    </div>
  )
}
