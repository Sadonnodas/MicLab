# Before you build anything from this

**Mic Lab is a teaching model, not a design verification tool. Do not treat a
curve it draws as evidence that a circuit is safe, correct, or buildable.**

This document says what the model does and does not know, what it got wrong and
has since had fixed, and what the real hazards of building a condenser
microphone actually are. It is written to be read once, properly, before the
soldering iron comes out.

---

## 1. The short version

- **Nothing in a phantom-powered condenser microphone is likely to hurt you.**
  48 V is below the conventional threshold at which DC becomes dangerous, and
  phantom power is current-limited to about 10 mA by its own feed resistors. The
  60–65 V polarisation supply sits behind a gigaohm and can deliver microamps.
  You may get a startling zap off a multiplier's reservoir capacitor. That is
  the extent of it.
- **Valve (tube) microphones are a completely different matter.** They run
  200–300 V at real current, which is genuinely lethal, and their supplies hold
  that charge after switch-off. This app does not model valve circuits at all —
  it is an explicit non-goal in the specification — so nothing you learn here
  transfers to one. Do not use it as preparation for working on a valve mic.
- **The thing most at risk is the capsule**, which is fragile, expensive, and
  destroyed by over-voltage, moisture, fingerprints and hot-plugging.
- **The app cannot tell you whether your circuit will distort, oscillate, start
  up, survive its own supply, or fit its component ratings** — except for the
  specific checks listed in §3. It solves a *linear, small-signal, steady-state*
  model, and reality is none of those three things.

---

## 2. What the model genuinely does not contain

Every one of these is a way a circuit can be wrong that Mic Lab will not notice.

| Not modelled | Why it matters when you build |
|---|---|
| **Any nonlinearity** | The solver is linear by design (spec Phase 4 would change this). It will draw a perfect frequency response for a circuit that clips at conversational level. The max-SPL figure in §3 is an *estimate from the bias point*, not a simulation of clipping. |
| **The phantom power supply** | V_dd is an ideal source with unlimited current. A real board has to derive it from 48 V through 3.4 kΩ, and share that with the polarisation multiplier and the output stage. |
| **The polarisation multiplier** | You set V_pol directly. The voltage doubler or tripler that generates it, its switching noise, its start-up time and its stored charge are all absent. |
| **Component tolerances and ratings** | Apart from the DC stress read-out, nothing checks that a part can survive where you put it. Resistor tolerance, capacitor dielectric type and leakage, temperature coefficients: none of it. |
| **Absolute maximum ratings** | The FET's V_ds max, gate breakdown, and dissipation limits are not checked. |
| **Temperature** | Everything is at 300 K forever. Real JFET bias drifts with temperature, and gate leakage roughly doubles every 10 °C. |
| **Layout, grounding topology, screening** | These decide whether a real microphone hums. The model has ideal wires with no inductance and no coupling except where a fault explicitly adds it. |
| **Real RF behaviour** | Radio frequency interference is modelled as an audio-band current whose *level* is a chosen constant, because rectification is nonlinear. Only where it enters and what it then passes through are solved. |
| **Mechanical everything** | Capsule mounting, shock isolation, the grille's acoustic effect, wind, humidity, handling noise. |
| **Polar patterns** | Cardioid only. The rear diaphragm is not modelled acoustically. |
| **Valve, transformer-input, or transistor-level output circuits** | The transformer driver and the transformerless phase splitter are ideal dependent sources, not real stages. |

---

## 3. What the app *does* check, and how far to trust it

The **operating point** tab has a "Before you build it" section. It reports:

- **Converter supply current** and what the phantom rail would sag to. Useful,
  but it is the impedance converter *only* — the polarisation multiplier and
  output stage draw their own, typically another 1–3 mA, and neither is in the
  model. Treat it as a floor.
- **Estimated maximum SPL**, worked out from how far the gate and the output
  node can swing from their DC operating points before the FET pinches off,
  forward-biases its gate junction, or the output hits a rail. This is an
  order-of-magnitude estimate from the small-signal model. It is genuinely
  useful for catching a badly-chosen bias point — it will tell you if you have
  built something that distorts at 97 dB SPL — but it is not a distortion
  specification.
- **DC volts across every capacitor**, with a suggested minimum voltage rating
  at twice the stress. This one is worth taking seriously: the capsule coupling
  capacitor and the backplate bypass capacitor sit at the *full polarisation
  voltage*, 60 V, and fitting a 50 V part there is a common and expensive
  mistake. It also flags which capacitors have a DC polarity, so an electrolytic
  must be oriented correctly or a bipolar part used.
- **A warning above 65 V of polarisation** (see §5).

A yellow bar appears across the top of the app whenever one of these checks
fails. It is not decorative.

---

## 4. Where the model is known to disagree with reality

These are all documented in `NOTES.md` with the arithmetic; the ones that matter
for building are:

1. **Sensitivity is about four times too high.** The reference build reads
   ~105 mV/Pa where a real U87-style board reads ~28. The cause is the default
   values the specification supplies: a 2SK170 with a 4.7 kΩ drain resistor and
   a fully bypassed 1.5 kΩ source resistor biases at 29 dB of stage gain, which
   is far more than a real board runs. **Do not use the app to pick a drain
   resistor for a target sensitivity.**

2. **The reference build's drain sits close to the supply rail.** R_d = 4.7 kΩ
   at 0.28 mA drops only 1.3 V, so the drain has 1.3 V of upward swing and 10 V
   of downward swing. It clips asymmetrically at about 112 dB SPL. That is a
   real observation about the specification's default values, not a bug — and
   the headroom read-out now shows it.

3. **JFET parameters are datasheet typicals, and JFETs vary enormously.** A
   2N3819's Idss is specified anywhere from 2 to 20 mA. The bias point the model
   predicts is that of an average device; yours will differ, possibly by a lot.
   Use the spread slider to see how much, and measure the part you actually
   have before committing to a source resistor.

4. **The de-emphasis network's behaviour is not the textbook shelf.** The
   arithmetic overpredicts it, because reducing the gain also reduces Miller
   capacitance at the gate and gives some of the loss back. The model gets this
   right; a first-order hand calculation does not. This is a case where the app
   is *more* trustworthy than the back of an envelope, not less.

5. **Two things the specification itself had wrong** — a de-emphasis network
   returning to the gate, and a backplate-polarised capsule with no bypass
   capacitor — are corrected here, and both would have been real, audible
   failures if built as written. `NOTES.md` §1 has the details.

---

## 5. The actual hazards of building a condenser microphone

Roughly in order of how likely they are to cost you something.

**To the capsule — the expensive one.**

- *Over-polarisation.* Above about 65 V the electrostatic pull softens the
  diaphragm, distortion rises, and any dust or moisture in the 25 µm gap becomes
  a discharge path that eventually burns a pinhole. The gap itself will not
  break down at 60 V — Paschen's law puts clean dry air at several hundred volts
  across that distance — so the failure is always contamination. The app now
  warns above 65 V, because up to that point its own graph makes over-polarising
  look like free signal-to-noise.
- *Touching or breathing on the diaphragm.* A 5 µm gold-sputtered membrane does
  not survive contact, and a fingerprint on the backplate is a leakage path
  across a gigaohm-scale node.
- *Humidity.* Store capsules dry. Condensation in the gap causes crackle at
  best and permanent damage at worst.
- *Hot-plugging phantom power.* Connecting or disconnecting an XLR with phantom
  live puts a transient through the capsule and the output stage. Mute first.

**To the electronics.**

- *Under-rated capacitors at the polarisation node* — see §3. 60 V DC needs a
  100 V part.
- *Reversed electrolytics* on the output coupling capacitors, which sit at a few
  volts of DC with a defined polarity.
- *Static.* A JFET gate connected to a gigaohm and a capsule is an excellent
  antenna for a static discharge. Ground yourself.

**To you.**

- *Soldering.* Burns, and flux fumes, which are a genuine respiratory irritant.
  Ventilate.
- *Isopropyl alcohol* for board cleaning is flammable.
- *Mains-powered test equipment.* The one real electrical risk on the bench is
  not the microphone; it is connecting an earthed oscilloscope probe to
  something that is not at earth potential, or working on mains-powered gear
  with the lid off. If you are measuring a phantom-powered microphone from an
  interface, you are fine.
- *Valve microphones.* Again: 200–300 V, lethal, stored in capacitors after
  switch-off, and entirely outside this app's scope.

---

## 6. How to use this app honestly

It is very good at answering "why does that happen?" — why a gigaohm, why the
bass goes when the polarisation resistor drops, why the same capsule sounds
different on two boards, where the hiss comes from, why a balanced output
rejects a ground loop and an unbalanced one does not. Those are relationships,
and the relationships are solved from a real netlist and checked against
ngspice to 0.019 dB.

It is not good at answering "will this exact circuit work?" — because that
question depends on nonlinearity, supply behaviour, layout, tolerances and
temperature, none of which it contains.

So: use it to understand a topology, then verify the actual design against the
device datasheets, a real SPICE run with the real supply included, and — the
step nothing replaces — a breadboard and a meter.

If a number here disagrees with your boards, your boards are right.
