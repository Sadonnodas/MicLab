import type { BuildStage } from '../solver/netlist'
import { withDefaults, type BuildSpec } from '../stages/build'

/**
 * The lesson track: thirteen lessons, each running Concept → Listen → Explore →
 * Quiz, following the signal path from the diaphragm to the preamp.
 *
 * A "Listen" step is two builds and a question about the difference. An
 * "Explore" step unlocks a set of controls and lets the explanation panel do the
 * talking. The quiz mixes conceptual questions with predict-the-sound ones.
 */

export interface QuizQuestion {
  id: string
  /** 'concept' asks about the idea; 'listen' asks you to identify a sound. */
  kind: 'concept' | 'listen'
  question: string
  options: string[]
  answer: number
  explain: string
  /** For 'listen' questions: the two builds to compare, A and B. */
  clips?: { a: Partial<Mutation>; b: Partial<Mutation> }
}

/** A change applied to the current build, used for Listen demos and quizzes. */
export interface Mutation {
  label: string
  stage: BuildStage
  variant?: string
  values?: Record<string, number | string>
  faults?: string[]
}

export interface Lesson {
  n: number
  title: string
  /** One line for the lesson list. */
  blurb: string
  /** The Concept screen: a few short paragraphs. */
  concept: string[]
  /** The single physical idea, shown as a pull-quote. */
  key: string
  /** The Listen step: two versions of the current build to A/B. */
  listen: { prompt: string; a: Mutation; b: Mutation }
  /** Which stage the Explore step opens on, and which controls it unlocks. */
  explore: { stage: BuildStage; prompt: string }
  quiz: QuizQuestion[]
  /** A preset to start the lesson from, if the default build will not do. */
  preset?: string
}

const cap = (values: Record<string, number | string>, label: string): Mutation => ({
  label,
  stage: 'capsule',
  values,
})
const pol = (values: Record<string, number | string>, label: string): Mutation => ({
  label,
  stage: 'polarisation',
  values,
})
const conv = (values: Record<string, number | string>, label: string): Mutation => ({
  label,
  stage: 'converter',
  values,
})
const out = (values: Record<string, number | string>, label: string): Mutation => ({
  label,
  stage: 'output',
  values,
})
const load = (values: Record<string, number | string>, label: string): Mutation => ({
  label,
  stage: 'load',
  values,
})

export const LESSONS: Lesson[] = [
  {
    n: 1,
    title: 'The capsule is a capacitor',
    blurb: 'Two plates, a gap, and sound moving one of them.',
    key: 'A condenser capsule is a capacitor whose capacitance changes when sound hits it. Nothing electrical has happened yet.',
    concept: [
      'Take two metal plates a few tens of microns apart. One of them — the diaphragm — is a stretched membrane about five microns thick, gold-sputtered mylar in a large-diaphragm capsule. The other, the backplate, is solid and drilled with a pattern of holes. That is the whole transducer.',
      'Sound is a pressure wave. When it arrives, it pushes the diaphragm a little closer to the backplate and then lets it spring back. The gap changes by an almost unbelievably small amount — for normal speech, a fraction of the diameter of a hydrogen atom — and the capacitance changes in proportion.',
      'A stretched membrane is a mass on a spring, so it has a resonance. Below that resonance it follows the pressure faithfully. At it, it exaggerates. Above it, it cannot keep up and the response falls away at 12 dB per octave. Where that resonance sits, and how heavily the air trapped in the backplate holes damps it, is most of what makes one capsule sound different from another.',
      'Notice what has *not* happened: no voltage, no current, no signal. A changing capacitance is not electricity. Turning it into electricity is the next lesson, and it is the reason condenser microphones need power at all.',
    ],
    listen: {
      prompt:
        'Same electronics, two diaphragm resonances. One rings at 9 kHz like a large-diaphragm capsule; one at 14 kHz like a small one. Which sounds "bigger"?',
      a: cap({ fres: 9000, Qres: 1.5 }, 'Resonance at 9 kHz (large diaphragm)'),
      b: cap({ fres: 14000, Qres: 1.0 }, 'Resonance at 14 kHz (small diaphragm)'),
    },
    explore: {
      stage: 'capsule',
      prompt:
        'Move the resonance and the presence bump around. Watch the top of the response curve follow. Nothing after the capsule has changed.',
    },
    quiz: [
      {
        id: 'l1q1',
        kind: 'concept',
        question: 'A sound wave arrives at the capsule. What changes?',
        options: [
          'The capacitance between diaphragm and backplate',
          'The voltage across the capsule, directly',
          'The current flowing through the capsule',
          'The resistance of the diaphragm',
        ],
        answer: 0,
        explain:
          'Sound moves the diaphragm, which changes the gap, which changes the capacitance. Everything electrical comes later.',
      },
      {
        id: 'l1q2',
        kind: 'concept',
        question: 'Above its resonance, a diaphragm’s response falls at:',
        options: ['6 dB per octave', '12 dB per octave', '3 dB per octave', 'It does not fall'],
        answer: 1,
        explain:
          'A resonance is a second-order system: two poles, so 12 dB per octave above it. That is why capsule designers put the resonance at the top of the audio band rather than above it — you want to use the peak, not fight the roll-off.',
      },
      {
        id: 'l1q3',
        kind: 'listen',
        question: 'Which of these two has its diaphragm resonance at 14 kHz?',
        options: ['Clip A', 'Clip B'],
        answer: 1,
        explain:
          'The higher resonance pushes the top-end lift up and out, so the sound is more even through the presence region and airier above it. That is a small-diaphragm capsule.',
        clips: {
          a: cap({ fres: 9000 }, 'A'),
          b: cap({ fres: 14000 }, 'B'),
        },
      },
    ],
  },
  {
    n: 2,
    title: 'Charging the capsule',
    blurb: 'Q = C·V, and why the voltage is the signal.',
    key: 'Hold the charge constant and let the capacitance move: the voltage has to move with it. That voltage is the signal.',
    concept: [
      'Put a fixed charge Q on a capacitor. The voltage across it is V = Q/C. Now change C — which is exactly what sound does — while holding Q still. V has to change to compensate. That changing voltage is the microphone’s output.',
      'The word "polarisation" just means putting that charge there. A true condenser does it with a DC supply of 40 to 65 volts, fed through a resistor so large that the charge cannot escape in the time one cycle of audio takes. An electret capsule does it at the factory, with a charge trapped permanently in a plastic film.',
      'Because the signal voltage is proportional to Q, and Q is proportional to the polarisation voltage, sensitivity scales directly with polarisation voltage. Double the volts and you double the output. The noise does not change, so that is a straight 6 dB of signal-to-noise for free — which is why microphone designers use as much voltage as the capsule will tolerate before the diaphragm is pulled too hard towards the backplate.',
    ],
    listen: {
      prompt: 'Same microphone, 60 V and 30 V of polarisation. Listen to the level, then to the hiss.',
      a: pol({ V_pol: 60 }, '60 V polarisation'),
      b: pol({ V_pol: 30 }, '30 V polarisation'),
    },
    explore: {
      stage: 'polarisation',
      prompt:
        'Sweep the polarisation voltage and watch the sensitivity figure. Then watch the self-noise figure, and notice it does not move.',
    },
    quiz: [
      {
        id: 'l2q1',
        kind: 'concept',
        question: 'Halving the polarisation voltage does what to the output?',
        options: ['Halves it (−6 dB)', 'Quarters it (−12 dB)', 'Leaves it alone', 'Doubles it'],
        answer: 0,
        explain: 'Q = C·V, and the signal is proportional to Q. Half the volts, half the signal.',
      },
      {
        id: 'l2q2',
        kind: 'concept',
        question: 'Halving the polarisation voltage does what to the self-noise in dB-A?',
        options: [
          'Leaves the electrical noise unchanged, so the noise *relative to the signal* gets 6 dB worse',
          'Halves it too, so nothing changes',
          'Doubles it',
          'Nothing at all changes',
        ],
        answer: 0,
        explain:
          'The resistors and the FET hiss the same amount regardless. Halving the signal while the noise stays put costs you 6 dB of signal-to-noise — which, expressed as equivalent input noise, is 6 dB more dB-A.',
      },
      {
        id: 'l2q3',
        kind: 'concept',
        question: 'Why does an electret microphone still need power?',
        options: [
          'For the impedance converter, not the capsule',
          'To top up the electret charge, which leaks away',
          'To polarise the capsule, like any condenser',
          'It does not — electret microphones are passive',
        ],
        answer: 0,
        explain:
          'The capsule is already charged for life. The FET that reads it is not. Plug-in power exists precisely because a FET needs only a few volts while a true condenser needs sixty.',
      },
    ],
  },
  {
    n: 3,
    title: 'Why a gigaohm',
    blurb: 'The resistor that has to be almost not there.',
    key: 'R·C sets a corner. With 55 pF, only a gigaohm puts that corner below the lowest note.',
    concept: [
      'The polarisation resistor has a contradictory job: pass DC to charge the capsule, and pass nothing at all at audio frequencies. Any charge that escapes through it during a cycle of sound is signal you never hear.',
      'It is a high-pass filter, and its corner is 1/(2π·R·C). The capacitance is the capsule’s own — about 55 picofarads. To put the corner at 3 Hz you need a gigaohm. To put it at 30 Hz, a hundred megohms, and now your microphone has no bass.',
      'Watch the read-out beside the slider, though, because it does not agree with that arithmetic — and it is right and the arithmetic is wrong. The formula assumes the capsule is the only capacitance at that node. It is not: the coupling capacitor, and through it the FET’s gate capacitance, hang off the same node and add to it. More capacitance at the same resistance means a lower corner, and here that is a factor of four or five. The app shows the corner the solver measured rather than the one on the back of the envelope. This is the general lesson about circuit arithmetic: the formula tells you which way things move, and the circuit tells you how far.',
      'A gigaohm is an unusual component. It is physically large, it costs real money, and it is beaten by a fingerprint: the surface resistance of a dirty PCB can easily be lower than the resistor bridging it. This is why microphone boards are washed, why some are conformally coated, and why humidity changes how a badly-built microphone sounds.',
    ],
    listen: {
      prompt:
        'One gigaohm against ten megohms — a badly contaminated board. Listen to the bottom of the guitar.',
      a: pol({ R_pol: 1e9 }, '1 GΩ — clean board'),
      b: pol({ R_pol: 10e6 }, '10 MΩ — filthy board'),
    },
    explore: {
      stage: 'polarisation',
      prompt:
        'Drag the polarisation resistor and watch the corner frequency next to the slider. Then change the capsule capacitance and watch the same corner move — it takes two to make an RC.',
    },
    quiz: [
      {
        id: 'l3q1',
        kind: 'concept',
        question: 'With a 55 pF capsule, what corner frequency does a 1 GΩ polarisation resistor give?',
        options: ['About 2.9 Hz', 'About 29 Hz', 'About 0.29 Hz', 'About 290 Hz'],
        answer: 0,
        explain:
          '1/(2π × 10⁹ × 55×10⁻¹²) ≈ 2.9 Hz. Comfortably below anything you would want to record — and the real circuit does better still, because the coupling network adds capacitance at the same node and pushes the corner lower.',
      },
      {
        id: 'l3q2',
        kind: 'concept',
        question: 'You swap in a capsule with twice the capacitance and keep the same resistor. The corner:',
        options: ['Halves', 'Doubles', 'Stays the same', 'Quadruples'],
        answer: 0,
        explain: 'The corner is 1/(2πRC). Twice the C, half the corner frequency.',
      },
      {
        id: 'l3q3',
        kind: 'listen',
        question: 'Which clip has the 10 MΩ polarisation resistor?',
        options: ['Clip A', 'Clip B'],
        answer: 1,
        explain:
          'The corner moved to about 60 Hz, so the bottom of the guitar has gone — 11 dB down at 20 Hz and 5 dB at 40. It also hisses about 12 dB more, which is the subject of the next lesson and not the way round most people expect.',
        clips: { a: pol({ R_pol: 1e9 }, 'A'), b: pol({ R_pol: 10e6 }, 'B') },
      },
    ],
  },
  {
    n: 4,
    title: 'Thermal noise, and why the huge resistor is quiet',
    blurb: 'Every resistor hisses. The big one hisses least, where it matters.',
    key: 'A bigger resistor makes more noise voltage — but the capsule shorts that noise out above the corner, and the bigger the resistor, the lower the corner.',
    concept: [
      'Every resistor generates noise, because the charge carriers inside it are jiggling at whatever temperature it happens to be. The noise voltage is √(4kTR·Δf): more resistance, more noise voltage. So a gigaohm should be a hundred times noisier than a hundred megohms — 20 dB worse.',
      'It is not, and here is why. The resistor sits in parallel with the capsule. Think of the resistor as a *current* noise source instead: its noise current is √(4kT/R·Δf), which gets *smaller* as the resistance goes up. That current flows into whatever impedance is at the node, and above the corner frequency the capsule’s impedance is much lower than the resistor’s, so the capsule shorts most of the noise out.',
      'Put the two together and the noise you actually hear, in the band you actually care about, goes *down* as the resistor gets bigger. The 1 GΩ resistor contributes 3.0 dB-A to this microphone. Swap it for 100 MΩ and it jumps to 13.0 dB-A — two thirds of the total noise power, and now the dominant source — while also stealing your bass. Bigger is quieter. This is genuinely counter-intuitive and it is one of the nicest results in microphone design.',
    ],
    listen: {
      prompt:
        'The same two resistors as the last lesson, but this time turn the music off and listen to the noise floor alone.',
      a: pol({ R_pol: 1e9 }, '1 GΩ — quiet'),
      b: pol({ R_pol: 100e6 }, '100 MΩ — hissy'),
    },
    explore: {
      stage: 'polarisation',
      prompt:
        'Open the Noise tab and drag the polarisation resistor. Watch the breakdown: at a gigaohm the capsule dominates, and by a hundred megohms the resistor has taken over.',
    },
    quiz: [
      {
        id: 'l4q1',
        kind: 'concept',
        question: 'Increasing the polarisation resistor from 100 MΩ to 1 GΩ makes the microphone:',
        options: ['Quieter', 'Noisier', 'Exactly as noisy', 'Noisier only above 1 kHz'],
        answer: 0,
        explain:
          'Seen as a current source, a bigger resistor injects less noise current, and the capsule shunts what is left. Both effects go the same way.',
      },
      {
        id: 'l4q2',
        kind: 'concept',
        question: 'In a well-built large-diaphragm condenser, the largest single noise source is usually:',
        options: [
          'The capsule’s own acoustic noise',
          'The FET’s channel noise',
          'The polarisation resistor',
          'The output transformer',
        ],
        answer: 0,
        explain:
          'The air molecules bouncing off the diaphragm, and the air being squeezed through the backplate holes, are themselves a noise source. In a good build it beats all the electronics put together — which is why chasing an exotic FET rarely buys what people hope.',
      },
      {
        id: 'l4q3',
        kind: 'concept',
        question: 'A resistor’s noise voltage in a bandwidth Δf is:',
        options: ['√(4kTR·Δf)', '4kTR·Δf', '√(4kT/R·Δf)', 'Independent of temperature'],
        answer: 0,
        explain:
          'That is the Johnson–Nyquist result. The current form, √(4kT/R·Δf), is the same statement seen from the other side, and it is the more useful one when a capacitor is sitting across the resistor.',
      },
    ],
  },
  {
    n: 5,
    title: 'Stray capacitance',
    blurb: 'Every picofarad next to the gate is signal you will never get back.',
    key: 'The capsule’s 55 pF and everything in parallel with it form a divider. What it takes, it takes evenly, and the noise afterwards does not shrink with it.',
    concept: [
      'The capsule is a capacitive source. Any other capacitance at the same node — the gate lead, the pad it is soldered to, the FET’s own input capacitance, moisture on the board — sits in parallel with it and forms a divider: C_caps/(C_caps + C_stray).',
      'The numbers are brutal because the capsule is so small. Five picofarads of stray against 55 pF costs 0.75 dB. Forty picofarads costs 4.5 dB. And this is not like a resistor loss you can make up later: the noise that follows the divider is unchanged, so every decibel you lose here is a decibel of signal-to-noise gone permanently.',
      'That is why the FET sits millimetres from the capsule instead of on a comfortable board elsewhere, why the gate track is as short as the layout allows, why good boards have a guard ring around the gate node, and why touching the inside of a microphone with a bare finger is a bad habit.',
      'It is also worth noticing which FET you chose: a 2SK170 has 30 pF of gate capacitance all by itself, before any wiring. A 2N3819 has four. The quietest transistor is not automatically the quietest microphone.',
    ],
    listen: {
      prompt: 'Five picofarads of stray capacitance against forty. Same everything else.',
      a: conv({ C_stray: 5e-12 }, '5 pF stray'),
      b: conv({ C_stray: 40e-12 }, '40 pF stray'),
    },
    explore: {
      stage: 'converter',
      prompt:
        'Drag the stray capacitance and watch the loss figure. Then switch the FET between a 2SK170 and a 2N3819 and watch the same number move — the transistor’s own capacitance is stray capacitance too.',
    },
    quiz: [
      {
        id: 'l5q1',
        kind: 'concept',
        question: 'A 55 pF capsule with 55 pF of stray capacitance loses:',
        options: ['6 dB', '3 dB', '12 dB', 'Nothing — capacitors in parallel add'],
        answer: 0,
        explain: 'The divider is 55/(55+55) = 0.5, which is −6 dB. Half your microphone, given away to layout.',
      },
      {
        id: 'l5q2',
        kind: 'concept',
        question: 'Why can’t you make up a stray-capacitance loss with more gain later?',
        options: [
          'You can make up the level, but the noise after the divider is amplified equally, so the signal-to-noise never comes back',
          'You can — it makes no difference where the gain is',
          'Because gain stages cannot be added after a FET',
          'Because it is a frequency-dependent loss',
        ],
        answer: 0,
        explain:
          'Losses before the first amplifier are the expensive ones. Everything after them amplifies signal and noise together.',
      },
      {
        id: 'l5q3',
        kind: 'listen',
        question: 'Which clip has 40 pF of stray capacitance?',
        options: ['Clip A', 'Clip B'],
        answer: 1,
        explain:
          'Quieter and, because the extra capacitance also loads the top slightly, a shade duller. Mostly it is just *less microphone*.',
        clips: { a: conv({ C_stray: 5e-12 }, 'A'), b: conv({ C_stray: 40e-12 }, 'B') },
      },
    ],
  },
  {
    n: 6,
    title: 'The impedance converter',
    blurb: 'What a JFET actually does, and where it has to sit to do it.',
    key: 'The capsule has volts but no current. The FET copies the voltage onto a node that can drive something.',
    concept: [
      'At 20 Hz a 55 pF capsule is a 145 megohm source. There is nothing you can plug that into. A preamp input, a metre of cable, even a moderately good op-amp would load it into silence.',
      'A JFET’s gate is a reverse-biased junction: it draws picoamps. So it can sit and watch that voltage without disturbing it, and reproduce it as a drain current — which, across a resistor, becomes a voltage at a few kilohms instead of a few hundred megohms. That transformation, from an impossible impedance to a workable one, is the entire purpose of the electronics inside a condenser microphone.',
      'For the FET to do that it has to be *biased*: sitting at a drain current where it is sensitive, in the saturation region, with room to swing in both directions. The classic trick is self-bias — put a resistor in the source leg, and the drain current flowing through it makes the source positive relative to the gate, which is exactly the negative gate-source voltage an n-channel JFET wants. It sets its own operating point, and it does so despite the enormous unit-to-unit spread of real JFETs.',
      'The Operating point tab shows where your FET landed: V_gs, V_ds, drain current, and the transconductance gm that follows from them. That is the number the next lesson turns into gain.',
    ],
    listen: {
      prompt:
        'A 2SK170, and then a 2N3819 in the same socket. Different pinch-off, different bias, different gain — and different gate capacitance loading the capsule.',
      a: conv({ jfet: '2SK170' }, '2SK170'),
      b: conv({ jfet: '2N3819' }, '2N3819'),
    },
    explore: {
      stage: 'converter',
      prompt:
        'Open the Operating point tab. Change the source resistor and watch V_gs, the drain current and gm move together. Then use the spread slider to simulate an off-centre transistor.',
    },
    quiz: [
      {
        id: 'l6q1',
        kind: 'concept',
        question: 'What makes a JFET suitable for reading a capsule?',
        options: [
          'Its gate draws almost no current, so it does not discharge the capsule',
          'It has very high voltage gain',
          'It is quieter than any other device',
          'It works without a power supply',
        ],
        answer: 0,
        explain:
          'A gate leakage of a few picoamps is what lets a hundred-megohm source survive being looked at. Gain is a bonus; not loading is the job.',
      },
      {
        id: 'l6q2',
        kind: 'concept',
        question: 'In a self-biased common-source stage, raising the source resistor:',
        options: [
          'Makes V_gs more negative and lowers the drain current',
          'Makes V_gs more positive and raises the drain current',
          'Has no effect on the bias',
          'Only changes the gain, not the bias',
        ],
        answer: 0,
        explain:
          'Drain current through the source resistor lifts the source above the gate, which *is* a negative V_gs. More resistance, more lift, less current — a self-correcting loop.',
      },
      {
        id: 'l6q3',
        kind: 'concept',
        question: 'Gate leakage current matters in a microphone because:',
        options: [
          'It flows through the gigaohm gate resistor and shifts the bias',
          'It discharges the capsule within seconds',
          'It makes the FET run hot',
          'It does not matter at all',
        ],
        answer: 0,
        explain:
          'A nanoamp through a gigaohm is a volt. Even ten picoamps is ten millivolts of unplanned bias — and the shot noise of that same leakage current flows straight into the highest-impedance node in the microphone.',
      },
    ],
  },
  {
    n: 7,
    title: 'Gain and the source resistor',
    blurb: 'Common-source or follower, and what the bypass capacitor really does.',
    key: 'Gain is gm·R_d — but only above the frequency where the bypass capacitor has finished shorting the source resistor.',
    concept: [
      'A common-source stage turns gate voltage into drain current (that is gm) and then back into voltage across the drain resistor. Gain is gm·R_d, and it is inverted. A source follower takes the output from the source instead, has a gain just under one, and gives you nothing but the ability to drive a load — which, as the last lesson argued, is the whole point.',
      'An unbypassed source resistor is negative feedback. When drain current rises, the source voltage rises with it, which reduces V_gs and pushes the current back down. That costs gain — a lot of it — and buys linearity and predictability in return. Gain becomes gm·R_d/(1 + gm·R_s), which barely depends on gm at all, and therefore barely depends on which transistor you happened to solder in.',
      'The bypass capacitor removes that feedback, but only above 1/(2π·R_s·C_s). Below that corner the stage reverts to its degenerated, low-gain behaviour. Undersize the bypass capacitor and you have accidentally designed a bass roll-off into your microphone — 100 µF across 1.5 kΩ corners at about 1 Hz, but 1 µF corners at 106 Hz, and you would hear that immediately.',
    ],
    listen: {
      prompt: 'A properly sized bypass capacitor, and one a hundred times too small.',
      a: conv({ C_s: 100e-6 }, '100 µF bypass'),
      b: conv({ C_s: 1e-6 }, '1 µF bypass'),
    },
    explore: {
      stage: 'converter',
      prompt:
        'Shrink the bypass capacitor and watch a bass roll-off appear out of nowhere. Then raise the drain resistor and watch the gain and the operating point argue with each other.',
    },
    quiz: [
      {
        id: 'l7q1',
        kind: 'concept',
        question: 'The gain of a fully bypassed common-source stage is approximately:',
        options: ['gm·R_d', 'gm/R_d', 'R_d/R_s', '1'],
        answer: 0,
        explain: 'Transconductance turns volts into amps; the drain resistor turns them back into volts.',
      },
      {
        id: 'l7q2',
        kind: 'concept',
        question: 'A source bypass capacitor that is too small produces:',
        options: [
          'A loss of gain at low frequencies',
          'A loss of gain at high frequencies',
          'More noise at all frequencies',
          'A shift in the DC bias',
        ],
        answer: 0,
        explain:
          'Below its corner with the source resistor it stops shorting, the degeneration comes back, and the gain drops. The DC bias is untouched — a capacitor is an open circuit at DC either way.',
      },
      {
        id: 'l7q3',
        kind: 'listen',
        question: 'Which clip has the undersized bypass capacitor?',
        options: ['Clip A', 'Clip B'],
        answer: 1,
        explain: 'The bottom end is noticeably lighter — a broad, gentle loss rather than a sharp cut, because the roll-off is only down to the degenerated gain, not to nothing.',
        clips: { a: conv({ C_s: 100e-6 }, 'A'), b: conv({ C_s: 1e-6 }, 'B') },
      },
    ],
  },
  {
    n: 8,
    title: 'De-emphasis: taming the K67 peak',
    blurb: 'Why Raven and Blue Jay do not sound the same with the same capsule.',
    key: 'Frequency-dependent feedback is an EQ you build out of a resistor and a capacitor, and it goes back to the low-impedance node.',
    concept: [
      'The K67 capsule has a broad lift around 7 kHz on top of its 9 kHz diaphragm resonance. On a U47 or U247-style board — Raven — nothing is done about it, and the microphone is bright and forward. On a U87-style board — Blue Jay — a resistor and a capacitor pull that lift back down, and the same capsule becomes a different microphone.',
      'The network is a resistor in series with a capacitor, from the drain back to the source. At low frequencies the capacitor is a large impedance and the network is not there. Above 1/(2π(R_fb+R_d)·C_fb) the capacitor stops mattering, the resistor ends up in parallel with the drain resistor, and the gain settles at a new, lower value. The result is a *shelf*, and a shelf is the right shape to cancel a broad capsule bump — a slope would not be.',
      'One detail matters more than it looks. The feedback returns to the source, which is a low-impedance node, not to the gate. Hang a 47 kΩ resistor off the gate and you have connected a thermal-noise generator to a hundred-megohm node: in this model the microphone gets about 25 dB noisier and loses most of its signal to the loading. Feedback always goes back to somewhere with a low impedance. Try it in the builder if you want to hear how bad it is.',
    ],
    preset: 'bluejay',
    listen: {
      prompt:
        'The de-emphasis network switched in and out — the difference between Blue Jay and Raven, with everything else held still.',
      a: conv({ R_fb: 6200, C_fb: 4.7e-9 }, 'De-emphasis on (Blue Jay)'),
      b: conv({ R_fb: 1e6, C_fb: 100e-12 }, 'De-emphasis effectively off (Raven)'),
    },
    explore: {
      stage: 'converter',
      prompt:
        'Match the shelf to the capsule: set the presence bump on the capsule, then chase it with the de-emphasis resistor and capacitor until the response is flat.',
    },
    quiz: [
      {
        id: 'l8q1',
        kind: 'concept',
        question: 'The de-emphasis network gives a shelf rather than a slope because:',
        options: [
          'Above its corner the capacitor is a short and the resistor sets a fixed amount of loss',
          'It is a second-order filter',
          'The capacitor value is very small',
          'The FET saturates at high frequencies',
        ],
        answer: 0,
        explain:
          'Once the capacitor stops being an impedance, nothing else changes with frequency, so the loss stops increasing. That plateau is the shelf.',
      },
      {
        id: 'l8q2',
        kind: 'concept',
        question: 'Why does the feedback return to the source rather than to the gate?',
        options: [
          'Because the gate is a very high-impedance node and the resistor’s noise would dominate there',
          'Because the gate has no DC path',
          'Because the phase would be wrong at the gate',
          'Because the source is closer on the PCB',
        ],
        answer: 0,
        explain:
          'Noise current from a feedback resistor at a hundred-megohm node is a disaster. At a kilohm node it is nothing. The same network in two places is the difference between a quiet microphone and an unusable one.',
      },
      {
        id: 'l8q3',
        kind: 'listen',
        question: 'Which clip is the U87-style board with de-emphasis?',
        options: ['Clip A', 'Clip B'],
        answer: 0,
        explain:
          'The presence region is calmer and sibilance is less pointed. The other one is the U247 approach: the capsule speaks for itself, which flatters some sources and exposes others.',
        clips: {
          a: conv({ R_fb: 6200, C_fb: 4.7e-9 }, 'A'),
          b: conv({ R_fb: 1e6, C_fb: 100e-12 }, 'B'),
        },
      },
    ],
  },
  {
    n: 9,
    title: 'Self-noise',
    blurb: 'Where the hiss comes from, and how to read a dB-A figure.',
    key: 'Self-noise is the sound pressure that would produce the same output as the microphone’s own noise. It is a number about *silence*.',
    concept: [
      'A microphone’s self-noise is quoted as an equivalent sound pressure level, A-weighted. A figure of 10 dB-A means: the noise this microphone makes on its own is as loud, to a human ear, as a real sound at 10 dB SPL would be. It is not a level at the output; it is a level referred back to the air, which is what makes it comparable between microphones of different sensitivities.',
      'The A-weighting curve is a rough model of how insensitive human hearing is at low levels, especially in the bass. It throws away most of what happens below 200 Hz — which is convenient, because that is where a microphone’s 1/f noise lives.',
      'Open the Noise tab and look at the breakdown. In a healthy large-diaphragm build the capsule’s own acoustic noise is the largest single contributor, the two gigaohm resistors come next, and the FET — the part everyone agonises over — is well down the list. Drop the polarisation resistor to a hundred megohms and the order changes completely.',
      'For reference: a Neumann TLM 103 is specified at 7 dB-A, a good DIY U87-style build lands around 10 to 14, and a cheap small-diaphragm electret is 18 to 24. Below about 6 dB-A you are fighting the air itself.',
    ],
    listen: {
      prompt:
        'A healthy build and a deliberately compromised one — a leaky polarisation resistor and a noisy FET. Turn the music off and just listen to the floor.',
      a: pol({ R_pol: 1e9 }, 'Healthy: 1 GΩ, 2SK170'),
      b: { label: 'Compromised: 50 MΩ, 2N3819', stage: 'polarisation', values: { R_pol: 50e6 } },
    },
    explore: {
      stage: 'polarisation',
      prompt:
        'Open the Noise tab. Change one thing at a time and watch which slice of the pie grows. Try the capsule’s acoustic noise figure last — it explains a lot.',
    },
    quiz: [
      {
        id: 'l9q1',
        kind: 'concept',
        question: 'A self-noise figure of 12 dB-A means:',
        options: [
          'The microphone’s own noise sounds like a real sound at 12 dB SPL',
          'The output noise is 12 dB below full scale',
          'The signal-to-noise ratio is 12 dB',
          'The microphone adds 12 dB of noise to the signal',
        ],
        answer: 0,
        explain:
          'It is an equivalent input level: the noise, referred back through the microphone’s own sensitivity to the pressure that would have caused it.',
      },
      {
        id: 'l9q2',
        kind: 'concept',
        question: 'A-weighting mostly discounts:',
        options: ['Low frequencies', 'High frequencies', 'The midrange', 'Nothing — it is flat'],
        answer: 0,
        explain:
          'It is a model of quiet-level hearing, which is poor in the bass. Handy, because that is where flicker noise is worst.',
      },
      {
        id: 'l9q3',
        kind: 'concept',
        question: 'In a good large-diaphragm build with a 1 GΩ polarisation resistor, the FET’s channel noise is:',
        options: [
          'Well below the capsule and the big resistors',
          'The dominant source',
          'Roughly equal to the capsule',
          'Zero',
        ],
        answer: 0,
        explain:
          'Chasing exotic transistors is usually the last thing that will help. Layout, cleanliness and the capsule itself matter more.',
      },
    ],
  },
  {
    n: 10,
    title: 'Transformer output',
    blurb: 'Coupled coils, and the corner that explains why driver stages exist.',
    key: 'A transformer divides voltage by n and impedance by n². Its primary inductance sits across the source, and that is what sets the bass.',
    concept: [
      'Two coils on a shared core. Whatever ratio of turns they have, the secondary gets 1/n of the voltage, n times the current, and presents 1/n² of the impedance. Seven to one is common in microphones: a seventeen-decibel level loss you make up in the preamp, in exchange for a balanced, galvanically isolated output and a source impedance the cable is happy with.',
      'The primary inductance is the interesting part. It sits directly across whatever is driving it, and its impedance is 2πfL — small at low frequencies. Below the frequency where it equals the source impedance, the primary is effectively a short and the bass disappears.',
      'Run the numbers: 20 H driven from a 100 Ω buffer corners at 0.8 Hz. The same transformer driven straight from a 4.7 kΩ drain corners at 37 Hz. That is the entire reason transformer output boards bother with a driver stage — try it with the "straight from the drain" option and listen.',
      'There is a second, subtler effect. The coupling capacitor and the primary inductance form a series resonance. With 10 µF and 20 H that lands near 11 Hz, damped only by the source and winding resistance, and it puts a gentle lift in the bottom octave. Transformer microphones are often described as sounding "big" at the bottom, and this is part of why.',
    ],
    preset: 'raven',
    listen: {
      prompt:
        'The same transformer, driven from a 100 Ω buffer and then straight from the 4.7 kΩ drain.',
      a: out({ R_drv: 100 }, 'Buffered (100 Ω)'),
      b: out({ R_drv: 4700 }, 'Straight from the drain (4.7 kΩ)'),
    },
    explore: {
      stage: 'output',
      prompt:
        'Change the turns ratio and watch the sensitivity fall by exactly 20·log₁₀(n). Then change the driver impedance and watch the bass corner move while the level does not.',
    },
    quiz: [
      {
        id: 'l10q1',
        kind: 'concept',
        question: 'A 10:1 transformer makes a 1.5 kΩ preamp look like what, to the primary?',
        options: ['150 kΩ', '15 kΩ', '15 Ω', '1.5 kΩ'],
        answer: 0,
        explain: 'Impedance transforms by the square of the turns ratio: 1.5 kΩ × 100.',
      },
      {
        id: 'l10q2',
        kind: 'concept',
        question: 'The transformer’s low-frequency corner is set by:',
        options: [
          'The primary inductance and the impedance driving it',
          'The turns ratio',
          'The winding capacitance',
          'The preamp’s input impedance alone',
        ],
        answer: 0,
        explain:
          'L_p across the source. That is why the same transformer corners at 0.8 Hz behind a buffer and 37 Hz behind a bare drain resistor.',
      },
      {
        id: 'l10q3',
        kind: 'listen',
        question: 'Which clip is the transformer driven straight from the drain?',
        options: ['Clip A', 'Clip B'],
        answer: 1,
        explain:
          'The bottom is gone — a 37 Hz corner takes the body out of everything. Adding one buffer stage is the cheapest bass in audio.',
        clips: { a: out({ R_drv: 100 }, 'A'), b: out({ R_drv: 4700 }, 'B') },
      },
    ],
  },
  {
    n: 11,
    title: 'Transformerless output',
    blurb: 'Balanced without iron, and the last high-pass in the microphone.',
    key: 'Balanced means two legs carrying the same signal in opposite polarity. What the receiver rejects is whatever is common to both.',
    concept: [
      'A balanced output sends the signal twice, once inverted. The receiver subtracts one from the other, so the signal doubles and anything that arrived on both wires equally — interference picked up along the way — cancels. That is all "balanced" means. It has nothing to do with impedance, and nothing to do with transformers: you can do it with two transistors.',
      'What you give up is isolation. A transformer’s two windings share no copper, so the microphone’s ground and the preamp’s ground never meet. A transformerless output connects them, and every ground-loop problem in the fault panel follows from that.',
      'The output capacitors are the last high-pass in the signal path. There are two of them, in series around the loop through the preamp’s input, so together they behave as half of one. 47 µF each into 1.5 kΩ corners at about 4.3 Hz. Four point seven microfarads each would corner at 43 Hz, and you would hear it — which means the preamp you plug into changes the microphone’s frequency response, not just its level. That is the subject of the next lesson.',
    ],
    preset: 'bluejay',
    listen: {
      prompt: 'Correctly sized output capacitors, and a tenth of the value.',
      a: out({ C_out: 47e-6 }, '47 µF output caps'),
      b: out({ C_out: 4.7e-6 }, '4.7 µF output caps'),
    },
    explore: {
      stage: 'output',
      prompt:
        'Shrink the output capacitors and watch the corner move. Then change the preamp impedance in the load stage and watch the same corner move again — it takes both.',
    },
    quiz: [
      {
        id: 'l11q1',
        kind: 'concept',
        question: 'A balanced connection rejects interference because:',
        options: [
          'Interference arrives equally on both legs and the receiver subtracts them',
          'The impedance is low',
          'The shield blocks it entirely',
          'The signal is stronger',
        ],
        answer: 0,
        explain:
          'Common-mode in, differential out. How well it works depends on how closely matched the two legs are — which is exactly what the ground-loop fault demonstrates.',
      },
      {
        id: 'l11q2',
        kind: 'concept',
        question: 'Two 47 µF output capacitors feeding a 1.5 kΩ preamp behave like:',
        options: [
          'One 23.5 µF capacitor into 1.5 kΩ',
          'One 94 µF capacitor into 1.5 kΩ',
          'One 47 µF capacitor into 3 kΩ',
          'Two independent filters',
        ],
        answer: 0,
        explain: 'They are in series around the loop, and capacitors in series halve.',
      },
      {
        id: 'l11q3',
        kind: 'concept',
        question: 'What does a transformerless output lose compared with a transformer?',
        options: [
          'Galvanic isolation between microphone ground and preamp ground',
          'The ability to be balanced',
          'Low output impedance',
          'Frequency response above 10 kHz',
        ],
        answer: 0,
        explain:
          'No shared copper is a real advantage, and it is the one thing an electronic phase splitter cannot give you.',
      },
    ],
  },
  {
    n: 12,
    title: 'The preamp is part of the microphone',
    blurb: 'Input impedance and cable capacitance, and when they actually matter.',
    key: 'A microphone’s response is only defined together with what it is plugged into.',
    concept: [
      'Preamps present anything from 1.5 kΩ (a classic console input) to 10 kΩ or more. On a transformerless microphone that impedance works against the output capacitors and moves the bass corner. On a transformer microphone it is reflected back into the primary multiplied by the square of the turns ratio, where it damps the transformer — which is why some preamps make the impedance switchable and why the switch is audible on some microphones and not others.',
      'Cable capacitance is about 100 pF per metre per leg. Against a 200 Ω source impedance that is a corner around 8 MHz at one metre and 160 kHz at fifty. Inaudible, and that is the point: a low output impedance is what makes cable length a non-issue. Run the same fifty metres from the unbalanced electret output, whose source impedance is a kilohm, and the arithmetic starts to bite.',
      'The general rule of thumb is that a preamp should present at least five times the microphone’s source impedance. High enough not to load it, low enough to damp a transformer sensibly.',
    ],
    explore: {
      stage: 'load',
      prompt:
        'Switch between 1.5 kΩ and 10 kΩ on a transformerless build and watch the bass corner. Then load the Raven preset and do it again — the transformer reacts quite differently.',
    },
    listen: {
      prompt: 'The same microphone into a 1.5 kΩ console input and a 10 kΩ modern one.',
      a: load({ R_preamp: 1500 }, '1.5 kΩ preamp'),
      b: load({ R_preamp: 10000 }, '10 kΩ preamp'),
    },
    quiz: [
      {
        id: 'l12q1',
        kind: 'concept',
        question: 'Lowering the preamp’s input impedance on a transformerless microphone:',
        options: [
          'Raises the output high-pass corner',
          'Lowers the output high-pass corner',
          'Has no effect on frequency response',
          'Changes the high-frequency response only',
        ],
        answer: 0,
        explain: 'The corner is 1/(2πRC). Smaller R, higher corner, less bass.',
      },
      {
        id: 'l12q2',
        kind: 'concept',
        question: 'Fifty metres of cable on a 200 Ω balanced output gives a low-pass corner near:',
        options: ['160 kHz', '16 kHz', '1.6 kHz', '160 Hz'],
        answer: 0,
        explain:
          '5 nF against 200 Ω. Comfortably out of the way — a low source impedance is what buys you that.',
      },
      {
        id: 'l12q3',
        kind: 'concept',
        question: 'On a transformer microphone, a lower preamp impedance is felt by the primary as:',
        options: [
          'A load divided by n² — so a much heavier load, damping the transformer',
          'The same load, unchanged',
          'A load multiplied by n²',
          'No load at all',
        ],
        answer: 2,
        explain:
          'Impedance seen from the primary is the secondary load multiplied by n². A 1.5 kΩ preamp behind a 7:1 transformer looks like 73 kΩ — which is why the FET can drive it, and why changing it is felt as damping rather than as loading.',
      },
    ],
  },
  {
    n: 13,
    title: 'Real world: hum and buzz',
    blurb: 'Six faults, all of them things that have happened to somebody.',
    key: 'Hum and buzz are not mysteries. They are circuit elements you did not intend to build.',
    concept: [
      'Everything in the fault panel is a change to the same netlist the solver has been using all along. Nothing is a sound effect. Switch on the floating grille and the hum you hear is the mains field coupling through a few femtofarads into the highest-impedance node in the microphone, solved at 50 Hz along with everything else.',
      'The two hum faults are worth comparing directly. A floating capsule body produces a smooth hum, because it is coupling a clean 50 Hz field into the front end. A ground loop produces a buzz, because mains current in a cable screen is full of odd harmonics — a nice diagnostic in real life: smooth hum means the front end, buzzy hum means the ground.',
      'The ground loop is also the best demonstration of what balancing actually buys you. On the balanced output it is a faint hum, because the two legs are matched to within half a percent and almost all of it cancels. Switch the output stage to unbalanced and run the same fault: it is deafening. That comparison is the entire argument for balanced lines, and you can hear it in ten seconds.',
      'The radio-frequency fault is the odd one out. Radio itself is far above the audio band and would be harmless, except that a semiconductor junction is a rectifier — the FET demodulates it. What you hear is the envelope: a handset transmits 217 bursts a second, so the interference is a buzz at 217 Hz and its harmonics. Two 100 pF capacitors at the connector short the radio frequency to the shield before it can reach anything that rectifies.',
    ],
    listen: {
      prompt:
        'A ground loop on the balanced output, then the same fault with the output switched to unbalanced.',
      a: { label: 'Balanced output', stage: 'output', variant: 'transformerless', faults: ['ground-loop'] },
      b: { label: 'Unbalanced output', stage: 'output', variant: 'unbalanced', faults: ['ground-loop'] },
    },
    explore: {
      stage: 'load',
      prompt:
        'Open the fault panel and switch them on one at a time. Each one tells you what it changed in the netlist — read that, then listen.',
    },
    quiz: [
      {
        id: 'l13q1',
        kind: 'concept',
        question: 'Smooth hum rather than harmonic-rich buzz usually points to:',
        options: [
          'A field coupling into the front end',
          'Current in the cable screen',
          'A cold solder joint',
          'Radio frequency interference',
        ],
        answer: 0,
        explain:
          'A field is close to a clean sine. Mains *current* has been through rectifiers on its way round the building and is full of odd harmonics.',
      },
      {
        id: 'l13q2',
        kind: 'concept',
        question: 'Why does a phone make a microphone buzz at 217 Hz?',
        options: [
          'It transmits in 217 bursts per second, and the FET rectifies the envelope',
          'It transmits at 217 Hz',
          'It induces 217 Hz into the cable directly',
          'The preamp resonates at 217 Hz',
        ],
        answer: 0,
        explain:
          'The carrier is around 900 MHz and inaudible. The burst rate is 217 per second, and rectification is what makes an inaudible carrier audible.',
      },
      {
        id: 'l13q3',
        kind: 'listen',
        question: 'Which clip has the unbalanced output?',
        options: ['Clip A', 'Clip B'],
        answer: 1,
        explain:
          'Same ground loop, two very different outcomes. On the balanced output the mismatch between the two legs is half a percent, so almost all of it cancels. Unbalanced, there is nothing to cancel against.',
        clips: {
          a: { label: 'A', stage: 'output', variant: 'transformerless', faults: ['ground-loop'] },
          b: { label: 'B', stage: 'output', variant: 'unbalanced', faults: ['ground-loop'] },
        },
      },
    ],
  },
]

export const lessonByNumber = (n: number): Lesson | undefined => LESSONS.find((l) => l.n === n)

/** Apply a lesson mutation to a build without disturbing anything else. */
export function applyMutation(spec: BuildSpec, m: Partial<Mutation>): BuildSpec {
  const next: BuildSpec = {
    ...spec,
    capsule: { ...spec.capsule, values: { ...spec.capsule.values } },
    polarisation: { ...spec.polarisation, values: { ...spec.polarisation.values } },
    converter: { ...spec.converter, values: { ...spec.converter.values } },
    output: { ...spec.output, values: { ...spec.output.values } },
    load: { ...spec.load, values: { ...spec.load.values } },
    faults: spec.faults.map((f) => ({ ...f })),
  }
  if (m.stage && m.variant) next[m.stage] = withDefaults(m.stage, { variant: m.variant, values: {} })
  if (m.stage && m.values) {
    next[m.stage] = { ...next[m.stage], values: { ...next[m.stage].values, ...m.values } }
  }
  if (m.faults) next.faults = m.faults.map((id) => ({ id, values: {} }))
  return next
}

/** Which controls a given lesson unlocks. Everything at or below its number. */
export function unlockedFor(lesson: number | null): (paramLesson?: number) => boolean {
  if (lesson === null) return () => true
  return (paramLesson) => paramLesson === undefined || paramLesson <= lesson
}
