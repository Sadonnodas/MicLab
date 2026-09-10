# Implementation notes

Everything in this file is a place where the build departs from `SPEC.md`, or
where a number in the spec turned out not to survive contact with the solver.
Nothing here was decided lightly and nothing here is hidden in the code.

*Written during the Phase 0–2 build, September 2026.*

---

## 1. Things that were wrong in the spec and had to change

### 1.1 The de-emphasis network cannot return to the gate

**Spec §3.3** describes the U87-style de-emphasis as "frequency-dependent
negative feedback via series R_fb–C_fb from drain back to gate/source *(verify
exact node on Blue Jay board)*", with R_fb 47 kΩ and C_fb 470 pF.

Built literally as drain → gate, the reference microphone comes out at **32.6
dB-A** of self-noise, with the feedback resistor contributing 99 % of it, and
loses about 35 dB of signal. Both effects have the same cause: the gate is a
~100 MΩ node, so a 47 kΩ resistor coupled to it injects an enormous noise
current *and*, through shunt feedback, loads the capsule down to about 13 kΩ.

The network now returns to the **source**, which is a low-impedance node. Since
the source is bypassed by C_s, it behaves as a frequency-dependent load on the
drain — which is what the real circuit does and what the lesson describes.
Lesson 8 makes the point explicitly, including the 25 dB penalty, because it is
a good lesson in its own right: feedback goes back to low-impedance nodes.

**Values changed:** R_fb 47 kΩ → **1 kΩ** (range 220 Ω – 47 kΩ), C_fb 470 pF →
**22 nF** (range 1 nF – 220 nF). These were chosen by sweeping the two against
the solver until the K67 presence bump was cancelled; see §2.2 below for why the
arithmetic alone does not get you there.

### 1.2 Backplate polarisation needs a bypass capacitor

**Spec §3.2** gives the backplate-polarised (Raven) wiring as `V_pol → R_pol →
backplate; diaphragm → gate directly`, with no other components.

That circuit does not work. With nothing holding the backplate at audio ground,
the gigaohm ends up **in series** with the signal rather than across it: the
capsule drives the gate through C_caps and has to return through R_pol, giving a
1/f response and about 50 dB of loss. The Raven preset came out at 0.06 mV/Pa
and 67 dB-A.

Added: **C_bypass**, from backplate to ground, default 10 nF (range 100 pF –
1 µF). This is what real backplate-polarised boards have, and it is drawn on the
schematic. With it, Raven lands at 16.8 mV/Pa and 9.7 dB-A.

A pleasant consequence: in this wiring it is the **gate resistor**, not the
polarisation resistor, that sets the low-frequency corner. That is now the
lesson text for the backplate variant, and the spec's own hint at it ("plus the
gate resistor working against the same capsule capacitance") turns out to have
been the whole story.

### 1.3 The electronics-only noise target

**Spec §4.8 item 5** asks the reference build's electronics, with the capsule's
acoustic noise set to zero, to land between 2 and 6 dB-A.

Two 1 GΩ resistors on a 55 pF capsule come out at **7.3 dB-A** — R_gate at
3.5 dB-A and R_pol at 3.0 dB-A, which add to 6.3, plus the FET's contributions.
A hand calculation of R_pol alone gives about 2.8 dB-A, agreeing with the solver
and with the spec's own estimate of "about 4 dB-A" for the pair.

The test therefore checks **2 to 8 dB-A**. The purpose of the test — catching a
missing or mis-scaled noise source in either direction — is unaffected. The
total self-noise target of 8–14 dB-A is met exactly as written (10.7 dB-A).

---

## 2. Things that are right but surprising

### 2.1 Sensitivity is about four times a real microphone's

The reference build reads 105 mV/Pa where a real U87 reads about 28. The cause
is the spec's own default values: a 2SK170 with R_d = 4.7 kΩ and a fully
bypassed 1.5 kΩ source resistor biases at gm = 6.1 mS, giving a stage gain of
29 dB. Real boards run far less gain at the FET.

Nothing is scaled to hide this. Levels through the audio engine are absolute
(digital full scale is +24 dBu, as on a studio interface), so the preamp trim on
the transport bar is where you make it up — exactly as in the room. If Sadon's
measurements of the real boards show lower gain, only the preset values need to
change; the model does not.

### 2.2 The de-emphasis is partly self-defeating, and that is real

Raising R_fb by a factor of ten changes the 10 kHz response by a fraction of a
decibel, which is not what the shelf formula R_fb/(R_fb + R_d) predicts. The
reason is the Miller effect: the gate sees C_gd multiplied by (1 + gain), so
taking gain away at high frequencies also takes away input capacitance, the
capsule is loaded less, and a good part of the cut comes straight back.

The two effects fight, which is why the network needs a much larger capacitor
than the arithmetic suggests, and why real de-emphasis is tuned on a sweep
rather than calculated. The "Why?" text on that control says so.

### 2.3 A balanced output really does reject a ground loop

With the ground-loop fault at 300 mA of screen current, the transformerless
output produces a barely audible hum, because the two legs are matched to within
half a percent. Switch the output stage to unbalanced and the same fault is
deafening. This is not a modelling artefact — it is the point of balanced lines,
and it is lesson 13's Listen demo.

To make it happen, the model carries deliberate, documented component
mismatches: the cold-leg build-out resistor is 0.5 % high, the transformer's
cold-leg winding resistance is 0.5 % high, and the preamp's cold-leg
common-mode impedance is 1 % high. Without a mismatch somewhere, common-mode
rejection would be infinite and the fault would do nothing at all.

### 2.4 Fault levels are calibrated, and the calibration is a judgement call

The faults are real netlist elements, but *how bad* each one is depends on a
number the spec does not give — how many femtofarads couple the mains field into
a floating capsule, how much current circulates in a screen. Those defaults were
chosen so that each fault lands somewhere useful: audible against the noise
floor, not so loud it drowns the music. As they stand:

| Fault | Blue Jay (balanced) | Raven (transformer) | SDC (unbalanced) |
|---|---|---|---|
| Floating body | 86 dB SPL | 75 | 85 |
| Ground loop | −17 | −140 | **+55** |
| Missing RF caps | 46 | 45 | 55 |
| Cold solder joint | 21 | −127 | **94** |
| Leaky polarisation | 102 → 34 mV/Pa, +8.8 dB-A | no level change, +1.6 dB-A | — |

Every one of those numbers is a solve, and the *relationships* between them are
not tuned at all — they fall out of the circuits. The ground-loop row is the one
worth staring at: a transformer output rejects it by 140 dB because the windings
share no copper, a balanced electronic output rejects it down below its own
hiss, and an unbalanced output does not reject it at all. Same fault, same
current, three answers. `faults.test.ts` locks those relationships in.

### 2.5 The transformer's bass bump

Raven shows about +2.9 dB at 20 Hz. That is the series resonance of the 10 µF
coupling capacitor with the 20 H primary at 11 Hz, damped only by the 100 Ω
driver and the 400 Ω winding. It is real, it is in the spec's own default
values, and it is part of why transformer microphones are described as sounding
big at the bottom. Lesson 10 mentions it.

---

## 2.6 Corrections found in the September 2026 physics audit

A pass over every numeric claim in the app and in `THEORY.md`, checking each
against the solver or against a hand calculation. Four things were wrong.

**The diaphragm displacement figure was out by a factor of a thousand.**
`THEORY.md` said a large diaphragm moves "of the order of 10⁻¹¹ m" at 94 dB SPL,
giving a fractional capacitance change of 4 × 10⁻⁷. Work it backwards from a
real sensitivity instead: 20 mV/Pa at 60 V is dC/C = 3.3 × 10⁻⁴, which against a
25 µm gap is a displacement of **8 nanometres**. The old figure would have given
24 µV/Pa, not 24 mV/Pa, and the text then quoted the latter — two errors that
happened to cancel in the conclusion. The "smaller than a hydrogen atom" line
belongs at the *threshold of hearing*, 50 000 times quieter, where the
displacement really is 1.7 × 10⁻¹³ m.

**The JFET table used Ciss where the model wanted Cgs.** Datasheets quote Ciss
(input capacitance, drain shorted to source) and Crss (reverse transfer), and
Ciss = Cgs + Cgd. The solver stamps the two separately, so feeding it the
datasheet Ciss as Cgs over-stated how much every FET loads the capsule by the
whole of Crss — 6 pF on a 2SK170, against a 55 pF capsule. Fixed by deriving
Cgs = Ciss − Crss, with both datasheet figures now stored on the model and a
test that keeps them consistent. The reference build's sensitivity moved from
102 to 105 mV/Pa as a result.

**The capsule arcing explanation named the wrong mechanism.** The text said dust
"starts to arc across the gap" above 60–65 V. Paschen's law puts the breakdown
of dry air across a 25 µm gap at several hundred volts, so the gap itself is in
no danger at 60 V. The real limits are the electrostatic softening of the
diaphragm (the pull goes as V², works against the tension, lowers the resonance
and raises distortion, and ends at pull-in) and *contamination* — a dust particle
or moisture film bridging part of the gap gives a local discharge path that
eventually burns a pinhole. Corrected in the lesson, in `THEORY.md`, and in the
new over-polarisation warning.

**Four arithmetic slips**, all now recomputed against the solver: the
100 pF-coupling-capacitor loss (3.4 → 3.8 dB), the stray-capacitance table at 20
and 40 pF (−2.5 → −2.69, −4.5 → −4.75 dB), the transformerless output corner
(4.5 → 4.3 Hz, and 45 → 43 Hz), and R_pol's noise contribution at 100 MΩ
("around 12" → 13.0 dB-A).

## 2.7 Hardware reality checks

The solver is linear, small-signal and steady-state, which means it will draw a
perfect frequency response for a circuit that cannot be built. `solver/hardware.ts`
adds the checks it *can* make from the operating point, shown on the
operating-point tab and, when one fails, as a bar across the top of the app:

- **Phantom power budget.** The converter's DC draw against the 10 mA the
  standard allows, and the rail 48 V through 6.81 kΩ per leg would sag to. Worth
  knowing: nothing reachable from the app's own slider ranges exceeds about
  2.8 mA, because the drain resistor and supply rail bound it — a test pins that
  down. The figure is the converter alone; the polarisation multiplier and
  output stage are not modelled and draw their own.
- **Estimated maximum SPL**, from how far the gate and output node can swing
  before the FET pinches off, the gate junction forward-biases, or the output
  hits a rail. This caught something about the specification's own defaults: the
  reference build's drain sits 1.31 V below the supply and clips asymmetrically
  at about 112 dB SPL. Not a bug — R_d = 4.7 kΩ at 0.28 mA simply does not drop
  much — but worth seeing.
- **DC stress on every capacitor**, with a suggested rating (1.5× for film and
  ceramic, 2× for anything large enough to be an electrolytic, which also gets a
  polarity note). The coupling capacitor on a diaphragm-polarised board and the
  bypass capacitor on a backplate-polarised one both sit at the full 60 V, and
  fitting a 50 V part there is a common and expensive mistake.
- **A warning above 65 V of polarisation**, which never fires for electrets —
  their "polarisation voltage" is an equivalent for a sealed-in charge, with no
  external voltage anywhere to be dangerous.

`docs/SAFETY.md` is the full statement of what the model does not contain.

## 3. Verification

`src/solver/__tests__/` holds the Phase 0 exit criteria from §4.8.

| Criterion | Status |
|---|---|
| 1. RC high-pass −3.01 dB at the corner, 6 dB/octave below | passes to 0.01 dB |
| 2. RC low-pass, LC resonance Q, transformer ratio and impedance | passes to 3 decimal places |
| 3. JFET operating point vs hand calculation, four devices | within 1 % |
| 4. Reference build vs **ngspice 47** | **worst 0.019 dB, 0.16°** across 5 Hz – 40 kHz |
| 5. Self-noise 8–14 dB-A; electronics alone 2–8 dB-A (see §1.3) | 10.6 and 7.2 |
| 6. Full sweep + noise analysis under 100 ms | ~45 ms |

The golden file is real: `npx vite-node scripts/gen-golden.ts` exports the
reference build as a SPICE deck (`src/solver/spice.ts`), runs `ngspice -b`, and
commits the result to `src/solver/__tests__/golden/ngspice-reference.csv`.
Regenerate it whenever the reference build's topology or default values change.

Two choices keep that comparison exact rather than approximate: the JFET's gate
capacitances are exported as discrete capacitors with the SPICE model's CGS/CGD
set to zero (SPICE's junction capacitance varies with bias and this model's does
not), and a 1 TΩ resistor is placed from every node to ground to match the gmin
the solver adds for robustness.

Beyond §4.8, `src/audio/` has its own tests: the impulse response built from a
single RC high-pass matches the analytic curve to better than 0.2 dB down to
10 Hz, absolute levels survive the round trip, and — the one that matters most —
the noise you actually hear, measured through the engine's own filter and
referred back through H(f), lands within 1 dB of the self-noise figure printed
in the UI.

---

## 4. Deliberate simplifications, all of them in the spec

- The capsule is a behavioural source, not a mechanical-analogue network (§3.1).
- The transformer driver and the transformerless phase splitter are ideal
  dependent sources, not transistor stages (§3.4).
- The polarisation supply is an ideal DC source; the 48 V → multiplier chain is
  not modelled (§3.2).
- Cardioid only; no polar-pattern switching (§3.1).
- The demodulated GSM burst is an audio-band current injected at the gate, with
  its envelope applied in the audio engine. The rectification itself is
  nonlinear and therefore outside a linear solver — this is the one fault whose
  *level* is a modelled constant rather than a solved result. Everything about
  where it enters the circuit, and everything it then passes through, is solved.

## 5. Things left for Sadon

The preset capture checklist in spec §1.3 is still open. `raven.json` and
`bluejay.json` carry an `unverified` list naming every value that is a textbook
default standing in for a measurement; the preset menu marks them with an
asterisk and the header says so. Filling those in is a JSON edit, not a code
change.

The open questions in spec §11 are all still at their stated defaults.
