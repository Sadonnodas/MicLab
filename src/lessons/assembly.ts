import { buildCircuit, type BuildSpec } from '../stages/build'

/**
 * The assembly walkthrough: populate a board one part at a time.
 *
 * Rather than a fixed script, this is a table of *what each part is for*, keyed
 * by element id, plus an order to fit them in. Any build the user has made —
 * Raven, Blue Jay, the electret, or something they invented — can be assembled,
 * because the steps are derived from whatever netlist that build produces.
 *
 * A few parts arrive together because they cannot stand alone: a transformer is
 * one component even though the model needs six elements for it, and a
 * transistor with nowhere for its current to go is not a circuit.
 */

export interface PartInfo {
  /** Fitting order. Gaps left deliberately so parts can be slotted in later. */
  order: number
  /** What you would call the part on a bill of materials. */
  title: string
  /** What it is and what it does, in a sentence or two. */
  what: string
  /** What to look for on the graph or listen for when it goes in. */
  expect: string
  /** Other element ids fitted in the same step. */
  with?: string[]
  /** Fitted silently alongside another part — never its own step. */
  silent?: boolean
}

export const PARTS: Record<string, PartInfo> = {
  // ---------------------------------------------------------------- capsule
  'capsule.C': {
    order: 10,
    title: 'The capsule',
    what: 'Two plates a few tens of microns apart: a stretched gold-sputtered membrane, and a drilled brass backplate. Sound moves the membrane, the gap changes, the capacitance changes. That is the entire transducer — and at this point it is only a capacitor.',
    expect:
      'Nothing. Press play and you will hear silence, and the numbers will say there is no output at all. A capacitor with no charge on it produces no signal, however hard you shout at it. That is not a fault, it is the whole reason the next part exists.',
    with: ['capsule.E', 'pol.backGnd'],
  },
  'capsule.E': { order: 10, title: '', what: '', expect: '', silent: true },
  'pol.backGnd': { order: 10, title: '', what: '', expect: '', silent: true },

  // ----------------------------------------------------------- polarisation
  'pol.V': {
    order: 20,
    title: 'The polarisation supply',
    what: 'Sixty volts of DC, generated inside the microphone by a voltage multiplier running off phantom power. Its job is to put a fixed charge on the capsule. Hold that charge still and let sound change the capacitance, and the voltage has to move to compensate — that moving voltage is the signal.\n\nIt arrives with the gigaohm resistor that feeds it to the capsule, and — on a board that polarises the backplate — with the capacitor that holds that backplate at audio ground. All three are one job: put charge on, and then get out of the way.',
    expect:
      'The microphone comes alive. You now have an output, and its shape is the capsule’s own: flat through the middle, with the K67 lift and the diaphragm resonance at the top.',
    with: ['pol.R_pol', 'pol.C_bypass'],
  },
  'pol.R_pol': {
    order: 21,
    title: 'The polarisation resistor',
    what: 'One gigaohm — physically the strangest component in the microphone. It has to pass DC to charge the capsule, and pass nothing at all at audio frequencies, because any charge that escapes through it during a cycle of sound is signal you never hear.',
    expect:
      'With the capsule’s 55 pF it makes a high-pass filter. At a gigaohm the corner is far below anything audible. Drag it down later and watch the bass leave.',
    silent: true,
  },
  // Fitted with the polarisation supply, because a backplate-polarised board
  // with the supply but no bypass has its gigaohm in series with the signal —
  // fifty decibels down and sixty dB-A of noise, which is an alarming thing to
  // show somebody halfway through a step they did nothing wrong in.
  'pol.C_bypass': { order: 20, title: '', what: '', expect: '', silent: true },
  'pol.C_couple': {
    order: 25,
    title: 'The coupling capacitor',
    what: 'The diaphragm is sitting at 60 V and the transistor’s gate needs to be near zero, so this capacitor passes the audio and blocks the DC.',
    expect:
      'A second high-pass corner, far below the audible band. It also forms a capacitive divider with the capsule — 1 nF against 55 pF costs about half a decibel, but shrink it to 100 pF and you throw away nearly four.',
  },

  // -------------------------------------------------------------- converter
  'conv.V_dd': {
    order: 30,
    title: 'The supply rail',
    what: 'Twelve volts, again derived from phantom power, to run the transistor. Note how little the microphone asks for: a fraction of a milliamp.',
    expect:
      'Nothing yet — there is nothing connected to it. This is one of those steps where the honest answer is that you are preparing for the next part.',
    with: ['conv.R_d'],
  },
  'conv.R_d': {
    order: 31,
    title: 'The drain resistor',
    what: 'The transistor will produce a current that varies with the sound. This resistor is what turns that current back into a voltage — gain, in one component.',
    expect: 'Still nothing audible. The transistor is next.',
    silent: true,
  },
  'conv.R_gate': {
    order: 33,
    title: 'The gate resistor',
    what: 'Another gigaohm, holding the transistor’s gate at a defined DC voltage. It has to be enormous for exactly the same reason the polarisation resistor does: anything smaller drains the signal away before the transistor can see it.',
    expect:
      'It sets a low-frequency corner of its own, working against the capsule. On a backplate-polarised board this — not the polarisation resistor — is what decides how much bass the microphone has.',
  },
  'conv.R_gate2': {
    order: 34,
    title: 'The bootstrap return resistor',
    what: 'The lower half of a split gate resistor. It provides the DC path to ground; the bootstrap capacitor keeps audio off it.',
    expect: 'Nothing on its own — the capacitor that follows is what makes this arrangement clever.',
  },
  'conv.C_boot': {
    order: 35,
    title: 'The bootstrap capacitor',
    what: 'Drives the bottom of the gate resistor from the source, so both ends of that resistor move together — and a resistor with the same voltage at both ends carries no current. As far as the signal is concerned it has become about twenty times larger.',
    expect: 'A lower corner frequency, and a little less noise, for the price of one capacitor.',
  },
  'conv.J': {
    order: 36,
    title: 'The JFET',
    what: 'The impedance converter, and the reason the microphone works at all. At 20 Hz the capsule is a 145 megohm source — nothing you can buy could look at it without loading it into silence. This transistor’s gate draws picoamps, so it can watch that voltage without disturbing it, and reproduce it somewhere useful.\n\nIt arrives with its source resistor, because a transistor with nowhere for its current to go is not a circuit.',
    expect:
      'A big jump in level, and a loss you did not ask for: the transistor’s own gate capacitance now sits across the capsule and takes a few decibels straight off the top of the signal. Look at the operating point to see where it settled.',
    with: ['conv.R_s'],
  },
  'conv.R_s': {
    order: 36,
    title: 'The source resistor',
    what: 'Sets the bias. Drain current flowing through it lifts the source above the gate, which is exactly the negative gate-to-source voltage this transistor wants — so the stage sets its own operating point, and keeps doing so despite JFETs varying wildly from one to the next.',
    expect: '',
    silent: true,
  },
  'conv.C_s': {
    order: 38,
    title: 'The source bypass capacitor',
    what: 'The source resistor is negative feedback: when the current rises the source rises with it, pushing the current back down. That costs a lot of gain. This capacitor shorts the resistor out for audio only, so the DC bias stays and the gain comes back.',
    expect:
      'A large jump in level. Its corner with the source resistor decides where that gain arrives — undersize it and you have accidentally designed a bass roll-off.',
  },
  'conv.C_stray': {
    order: 39,
    title: 'Stray capacitance (you did not fit this)',
    what: 'Nobody solders this on. It is the gate track, the pad, the solder blob, the transistor’s own leads and whatever moisture is on the board — all of it in parallel with the capsule, all of it forming a divider against its 55 pF.',
    expect:
      'A few tenths of a decibel gone, evenly, at every frequency. It never comes back: the noise after the divider is unchanged, so this is signal-to-noise thrown away. It is why the transistor sits millimetres from the capsule and why the gate track is as short as the layout allows.',
  },
  'conv.R_fb': {
    order: 41,
    title: 'The de-emphasis network',
    what: 'A resistor and a capacitor in series from the drain back to the source. The capacitor’s impedance falls with frequency, so the higher you go the more this network loads the drain and the more gain the stage gives away — a shelf, pulled down exactly where the K67 capsule has too much.\n\nNote where it returns: the source, not the gate. Hang a resistor off a hundred-megohm node and you have connected a noise generator to it.',
    expect:
      'The top end comes down. This is the single difference between a U87-style board and a U47-style one, with the same capsule in front of both.',
    with: ['conv.C_fb'],
  },
  'conv.C_fb': { order: 41, title: '', what: '', expect: '', silent: true },

  // ----------------------------------------------------------------- output
  'out.drv': {
    order: 50,
    title: 'The driver stage',
    what: 'A buffer with a low output impedance, sitting between the transistor and the transformer. It looks like a component you could leave out, and it is the difference between a microphone with bass and one without.',
    expect:
      'Nothing audible yet — but when the transformer goes in, compare it against the “straight from the drain” option and listen to the bottom disappear.',
  },
  'out.C_out': {
    order: 52,
    title: 'The output coupling capacitor',
    what: 'Blocks the stage’s DC from whatever comes next. On a transformer board this matters more than it looks: a DC current through the primary magnetises the core.',
    expect: 'The last high-pass in the microphone, working against whatever follows it.',
  },
  'out.L_p': {
    order: 54,
    title: 'The output transformer',
    what: 'Two coils on a shared core. It divides the voltage by the turns ratio, multiplies the impedance by its square, and gives you a balanced output with no electrical connection at all between the microphone and the preamp. One part, six elements in the model — the windings, their copper resistance, the coupling and the capacitance between turns.',
    expect:
      'The level drops by about 17 dB on a 7:1 — real, and you make it up at the preamp. Watch the bottom octave too: the primary inductance resonates with the coupling capacitor and puts a gentle lift down there, which is part of why transformer microphones are described as sounding big.',
    with: ['out.L_s', 'out.K', 'out.C_w', 'out.R_p', 'out.R_s1', 'out.R_s2'],
  },
  'out.L_s': { order: 54, title: '', what: '', expect: '', silent: true },
  'out.K': { order: 54, title: '', what: '', expect: '', silent: true },
  'out.C_w': { order: 54, title: '', what: '', expect: '', silent: true },
  'out.R_p': { order: 54, title: '', what: '', expect: '', silent: true },
  'out.R_s1': { order: 54, title: '', what: '', expect: '', silent: true },
  'out.R_s2': { order: 54, title: '', what: '', expect: '', silent: true },
  'out.Ep': {
    order: 55,
    title: 'The phase splitter',
    what: 'Two devices producing the same signal with opposite polarity. That is all “balanced” means: send it twice, once inverted, and the receiver subtracts one from the other so the signal doubles and anything picked up along the way cancels.',
    expect:
      'A balanced output without a transformer — cheaper, lighter, and flatter. What you give up is isolation: the microphone’s ground and the preamp’s ground are now connected, which is where every ground-loop problem comes from.',
    with: ['out.En'],
  },
  'out.En': { order: 55, title: '', what: '', expect: '', silent: true },
  'out.C_outp': {
    order: 56,
    title: 'The output coupling capacitors',
    what: 'One on each leg, blocking the DC the phase splitter sits at. They are in series around the loop through the preamp’s input, so the pair behaves as half of one of them.',
    expect:
      'The last high-pass in the microphone. Into a 1.5 kΩ preamp, 47 µF each corners around 4 Hz; 4.7 µF each would corner at 43 Hz and you would certainly hear it.',
    with: ['out.C_outn'],
  },
  'out.C_outn': { order: 56, title: '', what: '', expect: '', silent: true },
  'out.R_outp': {
    order: 57,
    title: 'The build-out resistors',
    what: 'Small series resistors on each leg. They protect the output devices, keep radio frequencies out, and set the microphone’s source impedance — the 50 to 200 ohms a studio input expects to see.',
    expect:
      'Almost nothing on the graph, which is the point. They also set how well the two legs are matched, and that decides how much of a ground loop you hear.',
    with: ['out.R_outn'],
  },
  'out.R_outn': { order: 57, title: '', what: '', expect: '', silent: true },
  'out.R_out': {
    order: 57,
    title: 'The output resistor',
    what: 'The series resistance of an unbalanced output — the arrangement an electret capsule module gives you, with the shield as the return.',
    expect:
      'It works, and over a short cable in a quiet room it works well. Switch on a ground loop later and compare it with the balanced output: that comparison is the whole argument for balanced lines.',
    with: ['out.gndLeg'],
  },
  'out.gndLeg': { order: 57, title: '', what: '', expect: '', silent: true },

  // ------------------------------------------------------------------- load
  'load.R_preamp': {
    order: 70,
    title: 'The cable and the preamp',
    what: 'Not part of the microphone, and completely part of how it sounds. Every metre of cable is about 100 pF from each leg to the screen, and the preamp presents a finite input impedance across pins 2 and 3.',
    expect:
      'On a transformerless output the preamp’s impedance works against the output capacitors and moves the bass corner. On a transformer output it is reflected into the primary multiplied by the square of the turns ratio, where it damps the transformer instead.',
    with: [
      'load.R_cablep',
      'load.R_cablen',
      'load.C_cablep',
      'load.C_cablen',
      'load.R_cmp',
      'load.R_cmn',
      'load.R_shield',
    ],
  },
  'load.R_cablep': { order: 70, title: '', what: '', expect: '', silent: true },
  'load.R_cablen': { order: 70, title: '', what: '', expect: '', silent: true },
  'load.C_cablep': { order: 70, title: '', what: '', expect: '', silent: true },
  'load.C_cablen': { order: 70, title: '', what: '', expect: '', silent: true },
  'load.R_cmp': { order: 70, title: '', what: '', expect: '', silent: true },
  'load.R_cmn': { order: 70, title: '', what: '', expect: '', silent: true },
  'load.R_shield': { order: 70, title: '', what: '', expect: '', silent: true },
  'load.C_rfp': {
    order: 75,
    title: 'The radio-frequency capacitors',
    what: 'Two 100 pF capacitors from the output pins to the connector shell. A microphone cable is a fine antenna at 900 MHz, and radio frequency itself would be harmless — except that a semiconductor junction is a rectifier, so the transistor demodulates whatever reaches it.',
    expect:
      'Nothing at all in the audio band. Their entire job is to short radio frequency to the shield before it can reach anything that rectifies. Leave them out and switch on the RF fault to hear what you have bought.',
    with: ['load.C_rfn'],
  },
  'load.C_rfn': { order: 75, title: '', what: '', expect: '', silent: true },
}

export interface AssemblyStep {
  /** The element that names this step. */
  id: string
  title: string
  what: string
  expect: string
  /** Everything fitted at this step. */
  adds: string[]
  /** Everything on the board once this step is done. */
  enabled: Set<string>
  /** Where the walkthrough measures at this point. */
  probe: [string, string]
}

/**
 * Where to measure on a half-populated board.
 *
 * The first pair whose nodes both exist yet — exactly what you would do with a
 * scope: clip it to the furthest point down the signal path that is actually
 * connected to anything.
 */
const PROBE_POINTS: Array<[string, string]> = [
  ['loadp', 'loadn'],
  ['outp', 'outn'],
  ['drn', 'gnd'],
  ['src', 'gnd'],
  ['gate', 'gnd'],
  ['dia', 'gnd'],
]

/** Derive the assembly sequence for whatever build the user is holding. */
export function assemblySteps(spec: BuildSpec): AssemblyStep[] {
  const { netlist } = buildCircuit(spec)
  const present = new Set(netlist.elements.map((e) => e.id))

  // Leaders are the elements that get their own step; everything else is either
  // fitted alongside one, or has no entry and is fitted with the nearest leader.
  const leaders = netlist.elements
    .filter((e) => PARTS[e.id] && !PARTS[e.id].silent)
    .map((e) => ({ id: e.id, info: PARTS[e.id] }))
    .sort((a, b) => a.info.order - b.info.order)

  const enabled = new Set<string>()
  const steps: AssemblyStep[] = []
  const claimed = new Set<string>()

  for (const { id, info } of leaders) {
    const adds = [id, ...(info.with ?? [])].filter((x) => present.has(x) && !claimed.has(x))
    if (adds.length === 0) continue
    for (const a of adds) {
      claimed.add(a)
      enabled.add(a)
    }
    steps.push({
      id,
      title: info.title,
      what: info.what,
      expect: info.expect,
      adds,
      enabled: new Set(enabled),
      probe: probeFor(enabled, netlist),
    })
  }

  // Anything the table does not know about still has to reach the board, or the
  // finished walkthrough would not match the build. Fit it at the end.
  const leftovers = netlist.elements.filter((e) => !claimed.has(e.id)).map((e) => e.id)
  if (leftovers.length > 0) {
    for (const l of leftovers) enabled.add(l)
    steps.push({
      id: 'rest',
      title: 'The remaining parts',
      what: 'The parts of this build the walkthrough has no note for. They are on the board now, and the microphone is complete.',
      expect: 'Whatever they do, the graph is now showing it.',
      adds: leftovers,
      enabled: new Set(enabled),
      probe: probeFor(enabled, netlist),
    })
  }

  return steps
}

function probeFor(
  enabled: Set<string>,
  netlist: ReturnType<typeof buildCircuit>['netlist'],
): [string, string] {
  // Follow the signal outwards from the capsule through the parts fitted so
  // far, never through ground. A drain resistor makes the drain node *exist*,
  // but until the transistor is in there is nothing for the capsule to reach it
  // by — and clipping a probe there would show silence and look like a fault.
  const byId = new Map(netlist.elements.map((e) => [e.id, e]))
  const adjacency = new Map<number, number[]>()
  const link = (nodes: number[]) => {
    for (const a of nodes) {
      for (const b of nodes) {
        if (a === b) continue
        adjacency.set(a, [...(adjacency.get(a) ?? []), b])
      }
    }
  }
  for (const id of enabled) {
    const el = byId.get(id)
    if (!el) continue
    if (el.kind === 'VCVS' || el.kind === 'VCCS') {
      // A dependent source carries signal from its control nodes to its output
      // ones, but not back — still, for finding a probe point, forwards is what
      // matters, and treating it as a link is enough.
      link(el.nodes.filter((n) => n !== 0))
      continue
    }
    if (el.kind === 'K' && el.refs) {
      // A transformer passes signal with no wire between the two sides at all,
      // so the coupling element is what joins them.
      const a = byId.get(el.refs[0])
      const b = byId.get(el.refs[1])
      if (a && b) link([...a.nodes, ...b.nodes].filter((n) => n !== 0))
      continue
    }
    link(el.nodes.filter((n) => n !== 0))
  }

  const start = netlist.nodeNames['dia'] ?? netlist.nodeNames['gate']
  const reached = new Set<number>()
  const queue = start !== undefined ? [start] : []
  while (queue.length > 0) {
    const n = queue.shift()!
    if (reached.has(n)) continue
    reached.add(n)
    for (const next of adjacency.get(n) ?? []) if (!reached.has(next)) queue.push(next)
  }

  for (const pair of PROBE_POINTS) {
    const plus = netlist.nodeNames[pair[0]]
    const minus = pair[1] === 'gnd' ? 0 : netlist.nodeNames[pair[1]]
    if (plus === undefined || minus === undefined) continue
    if (reached.has(plus) && (minus === 0 || reached.has(minus))) return pair
  }
  return ['dia', 'gnd']
}
