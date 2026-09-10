/**
 * Generate the ngspice golden file for the reference build (§4.8 item 4).
 * Run with: npx vite-node scripts/gen-golden.ts
 */
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { buildCircuit } from '../src/stages/build'
import { referenceBuild } from '../src/data/presets'
import { spiceDeck } from '../src/solver/spice'

const built = buildCircuit(referenceBuild())
const dir = mkdtempSync(join(tmpdir(), 'miclab-spice-'))
const csv = join(dir, 'out.csv')
const deck = spiceDeck(built.netlist, csv, { title: 'Mic Lab reference build', gmin: 1e-12 })
const deckPath = join(dir, 'deck.cir')
writeFileSync(deckPath, deck)
console.log(deckPath)
execFileSync('ngspice', ['-b', deckPath], { stdio: 'inherit' })

const rows = readFileSync(csv, 'utf8')
  .trim()
  .split('\n')
  .map((l) => l.trim().split(/\s+/).map(Number))
  .filter((r) => r.length >= 3 && r.every((x) => isFinite(x)))

mkdirSync('src/solver/__tests__/golden', { recursive: true })
writeFileSync(
  'src/solver/__tests__/golden/ngspice-reference.csv',
  ['# freq,re,im — ngspice 47, reference build, capsule EMF = 1 V AC', ...rows.map((r) => `${r[0]},${r[1]},${r[2]}`)].join('\n') + '\n',
)
console.log('wrote', rows.length, 'points')
