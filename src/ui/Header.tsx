import { useState } from 'react'
import { useStore } from '../store/store'
import { PRESETS } from '../data/presets'
import { LESSONS } from '../lessons/lessons'
import { decodeBuild } from '../lib/url'
import { defaultBuild } from '../stages/build'

export function Header() {
  const mode = useStore((s) => s.mode)
  const lesson = useStore((s) => s.lesson)
  const progress = useStore((s) => s.progress)
  const startLesson = useStore((s) => s.startLesson)
  const exitLesson = useStore((s) => s.exitLesson)
  const presetId = useStore((s) => s.presetId)
  const loadPreset = useStore((s) => s.loadPreset)
  const loadBuild = useStore((s) => s.loadBuild)
  const saved = useStore((s) => s.saved)
  const saveBuild = useStore((s) => s.saveBuild)
  const deleteSaved = useStore((s) => s.deleteSaved)
  const solving = useStore((s) => s.solving)

  const [menu, setMenu] = useState<'lessons' | 'saved' | null>(null)
  const preset = PRESETS.find((p) => p.id === presetId)
  const done = Object.values(progress).filter(Boolean).length

  return (
    <header className="relative z-20 flex shrink-0 items-center gap-3 border-b border-zinc-800 bg-zinc-950 px-3 py-2">
      <span className="flex items-baseline gap-1.5">
        <span className="text-sm font-semibold tracking-tight text-zinc-100">Mic Lab</span>
        <span className="hidden text-[10.5px] text-zinc-600 sm:inline">virtual condenser mic builder</span>
      </span>

      <ModelNotice />

      <div className="relative">
        <button
          onClick={() => setMenu(menu === 'lessons' ? null : 'lessons')}
          className={`rounded px-2 py-1 text-xs transition-colors ${
            mode === 'lesson' ? 'bg-copper-600/20 text-copper-200' : 'text-zinc-300 hover:bg-zinc-800'
          }`}
        >
          Lessons {done > 0 ? <span className="text-zinc-500">{done}/13</span> : null} ▾
        </button>
        {menu === 'lessons' ? (
          <div className="absolute left-0 top-full mt-1 max-h-[70vh] w-80 overflow-y-auto rounded border border-zinc-700 bg-zinc-900 p-1 shadow-xl">
            {LESSONS.map((l) => (
              <button
                key={l.n}
                onClick={() => {
                  startLesson(l.n)
                  setMenu(null)
                }}
                className={`block w-full rounded px-2 py-1.5 text-left text-xs hover:bg-zinc-800 ${
                  lesson === l.n ? 'bg-copper-600/15 text-copper-200' : 'text-zinc-300'
                }`}
              >
                <span className="flex items-baseline gap-1.5">
                  <span className="w-4 shrink-0 tabular text-zinc-600">{l.n}</span>
                  <span className="flex-1">{l.title}</span>
                  {progress[l.n] ? <span className="text-emerald-500">✓</span> : null}
                </span>
                <span className="ml-[22px] block text-[10.5px] text-zinc-500">{l.blurb}</span>
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <button
        onClick={exitLesson}
        className={`rounded px-2 py-1 text-xs transition-colors ${
          mode === 'free' ? 'bg-zinc-800 text-zinc-100' : 'text-zinc-400 hover:bg-zinc-800'
        }`}
      >
        Free build
      </button>

      <label className="flex items-center gap-1.5 text-xs">
        <span className="hidden text-zinc-500 sm:inline">Preset</span>
        <select
          value={presetId ?? ''}
          onChange={(e) => (e.target.value ? loadPreset(e.target.value) : undefined)}
          className="rounded border border-zinc-700 bg-zinc-900 px-1.5 py-1 text-zinc-200"
        >
          <option value="">Modified build</option>
          {PRESETS.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
              {p.verified ? '' : ' *'}
            </option>
          ))}
        </select>
      </label>

      {preset && !preset.verified ? (
        <span
          className="hidden text-[10.5px] text-amber-500/80 lg:inline"
          title="Values are textbook defaults standing in for measurements from the real board."
        >
          * unverified values
        </span>
      ) : null}

      <div className="relative ml-auto flex items-center gap-2">
        {solving ? <span className="text-[10.5px] text-copper-500/70">solving…</span> : null}
        <button
          onClick={() => {
            navigator.clipboard?.writeText(window.location.href)
          }}
          className="rounded px-2 py-1 text-xs text-zinc-400 hover:bg-zinc-800"
          title="This build is encoded in the URL — copy it to share or bookmark it."
        >
          Copy link
        </button>
        <button
          onClick={() => setMenu(menu === 'saved' ? null : 'saved')}
          className="rounded px-2 py-1 text-xs text-zinc-300 hover:bg-zinc-800"
        >
          Saved ▾
        </button>
        {menu === 'saved' ? (
          <div className="absolute right-0 top-full mt-1 w-72 rounded border border-zinc-700 bg-zinc-900 p-2 shadow-xl">
            <SaveRow
              onSave={(name) => {
                saveBuild(name)
                setMenu(null)
              }}
            />
            <div className="mt-2 max-h-64 overflow-y-auto">
              {saved.length === 0 ? (
                <p className="px-1 py-2 text-[11px] text-zinc-500">Nothing saved yet.</p>
              ) : null}
              {saved.map((s) => (
                <div key={s.name} className="flex items-center gap-1">
                  <button
                    onClick={() => {
                      loadBuild(decodeBuild(s.query, defaultBuild()))
                      setMenu(null)
                    }}
                    className="flex-1 truncate rounded px-2 py-1 text-left text-xs text-zinc-300 hover:bg-zinc-800"
                  >
                    {s.name}
                  </button>
                  <button
                    onClick={() => deleteSaved(s.name)}
                    className="px-1.5 text-xs text-zinc-600 hover:text-red-400"
                    aria-label={`Delete ${s.name}`}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
            <ExportImport />
          </div>
        ) : null}
      </div>

      {menu ? <div className="fixed inset-0 -z-10" onClick={() => setMenu(null)} /> : null}
    </header>
  )
}

/**
 * A model is not a design tool, and the difference matters as soon as someone
 * reaches for a soldering iron. Shown until it is dismissed, then available
 * from the header for good.
 */
function ModelNotice() {
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
      <button
        onClick={() => setOpen(true)}
        className={`rounded px-2 py-1 text-xs transition-colors ${
          seen ? 'text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300' : 'bg-amber-600/20 text-amber-200'
        }`}
        title="What this model can and cannot tell you"
      >
        {seen ? 'Model limits' : 'Read me before building'}
      </button>

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

function SaveRow({ onSave }: { onSave: (name: string) => void }) {
  const [name, setName] = useState('')
  return (
    <div className="flex gap-1">
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && name.trim()) onSave(name.trim())
        }}
        placeholder="Name this build"
        className="min-w-0 flex-1 rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-xs text-zinc-200 outline-none focus:border-copper-600"
      />
      <button
        onClick={() => name.trim() && onSave(name.trim())}
        className="rounded bg-copper-600 px-2 py-1 text-xs text-zinc-950 hover:bg-copper-500"
      >
        Save
      </button>
    </div>
  )
}

function ExportImport() {
  const build = useStore((s) => s.build)
  const loadBuild = useStore((s) => s.loadBuild)
  return (
    <div className="mt-2 flex gap-1 border-t border-zinc-800 pt-2">
      <button
        onClick={() => {
          const blob = new Blob([JSON.stringify(build, null, 2)], { type: 'application/json' })
          const a = document.createElement('a')
          a.href = URL.createObjectURL(blob)
          a.download = 'miclab-build.json'
          a.click()
          URL.revokeObjectURL(a.href)
        }}
        className="flex-1 rounded border border-zinc-700 px-2 py-1 text-[11px] text-zinc-300 hover:border-zinc-600"
      >
        Export JSON
      </button>
      <label className="flex-1 cursor-pointer rounded border border-zinc-700 px-2 py-1 text-center text-[11px] text-zinc-300 hover:border-zinc-600">
        Import
        <input
          type="file"
          accept="application/json"
          className="hidden"
          onChange={async (e) => {
            const f = e.target.files?.[0]
            if (!f) return
            try {
              loadBuild(JSON.parse(await f.text()))
            } catch {
              /* a bad file is not worth a dialog; the build simply stays put */
            }
          }}
        />
      </label>
    </div>
  )
}
