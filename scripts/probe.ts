import { analyse } from '../src/solver/analysis'
import { defaultBuild } from '../src/stages/build'
import { interpAt } from '../src/solver/ac'

const spec = defaultBuild()
const r = analyse(spec)
console.log('solve ms', r.solveMs.toFixed(1))
console.log('sensitivity mV/Pa', (r.sensitivity * 1000).toFixed(1), ' dBV/Pa', r.sensitivityDbv.toFixed(1))
console.log('self-noise dB-A', r.selfNoiseDbA.toFixed(2), ' electronics only', r.electronicsDbA.toFixed(2))
console.log('op', JSON.stringify(r.op.fets, null, 1))
console.log('vpol', r.op.vpol, 'converged', r.op.converged, r.op.warning ?? '')
for (const f of [20, 50, 100, 1000, 5000, 7000, 10000, 15000, 20000]) {
  console.log(' ', f, 'Hz', interpAt(r.freqs, r.mag, f).toFixed(2), 'dB')
}
console.log('breakdown')
for (const b of r.noiseBreakdown) console.log('  ', b.label, b.dBA.toFixed(1), 'dB-A', (b.share * 100).toFixed(0) + '%')
