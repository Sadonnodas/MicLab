import { describe, expect, it } from 'vitest'
import { GLOSSARY, GLOSSARY_PATTERNS } from './glossary'
import { PARTS } from './assembly'

/**
 * The glossary exists because somebody reading the walkthrough does not already
 * know what a capacitor is. It fails at that the moment a definition leans on
 * another word they also do not know.
 */

/** Words that are jargon, and must therefore be defined before they are used. */
const JARGON = [
  'capacitor',
  'capacitance',
  'transducer',
  'impedance',
  'transistor',
  'JFET',
  'gigaohm',
  'megohm',
  'inductance',
  'bias',
  'rectifier',
  'electret',
  'polarisation',
  'phantom power',
  'high-pass',
  'transformer',
  'diaphragm',
  'backplate',
  'preamp',
  'self-noise',
]

const defined = new Set(GLOSSARY.map((e) => e.term.toLowerCase()))

describe('glossary', () => {
  it('defines every word the walkthrough leans on', () => {
    for (const word of JARGON) {
      expect(defined.has(word.toLowerCase()), `"${word}" is used but never defined`).toBe(true)
    }
  })

  it('never explains a word using another undefined word', () => {
    // The one rule that makes a glossary useful rather than circular.
    const allowed = new Set([...defined, 'ohm', 'ohms', 'farad', 'farads', 'amp', 'amps', 'decibel', 'decibels'])
    for (const entry of GLOSSARY) {
      const text = `${entry.short} ${entry.more ?? ''}`
      for (const word of JARGON) {
        if (word.toLowerCase() === entry.term.toLowerCase()) continue
        if (!new RegExp(`\\b${word}\\b`, 'i').test(text)) continue
        expect(
          allowed.has(word.toLowerCase()),
          `the definition of "${entry.term}" uses "${word}", which is not itself defined`,
        ).toBe(true)
      }
    }
  })

  it('keeps definitions short enough to read in a tooltip', () => {
    for (const entry of GLOSSARY) {
      expect(entry.short.length, entry.term).toBeGreaterThan(40)
      expect(entry.short.length, entry.term).toBeLessThan(320)
    }
  })

  it('has no duplicate terms or aliases', () => {
    const seen = new Set<string>()
    for (const e of GLOSSARY) {
      for (const w of [e.term, ...(e.aliases ?? [])]) {
        const k = w.toLowerCase()
        expect(seen.has(k), `"${w}" appears twice`).toBe(false)
        seen.add(k)
      }
    }
  })

  it('matches longer phrases before the shorter words inside them', () => {
    // "stray capacitance" must win over the "capacitance" within it.
    const text = 'the stray capacitance at the gate'
    const first = GLOSSARY_PATTERNS.find((p) => p.pattern.test(text))!
    expect(first.entry.term).toBe('stray capacitance')
  })

  it('explains something on every screen of the walkthrough', () => {
    for (const [id, info] of Object.entries(PARTS)) {
      if (info.silent) continue
      const text = `${info.what} ${info.expect}`
      const hits = GLOSSARY_PATTERNS.filter((p) => p.pattern.test(text))
      expect(hits.length, `"${id}" has nothing a newcomer could look up`).toBeGreaterThan(0)
    }
  })
})
