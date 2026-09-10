import { useEffect, useRef, useState } from 'react'
import type { ParamDef } from '../stages/types'
import { eng, parseEng } from '../lib/format'

/**
 * One component control.
 *
 * Log scale for resistors, capacitors and inductors, because that is how they
 * are chosen. Next to the value sits the *derived* quantity the lesson actually
 * cares about — "corner 2.9 Hz" beside a gigaohm — which is the whole reason
 * the explanation engine exists.
 */

interface Props {
  def: ParamDef
  value: number | string
  derived?: { label: string; text: string }
  locked?: boolean
  lockReason?: string
  onChange: (v: number | string) => void
  onHover?: (id: string | null) => void
  highlighted?: boolean
}

export function ParamControl({ def, value, derived, locked, lockReason, onChange, highlighted }: Props) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editing) inputRef.current?.select()
  }, [editing])

  if (def.kind === 'enum') {
    return (
      <Row def={def} locked={locked} lockReason={lockReason} highlighted={highlighted} derived={derived}>
        <select
          disabled={locked}
          value={String(value)}
          onChange={(e) => onChange(e.target.value)}
          className="w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs text-zinc-200 disabled:opacity-40"
        >
          {def.enumOptions?.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </Row>
    )
  }

  const numeric = typeof value === 'number' ? value : def.default
  const log = def.scale === 'log'
  const toSlider = (v: number) =>
    log
      ? ((Math.log(Math.max(v, def.min || 1e-15)) - Math.log(def.min || 1e-15)) /
          (Math.log(def.max) - Math.log(def.min || 1e-15))) *
        1000
      : ((v - def.min) / (def.max - def.min)) * 1000
  const fromSlider = (s: number) =>
    log
      ? Math.exp(Math.log(def.min || 1e-15) + (s / 1000) * (Math.log(def.max) - Math.log(def.min || 1e-15)))
      : def.min + (s / 1000) * (def.max - def.min)

  const display = def.choices
    ? (def.choices.find((c) => Math.abs(c.value - numeric) < 1e-9)?.label ?? formatValue(def, numeric))
    : formatValue(def, numeric)

  const commit = () => {
    const parsed = parseEng(draft)
    setEditing(false)
    if (parsed === null) return
    onChange(Math.min(Math.max(parsed, def.min), def.max))
  }

  return (
    <Row def={def} locked={locked} lockReason={lockReason} highlighted={highlighted} derived={derived}>
      {def.choices ? (
        <div className="flex gap-1">
          {def.choices.map((c) => (
            <button
              key={c.value}
              disabled={locked}
              onClick={() => onChange(c.value)}
              className={`flex-1 rounded border px-1.5 py-1 text-[11px] transition-colors disabled:opacity-40 ${
                Math.abs(c.value - numeric) < 1e-9
                  ? 'border-copper-500 bg-copper-600/20 text-copper-200'
                  : 'border-zinc-700 text-zinc-400 hover:border-zinc-600 hover:text-zinc-200'
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>
      ) : (
        <input
          type="range"
          disabled={locked}
          min={0}
          max={1000}
          step={1}
          value={toSlider(numeric)}
          onChange={(e) => onChange(round(fromSlider(Number(e.target.value)), def))}
          aria-label={def.label}
        />
      )}

      <div className="mt-0.5 flex items-baseline justify-between gap-2">
        {editing ? (
          <input
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commit()
              if (e.key === 'Escape') setEditing(false)
            }}
            className="w-24 rounded border border-copper-600 bg-zinc-900 px-1 py-0.5 text-xs tabular text-zinc-100 outline-none"
          />
        ) : (
          <button
            disabled={locked}
            onClick={() => {
              setDraft(String(Number(numeric.toPrecision(6))))
              setEditing(true)
            }}
            className="tabular text-xs text-zinc-200 hover:text-copper-300 disabled:hover:text-zinc-200"
            title="Click to type a value"
          >
            {display}
          </button>
        )}
        {derived ? (
          <span className="truncate text-right text-[11px] text-copper-300/80" title={derived.label}>
            {derived.text}
          </span>
        ) : null}
      </div>
    </Row>
  )
}

function Row({
  def,
  locked,
  lockReason,
  highlighted,
  children,
}: {
  def: ParamDef
  locked?: boolean
  lockReason?: string
  highlighted?: boolean
  derived?: unknown
  children: React.ReactNode
}) {
  return (
    <div
      className={`group rounded px-2 py-1.5 transition-colors ${
        highlighted ? 'bg-copper-600/10 ring-1 ring-copper-600/40' : ''
      } ${locked ? 'opacity-45' : ''}`}
      title={locked ? lockReason : def.help}
    >
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[11px] font-medium text-zinc-300">{def.label}</span>
        {locked ? <span className="text-[10px] text-zinc-500">🔒</span> : null}
      </div>
      {children}
      <p className="mt-1 hidden text-[10.5px] leading-snug text-zinc-500 group-hover:block">
        {locked ? lockReason : def.help}
      </p>
    </div>
  )
}

function formatValue(def: ParamDef, v: number): string {
  if (def.unit === 'Ω' || def.unit === 'F' || def.unit === 'H' || def.unit === 'A' || def.unit === 'S') {
    return eng(v, def.unit)
  }
  if (def.unit === 'Hz') return eng(v, 'Hz')
  if (def.unit === 'V/Pa') return `${(v * 1000).toFixed(1)} mV/Pa`
  if (def.unit === '') return String(Number(v.toPrecision(3)))
  return `${Number(v.toPrecision(4))} ${def.unit}`
}

/** Snap to a sensible number of digits so typed values stay readable. */
function round(v: number, def: ParamDef): number {
  if (def.scale === 'log') {
    const mag = Math.pow(10, Math.floor(Math.log10(Math.abs(v))) - 2)
    return Math.round(v / mag) * mag
  }
  const span = def.max - def.min
  const step = span > 100 ? 1 : span > 10 ? 0.1 : 0.01
  return Math.round(v / step) * step
}
