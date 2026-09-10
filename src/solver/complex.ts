/**
 * Minimal complex-number helpers.
 *
 * Complex numbers are plain `{ re, im }` objects rather than a class: the LU
 * solver allocates thousands of them per AC sweep and object literals are both
 * faster and easier to inline than class instances.
 */
export interface Complex {
  re: number
  im: number
}

export const cx = (re: number, im = 0): Complex => ({ re, im })
export const ZERO: Complex = { re: 0, im: 0 }
export const ONE: Complex = { re: 1, im: 0 }

export const cAdd = (a: Complex, b: Complex): Complex => ({ re: a.re + b.re, im: a.im + b.im })
export const cSub = (a: Complex, b: Complex): Complex => ({ re: a.re - b.re, im: a.im - b.im })
export const cMul = (a: Complex, b: Complex): Complex => ({
  re: a.re * b.re - a.im * b.im,
  im: a.re * b.im + a.im * b.re,
})
export const cScale = (a: Complex, s: number): Complex => ({ re: a.re * s, im: a.im * s })
export const cNeg = (a: Complex): Complex => ({ re: -a.re, im: -a.im })

export function cDiv(a: Complex, b: Complex): Complex {
  // Smith's algorithm — avoids overflow when |b| is very large or very small,
  // which happens routinely here (1 GΩ resistors next to 1 pF capacitors).
  if (Math.abs(b.re) >= Math.abs(b.im)) {
    const r = b.im / b.re
    const d = b.re + b.im * r
    return { re: (a.re + a.im * r) / d, im: (a.im - a.re * r) / d }
  }
  const r = b.re / b.im
  const d = b.re * r + b.im
  return { re: (a.re * r + a.im) / d, im: (a.im * r - a.re) / d }
}

export const cAbs = (a: Complex): number => Math.hypot(a.re, a.im)
export const cArg = (a: Complex): number => Math.atan2(a.im, a.re)
export const cInv = (a: Complex): Complex => cDiv(ONE, a)

/** 20·log10(|a|), with a floor so a zero response does not produce -Infinity. */
export const cdB = (a: Complex): number => 20 * Math.log10(Math.max(cAbs(a), 1e-30))
