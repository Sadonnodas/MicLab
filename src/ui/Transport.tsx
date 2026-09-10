import { useEffect, useRef, useState } from 'react'
import { useStore } from '../store/store'
import { MicEngine, type SplChoice } from '../audio/engine'
import { DEMOS } from '../audio/demo'
import { REFERENCES } from '../data/references'

/**
 * The transport bar: what you are listening to, how loud it is meant to be, and
 * how much preamp gain you are giving it.
 *
 * The level meter matters more than it looks. Levels here are absolute — a 7:1
 * transformer really is 17 dB quieter than a transformerless output — so when a
 * build gets quiet, the meter is what tells you it is the microphone and not
 * your ears.
 */
export function Transport({ engine }: { engine: MicEngine | null }) {
  const result = useStore((s) => s.result)
  const build = useStore((s) => s.build)
  const compareRef = useStore((s) => s.compareRef)
  const setCompareRef = useStore((s) => s.setCompareRef)

  const [playing, setPlaying] = useState(false)
  const [clip, setClip] = useState(DEMOS[1].id)
  const [spl, setSpl] = useState<SplChoice>(94)
  const [trim, setTrim] = useState(30)
  const [noise, setNoise] = useState(true)
  const [hum, setHum] = useState(true)
  const [levelMatch, setLevelMatch] = useState(true)
  const [meter, setMeter] = useState(-60)
  const fileRef = useRef<HTMLInputElement>(null)

  // Feed every fresh solve into the audio engine.
  useEffect(() => {
    if (!engine || !result) return
    engine.update(
      result,
      build.faults.map((f) => f.id),
    )
  }, [engine, result, build.faults])

  useEffect(() => {
    if (!engine) return
    const id = window.setInterval(() => setMeter(engine.meter()), 80)
    return () => window.clearInterval(id)
  }, [engine])

  useEffect(() => {
    if (!engine) return
    engine.setReference(compareRef ? (REFERENCES.find((r) => r.id === compareRef) ?? null) : null)
  }, [engine, compareRef])

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

  const meterPct = Math.max(0, Math.min(100, ((meter + 60) / 60) * 100))
  const clipping = meter > -0.5

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-zinc-800 bg-zinc-950 px-3 py-2 text-xs">
      <button
        onClick={toggle}
        className="flex h-8 w-8 items-center justify-center rounded-full bg-copper-600 text-zinc-950 transition-colors hover:bg-copper-500"
        aria-label={playing ? 'Stop' : 'Play'}
      >
        {playing ? '■' : '▶'}
      </button>

      <label className="flex items-center gap-1.5">
        <span className="text-zinc-500">Source</span>
        <select
          value={clip}
          onChange={(e) => {
            setClip(e.target.value)
            const demo = DEMOS.find((d) => d.id === e.target.value)
            if (demo && engine) engine.loadDemo(demo)
          }}
          className="rounded border border-zinc-700 bg-zinc-900 px-1.5 py-1 text-zinc-200"
        >
          {DEMOS.map((d) => (
            <option key={d.id} value={d.id} title={d.description}>
              {d.name}
            </option>
          ))}
        </select>
      </label>

      <button
        onClick={() => fileRef.current?.click()}
        className="rounded border border-zinc-700 px-2 py-1 text-zinc-300 hover:border-zinc-600"
      >
        Upload…
      </button>
      <input
        ref={fileRef}
        type="file"
        accept="audio/*"
        className="hidden"
        onChange={async (e) => {
          const f = e.target.files?.[0]
          if (f && engine) {
            await engine.resume()
            await engine.loadFile(f)
            engine.play()
            setPlaying(true)
          }
        }}
      />

      <label className="flex items-center gap-1.5" title="What sound pressure level the file represents. 94 dB SPL is one pascal.">
        <span className="text-zinc-500">SPL</span>
        <select
          value={spl}
          onChange={(e) => {
            const v = Number(e.target.value) as SplChoice
            setSpl(v)
            engine?.setSpl(v)
          }}
          className="rounded border border-zinc-700 bg-zinc-900 px-1.5 py-1 text-zinc-200"
        >
          <option value={74}>74 dB (quiet)</option>
          <option value={94}>94 dB (1 Pa)</option>
          <option value={114}>114 dB (loud)</option>
        </select>
      </label>

      <label className="flex items-center gap-1.5" title="Preamp gain. Levels here are absolute, so quiet builds really do need more of it.">
        <span className="text-zinc-500">Preamp</span>
        <input
          type="range"
          min={0}
          max={60}
          step={1}
          value={trim}
          onChange={(e) => {
            const v = Number(e.target.value)
            setTrim(v)
            engine?.setTrim(v)
          }}
          className="w-24"
        />
        <span className="w-12 tabular text-zinc-300">+{trim} dB</span>
      </label>

      <label className="flex cursor-pointer items-center gap-1.5" title="The microphone's own hiss, at the level the solver computed.">
        <input
          type="checkbox"
          checked={noise}
          onChange={(e) => {
            setNoise(e.target.checked)
            engine?.setNoise(e.target.checked)
          }}
          className="accent-copper-500"
        />
        <span className="text-zinc-400">Noise</span>
      </label>

      <label className="flex cursor-pointer items-center gap-1.5" title="Hum and interference from any active faults.">
        <input
          type="checkbox"
          checked={hum}
          onChange={(e) => {
            setHum(e.target.checked)
            engine?.setHum(e.target.checked)
          }}
          className="accent-copper-500"
        />
        <span className="text-zinc-400">Hum</span>
      </label>

      <label className="flex items-center gap-1.5" title="Compare against a reference microphone's published curve.">
        <span className="text-zinc-500">A/B</span>
        <select
          value={compareRef ?? ''}
          onChange={(e) => setCompareRef(e.target.value || null)}
          className="rounded border border-zinc-700 bg-zinc-900 px-1.5 py-1 text-zinc-200"
        >
          <option value="">This build</option>
          {REFERENCES.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>
      </label>

      {compareRef ? (
        <label className="flex cursor-pointer items-center gap-1.5" title="Match the reference to this build's 1 kHz level, so you compare tone and not loudness.">
          <input
            type="checkbox"
            checked={levelMatch}
            onChange={(e) => {
              setLevelMatch(e.target.checked)
              engine?.setLevelMatch(e.target.checked)
            }}
            className="accent-copper-500"
          />
          <span className="text-zinc-400">Level-match</span>
        </label>
      ) : null}

      <div className="ml-auto flex items-center gap-2">
        <div className="h-2 w-28 overflow-hidden rounded-full bg-zinc-800">
          <div
            className={`h-full transition-[width] duration-75 ${clipping ? 'bg-red-500' : 'bg-copper-400'}`}
            style={{ width: `${meterPct}%` }}
          />
        </div>
        <span className={`w-16 tabular ${clipping ? 'text-red-400' : 'text-zinc-500'}`}>
          {meter > -59 ? `${meter.toFixed(0)} dBFS` : '—'}
        </span>
      </div>
    </div>
  )
}
