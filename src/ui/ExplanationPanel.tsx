import { useState } from 'react'
import { useStore } from '../store/store'

/**
 * The explanation panel — the teaching half of the app.
 *
 * It never says anything the solver has not measured: the headline is what you
 * changed, the items are the derived quantities that moved most, and the last
 * line is the difference the solve actually produced.
 */
export function ExplanationPanel() {
  const explanation = useStore((s) => s.explanation)
  const solving = useStore((s) => s.solving)
  const error = useStore((s) => s.error)
  const [open, setOpen] = useState<string | null>(null)

  if (error) {
    return (
      <div className="h-full overflow-y-auto p-3">
        <div className="rounded border border-red-800/60 bg-red-950/30 p-3 text-xs text-red-200">
          <div className="mb-1 font-medium">The solver could not finish.</div>
          <div className="text-red-300/80">{error}</div>
        </div>
      </div>
    )
  }

  if (!explanation) {
    return (
      <div className="flex h-full items-center justify-center text-xs text-zinc-600">
        {solving ? 'Solving…' : 'Change something to see what happened.'}
      </div>
    )
  }

  return (
    <div className="h-full overflow-y-auto p-3">
      <p className="text-[13px] leading-relaxed text-zinc-200">{explanation.headline}</p>

      <div className="mt-3 space-y-2.5">
        {explanation.items.map((item) => (
          <div key={item.key} className="border-l-2 border-copper-700/60 pl-3">
            <p className="text-[12.5px] leading-relaxed text-zinc-300">{item.text}</p>
            <button
              onClick={() => setOpen(open === item.key ? null : item.key)}
              className="mt-1 text-[11px] text-copper-400 hover:text-copper-300"
            >
              {open === item.key ? 'Hide' : 'Why?'}
            </button>
            {open === item.key ? (
              <p className="mt-1.5 whitespace-pre-line text-[11.5px] leading-relaxed text-zinc-400">
                {item.why}
              </p>
            ) : null}
          </div>
        ))}
      </div>

      <p className="mt-3 border-t border-zinc-800 pt-2 text-[11.5px] tabular text-zinc-400">
        {explanation.summary}
      </p>
    </div>
  )
}
