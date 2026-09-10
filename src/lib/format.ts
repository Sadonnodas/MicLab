const PREFIXES: Array<[number, string]> = [
  [1e12, 'T'],
  [1e9, 'G'],
  [1e6, 'M'],
  [1e3, 'k'],
  [1, ''],
  [1e-3, 'm'],
  [1e-6, 'µ'],
  [1e-9, 'n'],
  [1e-12, 'p'],
  [1e-15, 'f'],
]

/** 1.5e-9 F → "1.5 nF"; 4700 Ω → "4.7 kΩ". */
export function eng(value: number, unit = '', digits = 3): string {
  if (!isFinite(value)) return `∞ ${unit}`.trim()
  if (value === 0) return `0 ${unit}`.trim()
  const abs = Math.abs(value)
  let mult = 1
  let prefix = ''
  for (const [m, p] of PREFIXES) {
    if (abs >= m * 0.999) {
      mult = m
      prefix = p
      break
    }
  }
  if (abs < 1e-15) {
    mult = 1e-15
    prefix = 'f'
  }
  const scaled = value / mult
  const s = scaled >= 100 ? scaled.toFixed(0) : scaled >= 10 ? scaled.toFixed(Math.max(digits - 2, 0)) : scaled.toFixed(Math.max(digits - 1, 0))
  return `${trimZeros(s)} ${prefix}${unit}`.trim()
}

function trimZeros(s: string): string {
  return s.includes('.') ? s.replace(/0+$/, '').replace(/\.$/, '') : s
}

export const hz = (f: number): string => eng(f, 'Hz', 3)
export const db = (v: number, digits = 1): string => `${v >= 0 ? '+' : '−'}${Math.abs(v).toFixed(digits)} dB`
export const dbPlain = (v: number, digits = 1): string => `${v.toFixed(digits)} dB`

/** Parse "4k7", "4.7k", "1G", "100p" and plain numbers. */
export function parseEng(input: string): number | null {
  const s = input.trim().replace(/\s+/g, '').replace(/[ΩFHVvhz]+$/i, '')
  if (s === '') return null
  const m = /^([0-9.]*)([TGMkKmuµnpf]?)([0-9]*)$/.exec(s)
  if (!m) {
    const n = Number(s)
    return isFinite(n) ? n : null
  }
  const [, head, prefix, tail] = m
  const mult =
    { T: 1e12, G: 1e9, M: 1e6, k: 1e3, K: 1e3, m: 1e-3, u: 1e-6, µ: 1e-6, n: 1e-9, p: 1e-12, f: 1e-15 }[
      prefix
    ] ?? 1
  const digits = tail ? `${head || '0'}.${tail}` : head
  const n = Number(digits)
  return isFinite(n) ? n * mult : null
}
