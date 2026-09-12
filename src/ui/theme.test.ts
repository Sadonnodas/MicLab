import { describe, expect, it } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Daylight mode works by redefining the colour scale rather than by pinning a
 * `dark:` variant onto several hundred class names. That is only safe while
 * every shade the app uses actually has a light value — one that does not is
 * invisible in one theme or the other, and nothing else would catch it.
 */

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f)
    return statSync(p).isDirectory() ? walk(p) : p.endsWith('.tsx') || p.endsWith('.ts') ? [p] : []
  })
}

const sources = walk('src').filter((f) => !f.endsWith('.test.ts') && !f.endsWith('.test.tsx'))
const code = sources.map((f) => readFileSync(f, 'utf8')).join('\n')
const css = readFileSync('src/styles/index.css', 'utf8')
const lightBlocks = [...css.matchAll(/:root\[data-theme='light'\]\s*\{([^}]*)\}/g)]
  .map((m) => m[1])
  .join('\n')

describe('daylight mode', () => {
  it('gives every zinc shade the app uses a light value', () => {
    const used = new Set([...code.matchAll(/(?:zinc)-(\d{2,3})/g)].map((m) => m[1]))
    expect(used.size).toBeGreaterThan(5)
    for (const shade of used) {
      expect(
        lightBlocks.includes(`--color-zinc-${shade}:`),
        `zinc-${shade} is used but has no daylight value`,
      ).toBe(true)
    }
  })

  it('gives every copper shade the app uses a light value', () => {
    const used = new Set([...code.matchAll(/copper-(\d{2,3})/g)].map((m) => m[1]))
    expect(used.size).toBeGreaterThan(3)
    for (const shade of used) {
      expect(
        lightBlocks.includes(`--color-copper-${shade}:`),
        `copper-${shade} is used but has no daylight value`,
      ).toBe(true)
    }
  })

  it('gives every status colour a light value', () => {
    // Amber warns, red is a fault, emerald is a pass — and on a light ground
    // the light end of each scale becomes invisible unless it is swapped.
    const used = new Set(
      [...code.matchAll(/-(amber|red|emerald)-(\d{2,3})/g)].map((m) => `${m[1]}-${m[2]}`),
    )
    expect(used.size).toBeGreaterThan(5)
    for (const shade of used) {
      expect(
        lightBlocks.includes(`--color-${shade}:`),
        `${shade} is used but has no daylight value`,
      ).toBe(true)
    }
  })

  it('gives every drawing and category colour a light value', () => {
    const used = new Set([...code.matchAll(/var\(--((?:cat|schematic|graph)-[a-z-]+)\)/g)].map((m) => m[1]))
    expect(used.size).toBeGreaterThan(8)
    for (const name of used) {
      expect(lightBlocks.includes(`--${name}:`), `--${name} is used but has no daylight value`).toBe(true)
    }
  })

  it('has no hard-coded colours left in anything that draws', () => {
    // A literal hex cannot follow the theme, so the schematic and the graphs
    // would stay dark-mode grey on a white page.
    for (const file of sources.filter((f) => f.includes('/ui/'))) {
      const text = readFileSync(file, 'utf8')
      const hex = [...text.matchAll(/['"]#[0-9a-fA-F]{3,8}['"]/g)].map((m) => m[0])
      expect(hex, `${file} still has literal colours: ${hex.join(', ')}`).toHaveLength(0)
    }
  })

  it('sets the theme before first paint', () => {
    // Without this the whole page flashes near-black on every load in daylight.
    const html = readFileSync('index.html', 'utf8')
    expect(html).toMatch(/dataset\.theme/)
    expect(html.indexOf('dataset.theme')).toBeLessThan(html.indexOf('src/main.tsx'))
  })
})
