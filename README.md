# Mic Lab

Build a condenser microphone stage by stage — capsule, polarisation, impedance
converter, output — from real components with real values, then play an audio
file through the microphone you built.

The audio is not an EQ curve someone drew. The app holds a netlist and solves it
the way SPICE does: modified nodal analysis, a Newton operating point for the
JFET, an AC sweep, and a noise analysis. Change a capacitor and the matrix
changes, so the sound changes. The frequency response, the self-noise and the
hum all come out of the same solve, which means the app is still right when you
wire something nobody anticipated.

```bash
npm install
npm run dev
```

> **Building one of these for real?** Read [`docs/SAFETY.md`](docs/SAFETY.md)
> first. Mic Lab is a teaching model — a real linear circuit solver, checked
> against ngspice, but linear, small-signal and steady-state. It cannot tell you
> whether a circuit will clip, start up, or survive its own supply, and it has no
> model of phantom power, of temperature, or of any nonlinearity. It will draw a
> beautiful frequency response for a circuit that distorts at conversational
> level. The operating-point tab now carries the checks it *can* make.


## What is in it

- **Walkthrough** — the way in, and where a first visit lands. A board is
  populated one part at a time: the schematic shows empty pads for what is not
  fitted yet, each part gets a screen explaining what it is for, and the graph
  and the numbers show what fitting it actually did. It starts with a capsule
  that produces nothing at all, because an uncharged capacitor does not, and
  that is the reason the next part exists. The steps are derived from whatever
  build you are holding, so any preset — or anything you design yourself — can
  be assembled.
- **Free build** — four stages, thirteen topologies between them, every
  component value editable, live graph and live audio, and an explanation panel
  that narrates what you just changed and why it did what it did.
- **Lessons** — thirteen lessons following the signal path, each running
  Concept → Listen → Explore → Quiz. Controls from later lessons are visible but
  locked.
- **Faults** — six real-world faults, each of them extra netlist elements rather
  than sound effects, so the hum responds to everything else you change.
- **Presets** — Sadon's own builds (Raven, Blue Jay, the SDC electret) plus
  textbook references, and A/B against published curves for a TLM 103 and a UA
  Sphere.

Builds are encoded in the URL, so any state is a link. Nothing is uploaded
anywhere; audio files stay in the browser.

## Layout

```
src/
  solver/     MNA stamps, complex LU, JFET model, operating point, AC sweep,
              noise, hum. Pure TypeScript, no DOM, runs in a worker.
  stages/     One folder per stage. Each variant is a netlist fragment plus the
              derived quantities and template sentences that explain it.
  audio/      Impulse-response builder, noise shaping, the Web Audio graph, and
              the generated demo material.
  explain/    The explanation engine: diffs derived quantities, picks the ones
              that moved most, renders their templates.
  ui/         Three panes and a transport bar.
  lessons/    Lesson content, quizzes, and the assembly walkthrough.
  data/       Presets, reference curves.
docs/
  SPEC.md     The handoff specification this was built from.
  THEORY.md   Long-form explanations, one section per lesson.
  NOTES.md    Every place the build departs from the spec, and why.
  SAFETY.md   What the model does not know, and the real hazards of building
              a condenser microphone. Read before soldering.
```

## Verification

```bash
npm test          # 78 tests
npm run typecheck
npm run build
```

The solver is checked against **ngspice 47**: `scripts/gen-golden.ts` exports the
reference build as a SPICE deck, runs it, and commits the result;
`src/solver/__tests__/golden.test.ts` re-solves the same circuit with our own MNA
and requires agreement across 5 Hz – 40 kHz. It currently agrees to **0.019 dB
and 0.16°**.

Regenerate the golden file whenever the reference build changes:

```bash
brew install ngspice
npx vite-node scripts/gen-golden.ts
```

The rest of the Phase 0 exit criteria from the spec, plus the audio chain's own
tests — including one that measures the noise the engine actually produces and
checks it against the self-noise figure printed in the UI — are in
`src/solver/__tests__/` and `src/audio/`. See `docs/NOTES.md` for the results
table and for the three places the spec turned out to be wrong.

## Status

Phases 0, 1 and 2 of the spec are built. Phase 3 (free-form schematic editing)
and Phase 4 (Wasm transient simulation, saturation) are not.
