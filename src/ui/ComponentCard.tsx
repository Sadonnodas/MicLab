import { PARTS } from '../lessons/assembly'
import { Explained } from './Explained'
import { eng } from '../lib/format'
import type { Element } from '../solver/netlist'

/**
 * What a component on the schematic actually is.
 *
 * Two sources, in order of how much they say: the walkthrough's own notes on
 * the part, which are a couple of paragraphs, and the one-liner every netlist
 * element carries. Whichever is available, the jargon in it is explained.
 */

export interface ComponentDetail {
  id: string
  label: string
  value?: string
  note: string
  title?: string
  what?: string
}

/** Everything worth saying about one element of the netlist. */
export function detailFor(el: Element): ComponentDetail {
  // `silent` only means the part shares a step with another during the
  // walkthrough — several of those still carry a full explanation, and it would
  // be a waste to show the one-line note instead when somebody asks directly.
  const part = PARTS[el.id]
  return {
    id: el.id,
    label: el.label ?? el.id,
    value: valueOf(el),
    note: el.note ?? '',
    title: part?.title || undefined,
    what: part?.what || undefined,
  }
}

function valueOf(el: Element): string | undefined {
  switch (el.kind) {
    case 'R':
      return eng(el.params.R, 'Ω')
    case 'C':
      return eng(el.params.C, 'F')
    case 'L':
      return eng(el.params.L, 'H')
    case 'V':
      return `${el.params.V} V`
    case 'JFET':
      return undefined
    default:
      return undefined
  }
}

export function ComponentCard({
  detail,
  onClose,
}: {
  detail: ComponentDetail
  onClose: () => void
}) {
  // The walkthrough's note is the fuller explanation; the netlist one-liner is
  // the fallback, and worth showing alongside when both exist.
  const paragraphs = detail.what ? detail.what.split('\n\n') : detail.note ? [detail.note] : []

  return (
    <div className="relative rounded-lg border border-zinc-700 bg-zinc-900 p-4 shadow-lg">
      <button
        onClick={onClose}
        className="absolute right-2 top-2 rounded px-1.5 py-0.5 text-sm text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300"
        aria-label="Close"
      >
        ×
      </button>

      <div className="flex items-baseline gap-2 pr-6">
        <h3 className="text-sm font-medium text-zinc-100">{detail.title ?? detail.label}</h3>
        {detail.value ? <span className="tabular text-xs text-copper-300">{detail.value}</span> : null}
      </div>
      {detail.title && detail.label !== detail.title ? (
        <p className="mt-0.5 text-[11px] text-zinc-500">on the schematic: {detail.label}</p>
      ) : null}

      {paragraphs.map((para, i) => (
        <Explained key={i} className="mt-2.5 text-[12.5px] leading-relaxed text-zinc-300">
          {para}
        </Explained>
      ))}

      {detail.what && detail.note ? (
        <Explained className="mt-2.5 border-t border-zinc-800 pt-2.5 text-[11.5px] leading-relaxed text-zinc-500">
          {detail.note}
        </Explained>
      ) : null}
    </div>
  )
}
