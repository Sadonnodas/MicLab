import { useEffect, useRef, useState, type ReactNode } from 'react'
import { GLOSSARY_PATTERNS, type GlossaryEntry } from '../lessons/glossary'

/**
 * Text with its jargon explained in place.
 *
 * Every word a newcomer would not already know gets a dotted underline; hover
 * or tap it and a plain-language definition appears. The word itself stays —
 * writing round "capacitor" would be worse than explaining it, because the
 * whole point is to end up knowing what one is.
 *
 * Only the first occurrence in a passage is marked, so a paragraph about
 * capacitors is not a field of dotted underlines.
 */

/** Matches the w-72 on the bubble. */
const TOOLTIP_WIDTH = 288

export function Explained({ children, className }: { children: string; className?: string }) {
  const seen = useRef(new Set<string>())
  seen.current = new Set()
  return <p className={className}>{annotate(children, seen.current)}</p>
}

/** Same, without wrapping in a paragraph. */
export function ExplainedInline({ children }: { children: string }) {
  return <>{annotate(children, new Set())}</>
}

function annotate(text: string, seen: Set<string>): ReactNode[] {
  const out: ReactNode[] = []
  let rest = text
  let key = 0

  while (rest.length > 0) {
    let best: { index: number; length: number; entry: GlossaryEntry } | null = null
    for (const { pattern, entry } of GLOSSARY_PATTERNS) {
      if (seen.has(entry.term)) continue
      const m = pattern.exec(rest)
      if (!m) continue
      // Earliest match wins; on a tie the longer word wins, so "stray
      // capacitance" is preferred over the "capacitance" inside it.
      if (!best || m.index < best.index || (m.index === best.index && m[0].length > best.length)) {
        best = { index: m.index, length: m[0].length, entry }
      }
    }
    if (!best) {
      out.push(rest)
      break
    }
    seen.add(best.entry.term)
    if (best.index > 0) out.push(rest.slice(0, best.index))
    out.push(
      <Term key={key++} entry={best.entry}>
        {rest.slice(best.index, best.index + best.length)}
      </Term>,
    )
    rest = rest.slice(best.index + best.length)
  }
  return out
}

function Term({ entry, children }: { entry: GlossaryEntry; children: ReactNode }) {
  // Hovering and tapping are tracked separately on purpose. With a single
  // "open" flag, moving the mouse onto the word opens the bubble and then the
  // click that follows toggles it straight back shut — which looks exactly like
  // a definition that does not work.
  const [hovered, setHovered] = useState(false)
  const [pinned, setPinned] = useState(false)
  const open = hovered || pinned
  const ref = useRef<HTMLSpanElement>(null)
  const [flip, setFlip] = useState(false)
  const [alignRight, setAlignRight] = useState(false)

  useEffect(() => {
    if (!open || !ref.current) return
    // Keep the bubble on screen: drop it below the word when there is no room
    // above, and hang it from the right when the word is near the right edge.
    const box = ref.current.getBoundingClientRect()
    setFlip(box.top < 190)
    setAlignRight(box.left + TOOLTIP_WIDTH > window.innerWidth - 40)
  }, [open])

  useEffect(() => {
    if (!pinned) return
    const close = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setPinned(false)
    }
    window.addEventListener('mousedown', close)
    return () => window.removeEventListener('mousedown', close)
  }, [pinned])

  return (
    <span
      ref={ref}
      className="relative"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <button
        onClick={(e) => {
          e.stopPropagation()
          setPinned((v) => !v)
        }}
        className="cursor-help border-b border-dotted border-copper-500/70 text-copper-200/90 transition-colors hover:border-copper-300 hover:text-copper-100"
        aria-expanded={open}
      >
        {children}
      </button>
      {open ? (
        <span
          role="tooltip"
          className={`absolute z-40 w-72 rounded-md border border-zinc-700 bg-zinc-900 p-3 text-left shadow-xl ${
            flip ? 'top-[calc(100%+8px)]' : 'bottom-[calc(100%+8px)]'
          } ${alignRight ? 'right-0' : 'left-0'}`}
        >
          <span className="mb-1 block text-[11px] font-medium uppercase tracking-wider text-copper-400">
            {entry.term}
          </span>
          <span className="block text-[12px] font-normal leading-relaxed text-zinc-300">
            {entry.short}
          </span>
          {entry.more ? (
            <span className="mt-1.5 block text-[11.5px] font-normal leading-relaxed text-zinc-500">
              {entry.more}
            </span>
          ) : null}
        </span>
      ) : null}
    </span>
  )
}
