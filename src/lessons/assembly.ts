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
    what: 'Two thin metal plates with a gap between them, about a hundredth of a millimetre wide. One is a film stretched like a drum skin, light enough that sound can push it about — the diaphragm. The other is a solid disc drilled with holes — the backplate.\n\nTwo plates with a gap is a capacitor: a component that can hold a quantity of electrical charge, and where the size of the gap decides how much it holds. So when sound moves the diaphragm, it changes the gap, and changing the gap changes how much charge the capsule can hold.\n\nThat is the whole trick, and it is the entire transducer — the part that turns sound into electricity. Everything else in the microphone exists to read it without spoiling it.',
    expect:
      'Nothing at all. Press play and you will hear silence, and the numbers will say there is no output. A capacitor with no charge on it produces no signal, however hard you shout at it — the gap is changing, but there is nothing there to change. That is not a fault. It is the whole reason the next part exists.',
    with: ['capsule.E', 'pol.backGnd'],
  },
  'capsule.E': { order: 10, title: '', what: '', expect: '', silent: true },
  'pol.backGnd': { order: 10, title: '', what: '', expect: '', silent: true },

  // ----------------------------------------------------------- polarisation
  'pol.V': {
    order: 20,
    title: 'The polarisation supply',
    what: 'Sixty volts of DC — a steady, unwavering voltage, made inside the microphone from the phantom power the preamp sends up the cable. Its job is to put a fixed quantity of charge onto the capsule and leave it there.\n\nHere is why that turns the capsule into a microphone. Charge, voltage and capacitance are tied together: if the charge stays the same and the capacitance changes, the voltage has to change to make up for it. Sound moves the diaphragm, that changes the capacitance, and the voltage across the capsule moves in step. That moving voltage is the signal.\n\nIt is fitted along with the gigaohm resistor that feeds the charge in — an enormous resistance, for reasons that become clear shortly — and, on a board that charges the backplate, the capacitor that keeps that backplate steady. All three do one job between them: put the charge on, then get out of the way.',
    expect:
      'The microphone comes alive. There is an output now, and its shape is the capsule’s own doing: even through the middle, rising towards the top where the stretched diaphragm has a resonance of its own.',
    with: ['pol.R_pol', 'pol.C_bypass'],
  },
  'pol.R_pol': {
    order: 21,
    title: 'The polarisation resistor',
    what: 'One gigaohm — a thousand million ohms, and physically the strangest component in the microphone. It has a contradictory job: pass electricity slowly enough to charge the capsule, and pass none at all at the speed sound wiggles, because any charge that escapes through it while a sound is happening is signal you never hear.',
    expect:
      'Together with the capsule it forms a high-pass filter — something that lets high notes through and holds back low ones. At a gigaohm its corner is far below anything you can hear. Make it smaller later and watch the bass leave.',
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
    what: 'The diaphragm is now sitting at 60 volts, and the transistor that comes next needs its input to be near zero or it will not work. A capacitor solves this exactly: it cannot pass a steady voltage — the gap is in the way — but it passes a wobbling one perfectly well. So the 60 volts stops here and the audio carries on.',
    expect:
      'Almost nothing, which is the idea. It does add a second high-pass corner, but far below anything audible. It also shares the signal with the capsule in proportion to their sizes, so it wants to be much the larger of the two: 1 nF against the capsule’s 55 pF costs about half a decibel, but shrink it to 100 pF and you throw away nearly four.',
  },

  // -------------------------------------------------------------- converter
  'conv.V_dd': {
    order: 30,
    title: 'The supply rail',
    what: 'Twelve volts, again taken from the phantom power on the cable, to run the transistor that is about to arrive. Note how little a microphone asks for: less than a thousandth of an amp.',
    expect:
      'Nothing yet, because nothing is connected to it. This is one of those steps where the honest answer is that you are getting ready for the next part.',
    with: ['conv.R_d'],
  },
  'conv.R_d': {
    order: 31,
    title: 'The drain resistor',
    what: 'The transistor is about to turn the sound into a varying current. This resistor is what turns that current back into a voltage — which is where the gain comes from.',
    expect: 'Still nothing audible. The transistor is next.',
    silent: true,
  },
  'conv.R_gate': {
    order: 33,
    title: 'The gate resistor',
    what: 'Another gigaohm. The transistor’s control leg — its gate — needs to sit at a known voltage rather than drifting wherever it likes, and this resistor is what holds it there. It has to be enormous for the same reason the last one did: anything smaller would quietly drain the signal away before the transistor got a look at it.',
    expect:
      'It adds a corner of its own at the low end, working against the capsule. On a board that charges the backplate rather than the diaphragm, this resistor — not the polarisation one — is what decides how much bass the microphone has.',
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
    what: 'The reason the microphone works at all. The capsule can produce a voltage, but it can supply almost no electricity behind it — connect anything ordinary and the signal collapses to nothing, the way a whisper does if you talk over it.\n\nA JFET is a transistor whose control leg draws practically no electricity: picoamps, which is a millionth of a millionth of an amp. So it can watch the capsule’s voltage without disturbing it, and produce a copy of it somewhere that can actually drive a cable. That job has a name — impedance conversion — and it is what the inside of every condenser microphone is mostly for.\n\nIt arrives with its source resistor, because a transistor with nowhere for its current to go is not a circuit.',
    expect:
      'A big jump in level — and a loss you did not ask for. The transistor’s own legs behave a little like a small capacitor sitting across the capsule, and that quietly takes a few decibels off the signal before anything has amplified it.',
    with: ['conv.R_s'],
  },
  'conv.R_s': {
    order: 36,
    title: 'The source resistor',
    what: 'Sets the bias — the steady conditions the transistor sits at between sounds. Current flowing through this resistor lifts one leg of the transistor above the other by exactly the amount it wants, so the circuit arranges its own working point and keeps arranging it even though no two JFETs are alike.',
    expect: '',
    silent: true,
  },
  'conv.C_s': {
    order: 38,
    title: 'The source bypass capacitor',
    what: 'The source resistor is doing something helpful and something annoying at the same time. Helpful: when the current rises, the voltage across it rises too and pushes the current back down, which keeps everything steady. That is negative feedback. Annoying: it does the same thing to the signal, so most of the gain disappears.\n\nA capacitor fixes it. Put one across the resistor and it bypasses the resistor for the wobbling signal while leaving it in place for the steady conditions. The steadiness stays; the gain comes back.',
    expect:
      'A large jump in level. Its corner with the source resistor decides from which frequency upwards that gain arrives — make it too small and you have accidentally designed a microphone with no bass.',
  },
  'conv.C_stray': {
    order: 39,
    title: 'Stray capacitance (you did not fit this)',
    what: 'Nobody solders this on. Any two pieces of metal near each other behave a little like a capacitor, so the track on the board, the solder joint, the transistor’s legs and whatever moisture is in the air all add up to a small unwanted capacitor sitting right across the capsule.\n\nAnd because the capsule is itself so tiny — 55 pF — even a few pF of accidental company is enough to share the signal and take a piece of it.',
    expect:
      'A few tenths of a decibel gone, evenly, at every frequency. It never comes back: the hiss that comes afterwards is unchanged, so this is signal thrown away for nothing. It is why the transistor sits millimetres from the capsule, and why that little track is kept as short as it possibly can be.',
  },
  'conv.R_fb': {
    order: 41,
    title: 'The de-emphasis network',
    what: 'This capsule is bright — it has more top end than most people want. Two components take it back off.\n\nA capacitor passes high notes more easily than low ones. So a resistor and a capacitor together, wired from the transistor’s output back towards its input, do almost nothing at the bottom and progressively rob the circuit of gain towards the top. The result is a gentle lid on the treble, in exactly the region the capsule was overdoing it.\n\nWhere it connects back to matters enormously, and the answer is a low-impedance point rather than the gate. Attach a resistor to that hundred-megohm gate and you have wired a hiss generator directly to the most sensitive spot in the microphone.',
    expect:
      'The top end comes down. This pair of components is the single difference between a U87-style board and a U47-style one, with exactly the same capsule in front of both.',
    with: ['conv.C_fb'],
  },
  'conv.C_fb': { order: 41, title: '', what: '', expect: '', silent: true },

  // ----------------------------------------------------------------- output
  'out.drv': {
    order: 50,
    title: 'The driver stage',
    what: 'A stage that adds no gain at all and simply repeats the signal with more electrical muscle behind it. It sits between the transistor and the transformer, and it looks like the sort of thing you could leave out to save a component.\n\nIt is the difference between a microphone with bass and one without, for a reason the next two steps make visible.',
    expect:
      'Nothing audible yet. When the transformer goes in, switch this between “buffered” and “straight from the drain” in free build and listen to the bottom end disappear.',
  },
  'out.C_out': {
    order: 52,
    title: 'The output coupling capacitor',
    what: 'Blocks the steady voltage from reaching whatever comes next, and lets the signal through. On a transformer board this matters more than it looks: a steady current through a transformer’s winding magnetises its iron core and stops it working properly.',
    expect: 'The last high-pass in the microphone, working against whatever follows it.',
  },
  'out.L_p': {
    order: 54,
    title: 'The output transformer',
    what: 'Two coils of wire wound on the same lump of iron. A changing signal in the first coil makes the iron magnetic, and the changing magnetism makes the same signal appear in the second — with no wire joining them anywhere. That electrical separation is worth a great deal: nothing on the cable can find its way back into the microphone.\n\nThe price is level. If the first coil has seven turns for every one on the second, you get a seventh of the voltage out. In exchange the microphone looks much easier to drive, and the output is balanced.\n\nOne part to solder, six things in the model: the two coils, the resistance of their copper, how tightly they share their magnetism, and the capacitance between neighbouring turns of wire.',
    expect:
      'The level drops by about 17 dB on a 7:1 — real, and you make it up at the preamp. Watch the bottom octave too: the coil and the capacitor before it push each other into a gentle lift down there, which is part of why transformer microphones get described as sounding big.',
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
    what: 'Two devices producing the same signal, one of them upside down. That is all “balanced” means: send the signal twice, once inverted, and the preamp at the far end subtracts one from the other.\n\nThe useful part is what happens to interference. A hum picked up along thirty metres of cable lands on both wires equally, so when the preamp subtracts them it vanishes — while the signal, which is opposite on the two wires, doubles.',
    expect:
      'A balanced output without a transformer: cheaper, lighter and flatter. What you give up is the electrical separation, because the microphone’s ground and the preamp’s ground are now joined by a wire. Every ground-loop problem in the fault panel follows from that.',
    with: ['out.En'],
  },
  'out.En': { order: 55, title: '', what: '', expect: '', silent: true },
  'out.C_outp': {
    order: 56,
    title: 'The output coupling capacitors',
    what: 'One on each of the two wires, blocking the steady voltage the stage before them sits at. The signal has to pass through both of them on its way round the loop, so the pair together behaves like a single capacitor of half the size.',
    expect:
      'The last high-pass in the microphone. Into a 1.5 kΩ preamp, 47 µF each corners around 4 Hz; 4.7 µF each would corner at 43 Hz and you would certainly hear it.',
    with: ['out.C_outn'],
  },
  'out.C_outn': { order: 56, title: '', what: '', expect: '', silent: true },
  'out.R_outp': {
    order: 57,
    title: 'The build-out resistors',
    what: 'Small resistors in line with each wire. They protect the parts behind them, help keep radio frequencies out, and set how “stiff” the microphone’s output is — the 50 to 200 ohms a studio input expects to find.',
    expect:
      'Almost nothing on the graph, which is the point. They also set how well the two legs are matched, and that decides how much of a ground loop you hear.',
    with: ['out.R_outn'],
  },
  'out.R_outn': { order: 57, title: '', what: '', expect: '', silent: true },
  'out.R_out': {
    order: 57,
    title: 'The output resistor',
    what: 'The output resistance of an unbalanced connection — one signal wire and the shield as the return, which is what a small electret capsule module gives you.',
    expect:
      'It works, and over a short cable in a quiet room it works well. Switch on a ground loop later and compare it with the balanced output: that comparison is the whole argument for balanced lines.',
    with: ['out.gndLeg'],
  },
  'out.gndLeg': { order: 57, title: '', what: '', expect: '', silent: true },

  // ------------------------------------------------------------------- load
  'load.R_preamp': {
    order: 70,
    title: 'The cable and the preamp',
    what: 'Not part of the microphone, and completely part of how it sounds. Every metre of cable adds a little unwanted capacitance between each signal wire and the shield around them, and the preamp at the far end is itself a load the microphone has to drive.',
    expect:
      'On a transformerless output the preamp works against the output capacitors and moves the bass corner — so the same microphone genuinely has a slightly different response on different preamps. On a transformer output it does something quite different: it damps the transformer instead.',
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
    what: 'Two tiny capacitors from the output pins to the metal shell of the connector. A microphone cable makes an excellent radio aerial, and radio itself is far too fast to hear — so it ought to be harmless.\n\nIt is not, because a transistor is accidentally a rectifier: it passes electricity more easily one way than the other, and that turns an inaudible radio signal into an audible buzz. These two capacitors give the radio an easy path to the shield before it can reach anything that would do that to it.',
    expect:
      'Nothing whatsoever in the audible range — that is the entire idea. Leave them out and switch on the “missing RF caps” fault in free build to hear what they were buying you.',
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
