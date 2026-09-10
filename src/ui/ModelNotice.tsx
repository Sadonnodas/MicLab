import { useState } from 'react'

/**
 * A model is not a design tool, and the difference matters as soon as someone
 * reaches for a soldering iron. Shown until it is dismissed, then available
 * from the header for good.
 */
export function ModelNotice({ compact }: { compact?: boolean }) {
  const [open, setOpen] = useState(false)
  const [seen, setSeen] = useState(() => {
    try {
      return localStorage.getItem('miclab.noticeSeen') === '1'
    } catch {
      return false
    }
  })

  const dismiss = () => {
    try {
      localStorage.setItem('miclab.noticeSeen', '1')
    } catch {
      /* private browsing — it will just show again */
    }
    setSeen(true)
    setOpen(false)
  }

  return (
    <>
      {compact ? (
        <button
          onClick={() => setOpen(true)}
          className={`rounded px-2 py-1 text-xs transition-colors ${
            seen ? 'text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300' : 'bg-amber-600/20 text-amber-200'
          }`}
          title="What this model can and cannot tell you"
        >
          {seen ? 'Model limits' : 'Read me before building'}
        </button>
      ) : null}

      {open || !seen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="max-h-[80vh] w-[560px] overflow-y-auto rounded-lg border border-zinc-700 bg-zinc-900 p-5 shadow-2xl">
            <h2 className="mb-3 text-base font-semibold text-zinc-100">
              This is a teaching model, not a design tool
            </h2>
            <div className="space-y-2.5 text-[12.5px] leading-relaxed text-zinc-300">
              <p>
                The circuit solver is real — modified nodal analysis, checked against ngspice to within
                0.02 dB — but it is <em>linear, small-signal and steady-state</em>, and a real microphone is
                none of those things.
              </p>
              <p>
                It cannot tell you whether a circuit will clip, oscillate, start up, survive its own supply,
                or fit the component ratings you bought. It has no model of phantom power, of the
                polarisation multiplier, of temperature, of layout, or of any nonlinearity at all. It will
                draw a beautiful frequency response for a circuit that distorts at conversational level.
              </p>
              <p>
                What it is good at is <em>why</em>: why the polarisation resistor is a gigaohm, why a bigger
                resistor is quieter, why two boards make one capsule sound different, why a balanced output
                rejects a ground loop. Use it to understand a topology, then verify a real design against
                datasheets, a full SPICE run, and a breadboard.
              </p>
              <p className="text-amber-200/90">
                One hardware warning worth carrying away now: the capsule coupling capacitor sits at the full
                polarisation voltage, 60 V. Fit a 100 V part there, not a 50 V one. The operating-point tab
                lists the DC stress on every capacitor.
              </p>
              <p className="text-zinc-400">
                <code className="text-zinc-300">docs/SAFETY.md</code> has the full list of what is and is not
                modelled, and the real hazards of building a condenser microphone — including the one that
                genuinely is dangerous, which is valve microphones, and which this app does not cover.
              </p>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={dismiss}
                className="rounded bg-copper-600 px-3 py-1.5 text-xs text-zinc-950 hover:bg-copper-500"
              >
                Understood
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}
