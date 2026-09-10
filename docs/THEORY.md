# Theory

One section per lesson, longer than the in-app text and with the arithmetic
written out. The app's Concept screens are the short version of this; the "Why?"
expanders in the explanation panel are the shortest version.

Sadon: this is the document to argue with. Where a number here disagrees with
your boards, the boards are right.

---

## 1. The capsule is a capacitor

A large-diaphragm capsule is two plates about 20–40 µm apart. One is a stretched
membrane — 3 to 6 µm of mylar with a few hundred ångström of gold or nickel
sputtered onto it. The other is a solid brass backplate drilled with a pattern
of blind and through holes.

Capacitance is `C = ε₀·A/d`. For a 34 mm capsule with a 25 µm gap and an active
area of about 22 mm diameter:

```
C = 8.854e-12 × π(0.011)² / 25e-6 ≈ 134 pF
```

Real K67-family capsules measure 50–70 pF because only part of the backplate is
solid (the holes remove area) and because the diaphragm is not flat against the
whole of it. The app uses 55 pF for the CY002.

Sound moves the diaphragm. Work backwards from a real sensitivity to see by how
much. A capsule giving 20 mV/Pa at 60 V has, at one pascal,

```
dC/C = dV/V = 0.020 / 60 = 3.3 × 10⁻⁴
```

and against a 25 µm gap that is a peak displacement of about **8 nanometres**.
Small, but not absurd — about a thirtieth of a wavelength of visible light.

The famous line about a diaphragm moving less than the diameter of an atom
belongs at the *other* end of the scale. One pascal is 94 dB SPL; the threshold
of hearing is 0 dB SPL, fifty thousand times quieter. Scale the 8 nm down by
that and you get 1.7 × 10⁻¹³ m, which really is a few hundredths of the radius
of a hydrogen atom. That is the number worth being amazed by, and it is the
reason the electronics that follow are as fussy as they are — not because a loud
sound moves the diaphragm imperceptibly, but because a quiet one barely moves it
at all.

### The diaphragm as a resonator

A membrane under tension is a mass on a spring with damping. Its response to
pressure is second-order:

```
H_mech(f) = 1 / (1 − (f/f_res)² + j·f/(f_res·Q))
```

- Below `f_res`: flat. The diaphragm follows the pressure.
- At `f_res`: peaked by roughly `Q`.
- Above `f_res`: falling at 12 dB/octave — mass-controlled, and no longer keeping
  up.

`f_res` is set by tension and mass: `f_res ∝ √(T/σ)/r`, where T is tension, σ is
areal density and r is radius. This is why small-diaphragm capsules resonate
higher (14 kHz or more) and large ones lower (8–10 kHz), and why re-tensioning a
diaphragm changes a capsule's character.

`Q` is set by damping, and the damping is the air. The backplate holes are not
decoration: air squeezed through them as the diaphragm moves is a viscous loss,
and the volume behind them is a compliance. Hole size, depth and pattern are how
a capsule designer sets both the damping and, through Helmholtz resonances in
the cavities, the shape of the top end. That second effect is the "presence
bump", modelled here as a peaking filter:

```
H_pres(f) = (1 − x² + j·x·G/Q) / (1 − x² + j·x/Q),   x = f/f_pres, G = 10^(dB/20)
```

The K67 pattern gives roughly +5 dB centred near 7 kHz. Add the 9 kHz resonance
on top and you have the famous rising top end — about +8 dB in total, before any
electronics have touched it.

### What has not happened yet

No voltage. No current. A changing capacitance is not a signal until something
puts charge on it.

---

## 2. Charging the capsule

`Q = C·V`. Put a fixed charge on the capsule and hold it there; then

```
V = Q/C,   dV/V = −dC/C
```

The fractional capacitance change from lesson 1 was 3.3 × 10⁻⁴ at one pascal, so
on a capsule polarised at 60 V:

```
dV = 60 × 3.3e-4 ≈ 20 mV
```

which is a sensitivity of 20 mV/Pa — the figure the app uses for the K67 type,
and the right order for a real large-diaphragm capsule (Neumann quote 23 mV/Pa
for the TLM 103, 20 mV/Pa for a U87Ai in cardioid).

Two things follow immediately.

**Sensitivity is proportional to polarisation voltage.** Double the volts,
double the signal. Nothing downstream changes, so that is a straight 6 dB of
signal-to-noise for free.

**There is a limit, and it is worth being precise about why.** The plates attract
each other with a force proportional to V². That force acts against the
diaphragm's own tension, so raising the polarisation voltage *softens* the
diaphragm: the resonance drops, the compliance becomes voltage-dependent, and
distortion rises. Push far enough and you reach the electrostatic pull-in
instability, where the diaphragm collapses onto the backplate — classically at
one third of the gap.

What does *not* happen at 60 V is a clean-air breakdown. Paschen's law puts the
breakdown of dry air across a 25 µm gap at several hundred volts, so the gap
itself is in no danger. The practical failure mode is contamination: a dust
particle or a film of moisture bridging part of the gap gives a local discharge
path, which you hear first as crackle and which eventually burns a pinhole in
the diaphragm. That is a capsule ruined, and it is why real designs stop at
60–65 V rather than taking the free signal-to-noise on offer — and why a capsule
is stored dry.

Note also what is *not* a hazard here: the polarisation supply is fed through a
gigaohm, so it can deliver microamps. It will not hurt you. The thing at risk is
the capsule.

**Electrets** get the same effect with a permanently charged film, typically
FEP, equivalent to 100 V or so and stable for decades. No supply, no polarisation
resistor, no leakage path. The FET still needs power, which is precisely why
plug-in power exists: a few volts is useless for polarising a capsule and
perfectly adequate for a JFET.

---

## 3. Why a gigaohm

The polarisation resistor has to pass DC and nothing else. It forms a high-pass
with the capsule:

```
f_c = 1/(2π·R_pol·C_caps)
```

| R_pol | with 55 pF |
|---|---|
| 10 MΩ | 289 Hz |
| 100 MΩ | 28.9 Hz |
| 1 GΩ | 2.9 Hz |
| 10 GΩ | 0.29 Hz |

There is no way around it: to get below the audio band with tens of picofarads
you need a gigaohm. That is an unusual part — physically large, expensive, and
easily beaten by the board it is soldered to. The surface resistance of a PCB
contaminated with flux residue at 60 % relative humidity can be a few hundred
megohms, which is to say: in parallel with your gigaohm, halving it. This is why
microphone boards are washed, why the good ones are conformally coated, and why
a badly built microphone sounds different in August.

The **diaphragm-polarised** wiring adds a second corner, because the coupling
capacitor works against the gate resistor:

```
f_c2 = 1/(2π·R_gate·C_couple)
```

1 nF against 1 GΩ is 0.16 Hz — irrelevant. But C_couple also forms a *capacitive
divider* with the capsule, and that is not irrelevant:

```
loss = 20·log₁₀( C_couple / (C_couple + C_caps) )
```

1 nF against 55 pF costs 0.47 dB. 100 pF against 55 pF costs 3.8 dB, at every
frequency, permanently.

The **backplate-polarised** wiring has no coupling capacitor at all. The
diaphragm goes straight to the gate and the gate resistor holds it at 0 V, so
the gate resistor sets the low-frequency corner and the polarisation resistor —
which now feeds a backplate held at audio ground by its bypass capacitor — does
nothing but supply DC. One fewer capacitor, one fewer leakage path, one fewer
part to go microphonic. The price is that the capsule node is now unbuffered
inside the capsule body, so the body and grille have to be a real shield. See
lesson 13.

---

## 4. Thermal noise, and why the huge resistor is quiet

Johnson–Nyquist: any resistance at temperature T generates a noise voltage

```
e_n = √(4kTR·Δf)     [V]        k = 1.381e-23 J/K
```

or, equivalently, a noise current

```
i_n = √(4kT/R·Δf)    [A]
```

At 300 K, `√(4kT) = 1.29e-10`, so a 1 GΩ resistor generates 4.07 µV/√Hz — or
4.07 fA/√Hz, depending on which way you look at it.

Naively the voltage form says a gigaohm is 20 dB noisier than a hundred
megohms. In a microphone the current form is the useful one, because the
resistor is in parallel with the capsule, and the capsule is a short circuit
compared with the resistor over most of the audio band:

```
|Z_caps(f)| = 1/(2πf·C)      55 pF: 2.9 MΩ at 1 kHz, 290 kΩ at 10 kHz
```

The noise voltage the resistor actually produces at the node is `i_n × Z_node`,
where `Z_node ≈ R_pol ∥ Z_caps ≈ Z_caps` above the corner. So:

```
e_node(f) ≈ √(4kT/R) / (2πf·C)
```

Bigger R, *smaller* noise. And because the corner also moves down, the region
over which this holds gets wider. Both effects push the same way. The solver
puts R_pol at 1 GΩ contributing 3.0 dB-A to the reference build, and at 100 MΩ
contributing about 12 dB-A and dominating everything.

Bigger is quieter. It is one of the nicest results in the subject.

### The capsule hisses too

Air molecules bombard the diaphragm at random, and the air being forced through
the backplate holes is a viscous resistance — and by the fluctuation–dissipation
theorem, any dissipation is a noise source. The result is a pressure noise at
the diaphragm, equivalent to 6–10 dB-A SPL in a good large-diaphragm capsule and
14–20 dB-A in a small one (less area collecting signal, similar damping).

In a well-built LDC this is the **largest single noise source in the
microphone**, larger than all the electronics together. The app models it as a
flat pressure-noise density on the behavioural source, scaled so that on its own
it integrates to the capsule's stated dB-A figure.

---

## 5. Stray capacitance

Everything at the gate node that is not the capsule is in parallel with it:

```
divider = C_caps / (C_caps + C_stray)
```

| C_stray | loss with 55 pF |
|---|---|
| 5 pF | −0.76 dB |
| 10 pF | −1.45 dB |
| 20 pF | −2.69 dB |
| 40 pF | −4.75 dB |
| 55 pF | −6.02 dB |

Contributions: PCB pad and track (1–5 pF), the FET's own C_gs (3 pF for a J305,
**30 pF** for a 2SK170), C_gd multiplied by (1 + gain) — the Miller effect, and
usually the largest term of all in a common-source stage — and whatever moisture
and flux are doing that day.

This loss is uniquely expensive because it happens *before* the first
amplification. Everything after it amplifies signal and noise together, so a
decibel lost here is a decibel of signal-to-noise gone for good. Hence: the FET
millimetres from the capsule, the shortest possible gate track, guard rings held
at the gate potential so the leakage across them sees no voltage, and a strong
preference for not touching the inside of a microphone.

Note the trap in the FET table. The 2SK170 is the quietest device by input-
referred voltage noise and has by far the worst input capacitance. On a 55 pF
capsule its 30 pF of C_gs plus Miller can cost more signal than its lower `e_n`
buys back. The quietest transistor is not automatically the quietest microphone.

---

## 6. The impedance converter

At 20 Hz, 55 pF is 145 MΩ. Nothing you can buy has an input impedance high
enough to look at that without destroying it.

A JFET's gate is a reverse-biased p–n junction. Its leakage is picoamps — the
app's models use 10–20 pA — so it can watch the capsule node without loading it.
In exchange it gives you drain current:

```
saturation:  I_d = β(V_gs − V_p)²(1 + λV_ds),     β = I_dss/V_p²
triode:      I_d = β[2(V_gs − V_p)V_ds − V_ds²](1 + λV_ds)
```

with `V_gs > V_p` (V_p is negative for an n-channel JFET; below it the channel
is pinched off and nothing flows). Small-signal, in saturation:

```
gm  = 2β(V_gs − V_p)(1 + λV_ds)
gds = β(V_gs − V_p)²·λ
```

### Self-bias

Put a resistor in the source leg and ground the gate through a large resistor.
Drain current through R_s lifts the source above the gate, which *is* a negative
V_gs:

```
V_gs = −I_d·R_s        and        I_d = β(V_gs − V_p)²
```

Solve the pair — the app's Newton solver does exactly this, and the test suite
checks it against a fixed-point iteration to within 1 %. For a 2SK170
(I_dss 8 mA, V_p −0.5 V) with R_s = 1.5 kΩ:

```
I_d ≈ 0.28 mA,  V_gs ≈ −0.41 V,  gm ≈ 6.1 mS
```

The loop is self-correcting, which matters enormously because real JFETs vary by
±50 % on I_dss. Try the spread slider: the drain current barely moves.

### Gate leakage

The gate's reverse leakage flows through the gate resistor. At 10 pA through
1 GΩ that is 10 mV of unplanned bias — small, but real, and the same current's
shot noise (`i² = 2q·I_gss`) is injected straight into the highest-impedance node
in the microphone, where it contributes about −3.6 dB-A. This is why gate leakage
appears on JFET datasheets at all, and why it rises fast with temperature.

---

## 7. Gain and the source resistor

**Common source**: gate in, drain out, inverted.

```
A = −gm·(R_d ∥ r_ds ∥ Z_load)
```

With gm = 6.1 mS and R_d = 4.7 kΩ, that is about ×29, or 29 dB.

**Source follower**: gate in, source out, same polarity.

```
A = gm·R_s / (1 + gm·R_s) ≈ 0.9
```

No voltage gain at all. What it gives you is output impedance ≈ 1/gm — about
160 Ω here instead of 145 MΩ. That is the transformation the microphone actually
needs.

### Degeneration

An unbypassed source resistor is series negative feedback:

```
A = −gm·R_d / (1 + gm·R_s)
```

With gm·R_s = 9, the gain drops from 29 to 2.9 — and becomes almost independent
of gm, and therefore almost independent of which transistor you soldered in.
That is the trade: gain for predictability and linearity.

The bypass capacitor removes the feedback above

```
f_c = 1/(2π·R_s·C_s)
```

100 µF across 1.5 kΩ gives 1.06 Hz. 1 µF gives 106 Hz, and you have accidentally
built a bass roll-off — not down to nothing, but down to the degenerated gain,
which is why it sounds like a broad gentle loss rather than a filter.

### Bootstrapping

Split the gate resistor and drive the bottom of it from the source through a
capacitor. The source follows the gate with gain A ≈ 0.95, so both ends of the
upper resistor move nearly together, and a resistor with the same voltage at
both ends carries no current:

```
R_effective = R_gate / (1 − A)      ≈ 20 × R_gate
```

Lower corner frequency, and less of the resistor's noise current reaching the
gate. It costs one capacitor and is invisible on a schematic unless you know
what you are looking at.

---

## 8. De-emphasis

The K67 capsule arrives at the gate with roughly +8 dB of lift between 5 and
10 kHz. A U47 or U247-style board leaves it there. A U87-style board takes it
back off with a resistor and a capacitor in series from the drain to the source.

Above the turnover the capacitor is a short, so R_fb ends up in parallel with
R_d and the raw gain falls by

```
R_fb / (R_fb + R_d)
```

with the turnover at `1/(2π(R_fb + R_d)·C_fb)`. A shelf, not a slope — which is
the right shape, because a capsule bump is broad.

**But the arithmetic overpredicts it.** Reducing the gain also reduces the Miller
capacitance `C_gd(1 + A)` at the gate, which unloads the capsule and gives part
of the loss straight back. The two effects fight. In the app's reference build,
raising R_fb by a factor of ten changes the 10 kHz response by a fraction of a
decibel until C_fb is large enough for the network to dominate. This is why real
de-emphasis is tuned on a sweep rather than calculated, and why the app's default
is 1 kΩ with 22 nF rather than the tens-of-kilohms and hundreds-of-picofarads a
first-order analysis suggests.

**The network must return to the source, not the gate.** Coupling a 47 kΩ
resistor to a 100 MΩ node injects its full thermal noise current there and, by
shunt feedback, loads the capsule down to a few kilohms. Built that way the
reference microphone measures 32.6 dB-A instead of 10.7 and loses most of its
signal. Feedback goes back to low-impedance nodes. You can try it in the builder
and hear it.

---

## 9. Self-noise

Self-noise is quoted as an **equivalent input level**: the sound pressure that
would produce the same output as the microphone's own noise, A-weighted.

```
EIN(f) = N(f) / |H(f)|²                       [Pa²/Hz]
p_rms  = √( ∫ EIN(f)·|A(f)|² df ),  20 Hz–20 kHz
L      = 20·log₁₀(p_rms / 20 µPa)             [dB-A]
```

`A(f)` is the IEC 61672 A-weighting: a rough model of how insensitive hearing is
at low levels, especially in the bass. It discards most of what happens below
200 Hz, which is convenient, because that is where flicker noise lives.

The sources the solver enumerates:

| Source | Density | Where it enters |
|---|---|---|
| Any resistor | `i² = 4kT/R` | across the resistor |
| FET channel | `i² = 4kT·(2/3)·gm` | drain to source |
| FET flicker | `i² = KF·I_d/f` | drain to source |
| Gate leakage | `i² = 2q·I_gss` | gate to source |
| Capsule acoustic | flat in Pa²/Hz | the behavioural source |

Each is solved separately, at every frequency, with all the others switched off,
and the results summed as powers because they are uncorrelated. (The
implementation is a single adjoint solve per frequency, which gives the transfer
from every possible source position at once — that is why the whole analysis
takes about 45 ms.)

For the reference build:

| Source | dB-A | share |
|---|---|---|
| Capsule (acoustic) | 8.0 | 55 % |
| Gate resistor, 1 GΩ | 3.5 | 19 % |
| Polarisation resistor, 1 GΩ | 3.0 | 17 % |
| Gate leakage | −3.6 | 4 % |
| FET channel | −4.4 | 3 % |
| FET 1/f | −9.6 | 1 % |
| Everything else | below −11 | ≈ 1 % |
| **Total** | **10.6** | |

The FET, which is what everyone worries about, is 12 dB below the capsule. For
reference: a TLM 103 is specified at 7 dB-A, a good DIY U87-style build lands at
10–14, a cheap electret SDC at 18–24. Below about 6 dB-A you are fighting the air
itself.

---

## 10. Transformer output

Two coupled coils, `M = k√(L_p·L_s)`. With `L_s = L_p/n²`:

- voltage: divided by `n`
- current: multiplied by `n`
- impedance seen from the primary: multiplied by `n²`

A 7:1 transformer loses 16.9 dB of level and makes a 1.5 kΩ preamp look like
73 kΩ to the FET — which is why the FET can drive it at all. What you buy is a
balanced, galvanically isolated output and a source impedance the cable is happy
with.

### The bass corner

The primary inductance sits directly across whatever is driving it. Below the
frequency where `2πfL_p` equals the source impedance, the primary is effectively
a short:

```
f_c = R_source / (2π·L_p)
```

| driving impedance | with 20 H |
|---|---|
| 100 Ω (buffer) | 0.80 Hz |
| 1 kΩ | 8.0 Hz |
| 4.7 kΩ (bare drain) | 37 Hz |

That last row is the entire reason transformer output boards have a driver
stage. One buffer is the cheapest bass in audio.

### The bump

The output coupling capacitor and the primary inductance form a *series*
resonance:

```
f = 1/(2π√(L_p·C_out))     20 H, 10 µF → 11.3 Hz
Q = √(L_p/C_out) / R_source     ≈ 2.8 with 500 Ω
```

which puts a few decibels of lift in the bottom octave. Real, and part of why
transformer microphones are described as sounding big at the bottom.

### The top

Leakage inductance `L_p(1 − k²)` in series, winding capacitance across the
secondary. With k = 0.999 and 200 pF, and the low impedances involved, the
resulting corner is far above audio — so in the linear model the transformer's
top end is flat. Push k down or C_w up and you can bring it into the band, which
is the honest way to explore what a bad transformer does.

---

## 11. Transformerless output

Balanced means two conductors carrying the same signal in opposite polarity. The
receiver subtracts: signal doubles, anything common to both wires cancels. It
has nothing to do with impedance and nothing to do with transformers.

How much cancels is set by how well matched the two legs are. The app carries a
deliberate half-percent mismatch on the cold leg's build-out resistor and one
percent on the preamp's common-mode impedance, because with perfectly matched
legs common-mode rejection is infinite and lesson 13's ground loop would do
nothing at all.

What an electronic phase splitter cannot give you is **isolation**. A
transformer's windings share no copper; a transformerless output connects the
microphone's ground to the preamp's. Every ground-loop problem follows from that.

The output capacitors are the last high-pass. Two of them, in series around the
loop through the preamp's input, so together they behave as half of one:

```
f_c = 1 / (2π·(R_load + 2R_out)·(C_out/2))
```

47 µF each into 1.5 kΩ gives 4.3 Hz. 4.7 µF each gives 43 Hz — audible, and
dependent on the preamp, which is the next lesson.

---

## 12. The preamp is part of the microphone

**Input impedance.** Console preamps are often 1.5 kΩ; modern ones 2–10 kΩ or
switchable. On a transformerless microphone it works against the output
capacitors and moves the bass corner. On a transformer microphone it is
reflected into the primary multiplied by `n²`, where it damps the transformer —
which is why the switch is audible on some microphones and not others. The rule
of thumb is that the preamp should present at least five times the microphone's
source impedance: high enough not to load it, low enough to damp it sensibly.

**Cable capacitance.** About 100 pF per metre per leg. Against a 200 Ω source:

```
f_c = 1/(2π × 200 × C)     1 m: 8 MHz    50 m: 160 kHz
```

Inaudible, and that is the point — a low output impedance is what makes cable
length a non-issue. Run the same 50 m from the unbalanced electret output, whose
source impedance is a kilohm, and the sums start to bite.

---

## 13. Real world: hum and buzz

Every fault in the panel is a change to the netlist, solved at 50 Hz and its
harmonics along with everything else.

**Floating capsule body.** The grille is the shield around the highest-impedance
node in the microphone. Break its path to ground and the mains field couples in
through a few femtofarads of air. A few femtofarads is nothing; the capsule node
is a hundred-megohm source, so nothing is enough. Smooth hum, because a field is
close to a clean sine, and worse when you bring your hand near — because your
hand is part of the coupling capacitor.

**Ground loop.** Two paths to earth, one loop, mains current circulating in the
cable screen. The voltage it develops appears between the microphone's ground
and the preamp's, as common mode. Buzz rather than hum, because mains current
has been through rectifiers all over the building and is full of odd harmonics.
On a balanced output almost all of it cancels; switch to unbalanced and it is
deafening. That comparison is the whole argument for balanced lines.

**Radio frequency.** A microphone cable is a good antenna at 900 MHz. RF is far
outside the audio band and would be harmless — except that a semiconductor
junction is a rectifier, so the FET demodulates it. What you hear is the
envelope: a GSM handset transmits 217 bursts per second, hence a buzz at 217 Hz
and its harmonics. The cure is two 100 pF capacitors at the connector, shorting
RF to the shield before it reaches anything that rectifies.

**Cold solder joint.** A dull grey joint is not a connection, it is a variable
resistor made of tin oxide. It turns the screen into a partial antenna, and
because its resistance changes as the cable moves, the hum comes and goes.

**Stray capacitance and PCB leakage.** Lessons 5 and 3, as faults. Note that
leakage does three things at once: raises the low-frequency corner, adds its own
thermal noise, and — because it forms a DC divider with the polarisation
resistor — pulls the actual voltage on the capsule down, so the microphone gets
quieter as well as thinner. The operating-point tab shows the real polarisation
voltage, and it is not the number on the slider.
