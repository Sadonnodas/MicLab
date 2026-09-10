import { useStore } from '../store/store'
import { FAULTS } from '../stages/faults'
import { ParamControl } from './ParamControl'

/**
 * The fault panel.
 *
 * Every switch here adds real elements to the netlist — a capacitor to a mains
 * source, a current into the cable screen — so the hum comes out of the same
 * solve as the music and reacts to everything else you change.
 */
export function FaultPanel() {
  const build = useStore((s) => s.build)
  const toggleFault = useStore((s) => s.toggleFault)
  const setFaultParam = useStore((s) => s.setFaultParam)
  const active = new Map(build.faults.map((f) => [f.id, f]))

  return (
    <div className="border-t border-zinc-800">
      <div className="px-3 py-2 text-[10.5px] uppercase tracking-wider text-zinc-500">
        Real-world faults
      </div>
      <div className="space-y-1 px-1 pb-3">
        {FAULTS.map((f) => {
          const on = active.has(f.id)
          return (
            <div
              key={f.id}
              className={`rounded border px-2 py-1.5 transition-colors ${
                on ? 'border-red-800/60 bg-red-950/20' : 'border-transparent hover:border-zinc-800'
              }`}
            >
              <label className="flex cursor-pointer items-start gap-2">
                <input
                  type="checkbox"
                  checked={on}
                  onChange={() => toggleFault(f.id)}
                  className="mt-0.5 accent-red-500"
                />
                <span className="min-w-0">
                  <span className={`block text-[11px] font-medium ${on ? 'text-red-200' : 'text-zinc-300'}`}>
                    {f.name}
                  </span>
                  <span className="block text-[10.5px] leading-snug text-zinc-500">{f.symptom}</span>
                </span>
              </label>
              {on ? (
                <>
                  <p className="mb-1 mt-2 pl-6 text-[10.5px] leading-relaxed text-zinc-400">{f.explanation}</p>
                  <div className="pl-4">
                    {f.params.map((p) => (
                      <ParamControl
                        key={p.key}
                        def={p}
                        value={active.get(f.id)?.values[p.key] ?? p.default}
                        onChange={(v) => setFaultParam(f.id, p.key, Number(v))}
                      />
                    ))}
                  </div>
                </>
              ) : null}
            </div>
          )
        })}
      </div>
    </div>
  )
}
