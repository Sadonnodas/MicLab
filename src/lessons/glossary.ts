/**
 * Plain-language definitions for every word the walkthrough uses that somebody
 * new to electronics would not already know.
 *
 * The one rule that matters here: a definition may not lean on another word
 * that is itself unexplained. If a term needs a second term to make sense, the
 * second one has to be in this list too. Checked by a test.
 */

export interface GlossaryEntry {
  /** The word, as it appears in the text. */
  term: string
  /** Other spellings and inflections that should also be linked. */
  aliases?: string[]
  /** One or two sentences. No jargon. */
  short: string
  /** Optional extra sentence for the curious. */
  more?: string
}

export const GLOSSARY: GlossaryEntry[] = [
  {
    term: 'capacitor',
    aliases: ['capacitors'],
    short:
      'Two pieces of metal with a gap between them. It cannot pass a steady current — the gap is in the way — but it can hold a certain amount of electrical charge, and it will happily pass a signal that keeps changing.',
    more: 'The closer together and the bigger the plates, the more charge it holds. A microphone capsule is a capacitor where one plate is light enough for sound to move.',
  },
  {
    term: 'capacitance',
    short:
      'How much electrical charge a capacitor can hold. Measured in farads — though everything in a microphone is a millionth of a millionth of one, which is called a picofarad.',
  },
  {
    term: 'transducer',
    aliases: ['transducers'],
    short:
      'Anything that turns one kind of energy into another. A microphone capsule turns sound into electricity; a loudspeaker does the reverse.',
  },
  {
    term: 'charge',
    short:
      'The stuff electricity is made of. You can push a quantity of it onto a capacitor and it will sit there, the way water sits in a bucket.',
  },
  {
    term: 'voltage',
    aliases: ['volts', 'volt'],
    short:
      'How hard electricity is being pushed. The usual comparison is water pressure: voltage is the pressure, current is the flow.',
  },
  {
    term: 'current',
    short:
      'How much electricity is flowing. Voltage is the pressure pushing it; current is the amount actually moving, measured in amps.',
  },
  {
    term: 'resistor',
    aliases: ['resistors'],
    short:
      'A component that makes it harder for electricity to flow. Measured in ohms — a big number of ohms means very little gets through.',
  },
  {
    term: 'gigaohm',
    aliases: ['gigaohms'],
    short:
      'A thousand million ohms. An enormous resistance: almost nothing gets through it, which is exactly the point in a microphone.',
  },
  {
    term: 'megohm',
    aliases: ['megohms'],
    short: 'A million ohms. Large, but a thousand times less resistance than a gigaohm.',
  },
  {
    term: 'DC',
    short:
      'Direct current — electricity that sits at a steady level and does not wobble, like the output of a battery. The opposite of a signal, which is all wobble.',
  },
  {
    term: 'impedance',
    short:
      'Resistance to electricity flowing, but for signals rather than steady DC — so it can depend on the frequency. A capacitor has a high impedance for low notes and a low one for high notes.',
  },
  {
    term: 'transistor',
    aliases: ['transistors'],
    short:
      'A component where a small voltage on one leg controls a much larger current through the other two. It is how almost all electronic amplification is done.',
  },
  {
    term: 'JFET',
    aliases: ['JFETs'],
    short:
      'A particular kind of transistor whose control leg — its gate — draws almost no electricity at all. That is what lets it read a microphone capsule without flattening the signal.',
  },
  {
    term: 'gate',
    short:
      'The control leg of a JFET. The voltage you put here decides how much current flows through the other two legs, and it draws almost nothing itself.',
  },
  {
    term: 'drain',
    short: 'One of the two legs a JFET’s current flows between. The signal usually comes out here.',
  },
  {
    term: 'source',
    short:
      'The other leg a JFET’s current flows between, and usually the one nearest ground.',
  },
  {
    term: 'bias',
    aliases: ['biased', 'biases'],
    short:
      'The steady, no-signal conditions a transistor sits at while it waits for something to happen. Set it badly and the transistor distorts or does nothing at all.',
  },
  {
    term: 'ground',
    short:
      'The reference point everything else is measured against — zero volts, by definition. In a microphone it is the metal body.',
  },
  {
    term: 'phantom power',
    short:
      'The 48 volts a mixing desk or audio interface sends up the microphone cable to run the electronics inside a condenser microphone. It travels on the same two wires as the audio.',
  },
  {
    term: 'polarisation',
    aliases: ['polarise', 'polarised', 'polarising'],
    short:
      'Putting a fixed electrical charge onto the capsule. Without it a condenser capsule produces nothing at all, however loud the sound.',
  },
  {
    term: 'diaphragm',
    aliases: ['diaphragms'],
    short:
      'The moving plate of the capsule: a film a few thousandths of a millimetre thick, stretched like a drum skin and coated with a whisper of metal so it conducts.',
  },
  {
    term: 'backplate',
    short:
      'The fixed plate of the capsule — a solid disc, drilled with a pattern of holes that control how freely the air behind the diaphragm can move.',
  },
  {
    term: 'capsule',
    aliases: ['capsules'],
    short:
      'The part of the microphone that actually hears: a diaphragm and a backplate, a few hundredths of a millimetre apart, forming a capacitor.',
  },
  {
    term: 'high-pass',
    short:
      'A filter that lets high notes through and holds back low ones. Every microphone has several, whether the designer wanted them or not.',
  },
  {
    term: 'corner',
    aliases: ['corner frequency'],
    short:
      'The frequency where a filter starts to take effect. Below a high-pass filter’s corner, the sound begins to fade away.',
  },
  {
    term: 'gain',
    short: 'How much bigger a signal is made. Gain of ten means ten times the voltage came out than went in.',
  },
  {
    term: 'negative feedback',
    aliases: ['feedback'],
    short:
      'Sending a bit of the output back to the input in a way that opposes it. You lose some gain and get steadier, more predictable behaviour in return.',
  },
  {
    term: 'balanced',
    short:
      'Sending the signal down two wires, one of them upside down, so the receiver can subtract them. Interference that lands on both wires equally cancels out.',
  },
  {
    term: 'transformer',
    aliases: ['transformers'],
    short:
      'Two coils of wire wound on the same lump of iron. A signal in one appears in the other with no wire between them at all, which is a very effective way to keep two pieces of equipment electrically separate.',
  },
  {
    term: 'inductance',
    short:
      'A coil’s resistance to a *change* in the current through it. It passes steady DC easily and fights fast wobbles, which makes it the opposite of a capacitor.',
  },
  {
    term: 'preamp',
    aliases: ['preamplifier'],
    short:
      'The first amplifier the microphone plugs into — on a mixing desk or an audio interface. A microphone signal is far too small to use directly.',
  },
  {
    term: 'self-noise',
    short:
      'The faint hiss a microphone makes on its own, in a silent room. Quoted as the loudness of a real sound that would be just as loud as the hiss — so a smaller number is a quieter microphone.',
  },
  {
    term: 'dB-A',
    short:
      'A way of measuring how loud something sounds to a person, rather than how big it is on a meter. Used for microphone self-noise; a good large microphone is around 10.',
  },
  {
    term: 'SPL',
    short:
      'Sound pressure level: how loud a sound actually is in the air, in decibels. A quiet room is about 30, a conversation about 60, a loud voice up close about 94.',
  },
  {
    term: 'mV/Pa',
    short:
      'Millivolts per pascal — how much electricity the microphone produces for a given loudness of sound. Its sensitivity. A pascal is a fairly loud voice at a hand’s distance.',
  },
  {
    term: 'frequency response',
    short:
      'How evenly a microphone treats low, middle and high notes. Drawn as a graph: flat means even-handed, a bump means that region comes out louder.',
  },
  {
    term: 'resonance',
    aliases: ['resonates', 'resonate'],
    short:
      'The frequency at which something naturally wants to vibrate, and so responds more strongly. A wine glass has one; so does a stretched diaphragm.',
  },
  {
    term: 'electret',
    aliases: ['electrets'],
    short:
      'A capsule with the electrical charge sealed permanently into a plastic layer at the factory, so it needs no polarisation supply of its own. Most small and cheap microphones work this way.',
  },
  {
    term: 'rectifier',
    aliases: ['rectifies', 'rectify', 'rectifying'],
    short:
      'Anything that lets electricity through in one direction but not the other. Transistors do this accidentally at radio frequencies, which is why a phone can make a microphone buzz.',
  },
  {
    term: 'stray capacitance',
    short:
      'Capacitance nobody wanted: any two bits of metal near each other behave a little like a capacitor, including a wire and the ground plane beside it.',
  },
  {
    term: 'picoamp',
    aliases: ['picoamps'],
    short:
      'A millionth of a millionth of an amp. An almost unimaginably small current — which is what makes a JFET able to look at a capsule without disturbing it.',
  },
  {
    term: 'shield',
    aliases: ['screen', 'shielding'],
    short:
      'A layer of metal around a signal, connected to ground, so that electrical interference lands on the metal instead of on the signal. The microphone’s body and the braid inside its cable are both shields.',
  },
]

const byLength = [...GLOSSARY].sort((a, b) => longest(b).length - longest(a).length)

function longest(e: GlossaryEntry): string {
  return [e.term, ...(e.aliases ?? [])].reduce((a, b) => (a.length >= b.length ? a : b))
}

/** Every spelling that should be linked, longest first so "stray capacitance" wins over "capacitance". */
export const GLOSSARY_PATTERNS: Array<{ pattern: RegExp; entry: GlossaryEntry }> = byLength
  .flatMap((entry) =>
    [entry.term, ...(entry.aliases ?? [])].map((word) => ({ word, entry })),
  )
  .sort((a, b) => b.word.length - a.word.length)
  .map(({ word, entry }) => ({
    pattern: new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')}\\b`, 'i'),
    entry,
  }))

export const glossaryFor = (term: string): GlossaryEntry | undefined =>
  GLOSSARY.find((e) => e.term.toLowerCase() === term.toLowerCase())
