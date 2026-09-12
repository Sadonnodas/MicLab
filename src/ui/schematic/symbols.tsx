import type { ReactNode } from 'react'

/**
 * Schematic primitives.
 *
 * Hand-placed rather than auto-routed: there are only a handful of fixed
 * topologies in v1, and a human-placed schematic reads far better than anything
 * a layout algorithm would produce at this size.
 *
 * Every part is wrapped in a <Part> so selection, highlighting and hover
 * explanations all work from one `data-element-id` lookup.
 */

export interface PartProps {
  id: string
  label?: string
  selected?: boolean
  dimmed?: boolean
  /**
   * Assembly walkthrough. 'fitted' is on the board, 'new' has just gone in and
   * glows, 'empty' is a pad waiting for a part and is drawn as a faint outline.
   */
  fit?: 'fitted' | 'new' | 'empty'
  onSelect?: (id: string) => void
  onHover?: (id: string | null) => void
  children: ReactNode
}

export function Part({ id, selected, dimmed, fit = 'fitted', onSelect, onHover, children }: PartProps) {
  const empty = fit === 'empty'
  const isNew = fit === 'new'
  return (
    <g
      data-element-id={id}
      className={`transition-all duration-300 ${empty ? 'opacity-20' : dimmed ? 'opacity-40' : 'opacity-100'} ${
        empty ? '' : 'cursor-pointer'
      }`}
      onClick={(e) => {
        e.stopPropagation()
        if (!empty) onSelect?.(id)
      }}
      onMouseEnter={() => !empty && onHover?.(id)}
      onMouseLeave={() => onHover?.(null)}
    >
      {/*
        A resistor is drawn with a 1.4px line, which is a miserable thing to
        try to hit with a mouse and impossible with a finger. Drawing the same
        shapes again underneath with a fat transparent stroke gives every part
        a target about sixteen pixels wide, at no visual cost.
      */}
      {empty ? null : (
        <g stroke="transparent" strokeWidth={16} fill="none" style={{ pointerEvents: 'stroke' }}>
          {children}
        </g>
      )}
      <g
        stroke={isNew || selected ? 'var(--color-copper-400)' : 'var(--schematic-part)'}
        fill="none"
        strokeWidth={isNew ? 2.4 : selected ? 2 : 1.4}
        strokeLinecap="round"
        strokeDasharray={empty ? '3 3' : undefined}
        style={
          isNew
            ? { filter: 'drop-shadow(0 0 5px color-mix(in srgb, var(--color-copper-400) 65%, transparent))' }
            : undefined
        }
      >
        {children}
      </g>
    </g>
  )
}

export const Wire = ({ d }: { d: string }) => (
  <path d={d} stroke="var(--color-zinc-600)" strokeWidth={1.2} fill="none" strokeLinecap="round" />
)

export const Node = ({ x, y }: { x: number; y: number }) => (
  <circle cx={x} cy={y} r={2.4} fill="var(--color-zinc-600)" stroke="none" />
)

/** IEC-style rectangular resistor. */
export function Resistor({ x, y, vertical }: { x: number; y: number; vertical?: boolean }) {
  const w = 26
  const h = 10
  return vertical ? (
    <>
      <rect x={x - h / 2} y={y - w / 2} width={h} height={w} rx={1} />
      <line x1={x} y1={y - w / 2 - 8} x2={x} y2={y - w / 2} />
      <line x1={x} y1={y + w / 2} x2={x} y2={y + w / 2 + 8} />
    </>
  ) : (
    <>
      <rect x={x - w / 2} y={y - h / 2} width={w} height={h} rx={1} />
      <line x1={x - w / 2 - 8} y1={y} x2={x - w / 2} y2={y} />
      <line x1={x + w / 2} y1={y} x2={x + w / 2 + 8} y2={y} />
    </>
  )
}

export function Capacitor({ x, y, vertical }: { x: number; y: number; vertical?: boolean }) {
  const gap = 5
  const plate = 15
  return vertical ? (
    <>
      <line x1={x - plate} y1={y - gap} x2={x + plate} y2={y - gap} />
      <line x1={x - plate} y1={y + gap} x2={x + plate} y2={y + gap} />
      <line x1={x} y1={y - gap - 11} x2={x} y2={y - gap} />
      <line x1={x} y1={y + gap} x2={x} y2={y + gap + 11} />
    </>
  ) : (
    <>
      <line x1={x - gap} y1={y - plate} x2={x - gap} y2={y + plate} />
      <line x1={x + gap} y1={y - plate} x2={x + gap} y2={y + plate} />
      <line x1={x - gap - 11} y1={y} x2={x - gap} y2={y} />
      <line x1={x + gap} y1={y} x2={x + gap + 11} y2={y} />
    </>
  )
}

/** The capsule: a capacitor with a curved (moving) plate. */
export function CapsuleSymbol({ x, y }: { x: number; y: number }) {
  return (
    <>
      <line x1={x - 5} y1={y - 22} x2={x - 5} y2={y + 22} />
      <path d={`M ${x + 6} ${y - 22} Q ${x + 13} ${y} ${x + 6} ${y + 22}`} />
      <line x1={x - 5} y1={y} x2={x - 24} y2={y} />
      <line x1={x + 8} y1={y} x2={x + 26} y2={y} />
    </>
  )
}

export function Inductor({ x, y, vertical, coils = 4 }: { x: number; y: number; vertical?: boolean; coils?: number }) {
  const r = 6
  const len = coils * r * 2
  let d = ''
  if (vertical) {
    let cy = y - len / 2
    d = `M ${x} ${y - len / 2 - 8} L ${x} ${cy}`
    for (let i = 0; i < coils; i++) {
      d += ` A ${r} ${r} 0 0 1 ${x} ${cy + r * 2}`
      cy += r * 2
    }
    d += ` L ${x} ${y + len / 2 + 8}`
  } else {
    let cx = x - len / 2
    d = `M ${x - len / 2 - 8} ${y} L ${cx} ${y}`
    for (let i = 0; i < coils; i++) {
      d += ` A ${r} ${r} 0 0 1 ${cx + r * 2} ${y}`
      cx += r * 2
    }
    d += ` L ${x + len / 2 + 8} ${y}`
  }
  return <path d={d} />
}

/** N-channel JFET, drain up. */
export function Jfet({ x, y }: { x: number; y: number }) {
  return (
    <>
      <circle cx={x} cy={y} r={20} />
      <line x1={x - 6} y1={y - 13} x2={x - 6} y2={y + 13} />
      <line x1={x - 22} y1={y} x2={x - 6} y2={y} />
      {/* gate arrow, pointing in: n-channel */}
      <path d={`M ${x - 13} ${y - 4} L ${x - 6} ${y} L ${x - 13} ${y + 4} Z`} fill="var(--color-zinc-400)" stroke="none" />
      <line x1={x - 6} y1={y - 9} x2={x + 10} y2={y - 9} />
      <line x1={x + 10} y1={y - 9} x2={x + 10} y2={y - 24} />
      <line x1={x - 6} y1={y + 9} x2={x + 10} y2={y + 9} />
      <line x1={x + 10} y1={y + 9} x2={x + 10} y2={y + 24} />
    </>
  )
}

export function DcSource({ x, y, label }: { x: number; y: number; label?: string }) {
  return (
    <>
      <circle cx={x} cy={y} r={13} />
      <line x1={x - 5} y1={y - 5} x2={x + 5} y2={y - 5} />
      <line x1={x} y1={y - 10} x2={x} y2={y} />
      <line x1={x - 5} y1={y + 5} x2={x + 5} y2={y + 5} />
      <line x1={x} y1={y - 13} x2={x} y2={y - 21} />
      <line x1={x} y1={y + 13} x2={x} y2={y + 21} />
      {label ? (
        <text x={x + 18} y={y + 4} fontSize={9} fill="var(--schematic-label)" stroke="none">
          {label}
        </text>
      ) : null}
    </>
  )
}

/** Dependent source — the diamond that says "this is a model, not a part". */
export function DependentSource({ x, y, sign }: { x: number; y: number; sign?: string }) {
  return (
    <>
      <path d={`M ${x} ${y - 14} L ${x + 12} ${y} L ${x} ${y + 14} L ${x - 12} ${y} Z`} />
      <line x1={x} y1={y - 14} x2={x} y2={y - 22} />
      <line x1={x} y1={y + 14} x2={x} y2={y + 22} />
      {sign ? (
        <text x={x} y={y + 4} fontSize={11} textAnchor="middle" fill="var(--color-zinc-400)" stroke="none">
          {sign}
        </text>
      ) : null}
    </>
  )
}

export const Ground = ({ x, y }: { x: number; y: number }) => (
  <g stroke="var(--color-zinc-600)" strokeWidth={1.2} fill="none">
    <line x1={x} y1={y} x2={x} y2={y + 6} />
    <line x1={x - 9} y1={y + 6} x2={x + 9} y2={y + 6} />
    <line x1={x - 5.5} y1={y + 10} x2={x + 5.5} y2={y + 10} />
    <line x1={x - 2} y1={y + 14} x2={x + 2} y2={y + 14} />
  </g>
)

export const Label = ({
  x,
  y,
  children,
  anchor = 'middle',
  dim,
}: {
  x: number
  y: number
  children: ReactNode
  anchor?: 'start' | 'middle' | 'end'
  dim?: boolean
}) => (
  <text
    x={x}
    y={y}
    fontSize={9.5}
    textAnchor={anchor}
    fill={dim ? 'var(--schematic-label-dim)' : 'var(--schematic-label)'}
    stroke="none"
    className="pointer-events-none select-none"
  >
    {children}
  </text>
)

export const StageBox = ({
  x,
  y,
  w,
  h,
  title,
  active,
}: {
  x: number
  y: number
  w: number
  h: number
  title: string
  active: boolean
}) => (
  <g className="pointer-events-none">
    <rect
      x={x}
      y={y}
      width={w}
      height={h}
      rx={6}
      fill={active ? 'color-mix(in srgb, var(--color-copper-500) 7%, transparent)' : 'transparent'}
      stroke={active ? 'color-mix(in srgb, var(--color-copper-500) 40%, transparent)' : 'var(--color-zinc-800)'}
      strokeWidth={1}
      strokeDasharray={active ? undefined : '3 3'}
    />
    <text
      x={x + 9}
      y={y + 14}
      fontSize={9}
      fill={active ? 'var(--color-copper-400)' : 'var(--schematic-label-dim)'}
      className="uppercase tracking-widest"
    >
      {title}
    </text>
  </g>
)

/** XLR connector at the far right. */
export const Xlr = ({ x, y }: { x: number; y: number }) => (
  <g stroke="var(--color-zinc-600)" strokeWidth={1.2} fill="none">
    <circle cx={x} cy={y} r={17} />
    <circle cx={x} cy={y - 7} r={2.4} fill="var(--color-zinc-600)" />
    <circle cx={x - 6} cy={y + 4} r={2.4} fill="var(--color-zinc-600)" />
    <circle cx={x + 6} cy={y + 4} r={2.4} fill="var(--color-zinc-600)" />
  </g>
)
