# Mic Lab — Virtual Condenser Mic Builder
## Claude Code handoff specification (v1, September 2026)

> Working title "Mic Lab". Rename freely.
> This document is written for two readers: Claude Code, who will build it, and Sadon, who is learning electronics through it. Every technical decision has its reasoning next to it, so the *why* survives the handoff.

---

## 1. What this is

A browser app in which you build a condenser microphone stage by stage — capsule, polarisation, impedance converter, output — from real components with real values, then upload an audio file and hear it through the mic you built. Every change you make is heard immediately and shown on a frequency-response graph, and a plain-language panel explains what physically happened.

The point is not to design mics. The point is to *understand* them: why the polarisation resistor is a gigaohm, what a JFET actually does, why two boards with the same capsule sound different, and where hum and hiss come from.

### 1.1 What makes it different from a "mic emulation" plugin

The audio is not produced by an EQ curve someone drew. It is produced by a **circuit solver**: the app holds a netlist (a list of components and how they are wired), solves the circuit the way SPICE does, and derives the frequency response, the self-noise and the hum from that solve. Change a capacitor, the matrix changes, the sound changes. Nothing is faked, so the app will still be right when you wire something the author didn't anticipate.

### 1.2 Decisions already made (do not reopen without asking Sadon)

| Decision | Choice | Reason |
|---|---|---|
| Simulation | Real circuit solver (Modified Nodal Analysis, operating point + AC analysis) from v1 | Learning goal is *why*; a hand-written filter model would only teach the author's assumptions |
| Learning structure | Lesson track (Concept → Listen → Explore → Quiz) per stage **plus** a free build mode | Same loop as Synthwise, which worked for Sadon |
| Freedom in v1 | Edit component values and swap between a few fixed circuit *variants* per stage | Fixed topologies guarantee the solver converges; free-form schematic editing is Phase 3 |
| Nonlinear behaviour (transformer / FET saturation) | Later — Phase 4, as transient simulation | Not needed to learn the linear fundamentals; needs a Wasm solver in an AudioWorklet |
| Stack | React + TypeScript + Vite, Web Audio API, solver in plain TypeScript | Same as Synthwise; no Wasm until Phase 4 |
| Mains frequency | 50 Hz | Belgium |

### 1.3 Reference hardware

These become **presets** and must sound like the real thing as far as the linear model allows:

- **Raven** — Sadon's DIY large-diaphragm mic: U247-style board with output transformer, **backplate-polarised**, 797AUDIO CY002 (K67-type) capsule.
- **Blue Jay** — Sadon's DIY large-diaphragm mic: U87-style **transformerless** board, same CY002 capsule.
- **SDC build** — Sadon's small-diaphragm electret build (electret capsule + prewired board in an e614-clone body). Useful because electrets have no external polarisation, which makes the polarisation lesson concrete by contrast.

Comparison curves (magnitude only, used for A/B listening, not simulated): **Neumann TLM 103**, **Universal Audio Sphere** (in its neutral/"flat" mode).

> **Preset capture checklist for Sadon** (do this before or during Phase 1 — Claude Code cannot know these values): for each of Raven and Blue Jay, note from the board/schematic: polarisation voltage and resistor; JFET type; gate resistor; coupling cap between capsule and gate; source resistor and bypass cap; drain resistor; any de-emphasis RC; output coupling caps; transformer type/ratio (Raven). Where unknown, the defaults in §3 are used and flagged "unverified" in the preset.

---

## 2. The learning model

### 2.1 Lesson loop (from Synthwise)

Each lesson runs **Concept → Listen → Explore → Quiz**:

1. **Concept** — one screen, plain language, one diagram. What this stage does and the single physical idea behind it.
2. **Listen** — the current build is played with the concept toggled or swept (e.g. polarisation resistor 1 GΩ vs 100 MΩ) so the ear gets it before the maths.
3. **Explore** — the builder opens with only this lesson's components unlocked. Free experimentation with live graph and audio; the explanation panel narrates.
4. **Quiz** — 3–5 questions, mixing "predict the sound" (choose which of two clips is the 100 MΩ version) and conceptual questions.

### 2.2 Lesson list (Phase 2 content)

Order follows the signal path. Each lesson names the components it unlocks.

| # | Lesson | Unlocks | Core idea |
|---|---|---|---|
| 1 | The capsule is a capacitor | Capsule variant, diaphragm tension, gap | Sound moves the diaphragm → capacitance changes. Nothing electrical happens yet. |
| 2 | Charging the capsule | Polarisation voltage | Q = C·V. Hold Q constant, change C, and V changes: that *is* the signal. Louder with more volts. |
| 3 | Why a gigaohm | Polarisation resistor | The resistor must be so large that charge can't leak away within one cycle of the lowest note. R·C sets a high-pass corner. |
| 4 | Thermal noise, and why the huge resistor is *quiet* | (same, plus noise view) | Every resistor hisses (4kTR). But the capsule's capacitance shorts out that hiss above the corner — the bigger R, the lower the corner, the less noise gets through. Counter-intuitive and true. |
| 5 | Stray capacitance | Wiring capacitance | Every pF next to the gate is a divider against the capsule's ~60 pF. Why wires are short and PCBs have guard rings. |
| 6 | The impedance converter | JFET stage variant, gate resistor, coupling cap | The capsule can't deliver current. The FET copies the voltage onto a low-impedance node. Gate bias, operating point. |
| 7 | Gain and the source resistor | Source R, bypass cap, drain R | Common-source vs source-follower. Bypass cap sets where gain kicks in. |
| 8 | De-emphasis: taming the K67 peak | De-emphasis RC | Same capsule, different board, different sound. Frequency-dependent negative feedback. Raven vs Blue Jay. |
| 9 | Self-noise | (noise view) | Where hiss comes from: FET channel noise, 1/f noise, resistors. How to read "dB-A". |
| 10 | Transformer output | Transformer variant, ratio | Coupled inductors, ratio → level and impedance, primary inductance → LF corner. |
| 11 | Transformerless output | Balanced driver variant, output caps | Why balanced, what the output caps do, why the preamp's input impedance changes the sound. |
| 12 | The preamp is part of the mic | Preamp load, cable capacitance | 1.5 kΩ vs 10 kΩ input impedance; long cables. |
| 13 | Real world: hum and buzz | Fault panel | Floating capsule body, leaky charger ground, missing RF caps, bad shield joint. |

### 2.3 Free build mode

All stages open, all variants and values editable, presets loadable, A/B against reference curves. Same explanation panel, now narrating whatever you touched last.

---

## 3. The four stages, their variants, and their components

Every build is **one variant per stage**, chained in order. A variant is a fixed sub-netlist with named, editable component values. The user never adds or removes components in v1; they change values and swap variants. Each component has a range, a default, a unit, and a one-sentence "what it does" string shown on hover.

Values below are sensible textbook/DIY-typical starting points. Presets (§7) override them. Anything marked *(verify)* should be checked against Sadon's boards.

### 3.1 Stage A — Capsule

The capsule is modelled as an **electro-mechanical transducer**, not as an EQ curve. Physically: a stretched diaphragm (mass, stiffness, damping) moves in response to sound pressure; its movement changes the gap to the backplate and therefore the capacitance. With constant charge, the voltage across the capsule follows the displacement.

In the netlist the capsule is:

- a **capacitor** `C_caps` (the static capacitance, diaphragm ↔ backplate),
- in series with a **behavioural voltage source** `E_caps` whose value at frequency f is
  `E_caps(f) = S0 · (V_pol / V_ref) · H_mech(f) · P_in`
  where `P_in` is the sound pressure (1 Pa reference), `S0` is the open-circuit sensitivity at reference polarisation voltage, and `H_mech(f)` is the diaphragm's second-order mechanical response with resonance `f_res` and quality factor `Q_res`, plus an optional second, gentler resonance term for the K67-family presence bump.

Why a behavioural source instead of a true LCR mechanical analogue: identical result in AC analysis, far simpler to explain and to tune, and it still lives inside the solver so polarisation voltage and loading act on it correctly. (Phase 4 may replace it with a mechanical-analogue network so that nonlinearity can be added.)

| Variant | Description | C_caps | S0 @ V_ref | f_res / Q | Presence term | Notes |
|---|---|---|---|---|---|---|
| **K67-type** (CY002) | 34 mm dual-diaphragm, centre-terminated, K67 hole pattern | 55 pF *(verify)* | 20 mV/Pa @ 60 V | ~ 9 kHz / 1.5 | +5 dB bump centred ~ 7 kHz, Q ≈ 1 | The famous rising top; U87 boards de-emphasise it, U247/U47-style boards don't |
| **K47-type** | Single backplate, edge-terminated | 65 pF | 18 mV/Pa @ 60 V | ~ 10 kHz / 1.2 | +3 dB bump ~ 4–5 kHz, broad | Flatter mids, gentle top |
| **K87-type** | Like K67 but dual backplate, electrically separate halves | 55 pF | 20 mV/Pa @ 60 V | as K67 | as K67 | Same acoustics, different wiring: enables the "backplate-polarised" variant lesson |
| **SDC electret** | 16 mm, permanently charged | 25 pF | 8 mV/Pa (built-in charge) | ~ 14 kHz / 1.0 | small +2 dB ~ 10 kHz | No external polarisation possible; capsule has an inherent equivalent voltage |
| **Ideal flat** | Teaching reference | 60 pF | 20 mV/Pa @ 60 V | none | none | For isolating what the electronics do |

Each capsule also carries an **acoustic self-noise** figure `N_ac` (dB-A equivalent SPL): the diaphragm's own thermal motion and the air damping behind it hiss too, and in a real large-diaphragm mic this is the *largest* noise source, larger than the electronics. Defaults: K67/K47/K87-type 8 dB-A, SDC electret 14 dB-A, ideal flat 0. It enters the noise analysis (§4.6) as a pressure-noise term on the behavioural source. Without it, every build would come out unrealistically quiet (a check in §4.8 catches that).

Editable per capsule: `f_res`, `Q_res`, `presence gain`, `C_caps`, `N_ac`. Polar pattern is **cardioid only in v1** (rear diaphragm is ignored except as capacitance where the wiring variant needs it). Omni/figure-8 switching is a later addition — it's a polarisation-wiring lesson, and a good one, but it needs the second diaphragm modelled acoustically.

### 3.2 Stage B — Polarisation

Supplies the DC charge to the capsule through a very large resistor, and connects the capsule's signal to the impedance converter.

Modelled as: DC voltage source `V_pol` → `R_pol` → capsule node; capsule node → `C_couple` → FET gate (in diaphragm-polarised builds), or the diaphragm goes straight to the gate and the backplate carries the voltage (backplate-polarised, Raven).

| Variant | Wiring | Default values | Teaching point |
|---|---|---|---|
| **Diaphragm-polarised** (classic U87/U47 FET style) | V_pol → R_pol → diaphragm; diaphragm → C_couple → gate; backplate to ground | V_pol 60 V, R_pol 1 GΩ, C_couple 1 nF | The coupling cap with the gate resistor forms a second high-pass; both corners matter |
| **Backplate-polarised** (Raven) | V_pol → R_pol → backplate; diaphragm → gate directly (gate held at ~0 V by R_gate) | V_pol 60 V *(verify)*, R_pol 1 GΩ | No coupling cap needed → one fewer high-pass, one fewer leakage path. Capsule body/grille grounding becomes critical (feeds the fault lesson) |
| **Electret** (SDC build) | No external V_pol; capsule has fixed built-in equivalent voltage; diaphragm → gate; R_gate only | V_equiv ~ 100 V fixed, not editable | Why an electret mic still needs phantom power (for the FET, not the capsule) |

Editable: `V_pol` (20–120 V), `R_pol` (10 MΩ–10 GΩ, log scale), `C_couple` (100 pF–10 nF).

Where V_pol comes from (48 V phantom → voltage doubler/regulator) is **not modelled** in v1: the user sets V_pol directly. The lesson text explains the multiplier; simulating it is a Phase 3+ variant.

### 3.3 Stage C — Impedance converter

The JFET stage. This is the only nonlinear component in the circuit and the reason the solver needs an operating-point step (§4).

| Variant | Topology | Default values | Character |
|---|---|---|---|
| **Common-source with de-emphasis** (U87-style, Blue Jay) | Gate ← R_gate to bias node; source R_s with bypass C_s; drain R_d to supply; frequency-dependent negative feedback via series R_fb–C_fb from drain back to gate/source *(verify exact node on Blue Jay board)* | R_gate 1 GΩ, R_s 1.5 kΩ, C_s 100 µF, R_d 4.7 kΩ, R_fb 47 kΩ, C_fb 470 pF | Gain > 1, top end shelved down to counter the K67 peak |
| **Common-source, no de-emphasis** (U247/U47-FET style, Raven) | Same without the feedback RC | as above, R_fb/C_fb absent | The K67 bump comes through — brighter, "forward" |
| **Source follower** (Schoeps-style) | Drain to supply directly; output from source; R_s to ground | R_gate 1 GΩ, R_s 2.2 kΩ | Gain ≈ 1, very linear, low output impedance; needs an output stage with gain or a transformer |
| **Bootstrapped source follower** | As above, plus C_boot from source back to the bottom of R_gate | + C_boot 1 µF, R_gate split 1 GΩ / 10 MΩ | Effective gate resistance rises far above R_gate → lower corner, less noise from R_gate. Elegant lesson |

Common to all: `JFET model` selector (2SK170, 2SK209, 2N3819, J305 — Shichman–Hodges parameters in §4.3), `C_stray` (wiring/PCB capacitance at the gate node, 0–50 pF, default 5 pF), supply voltage `V_dd` (fixed per output variant; typically 10–20 V derived from phantom).

Editable: everything in the table plus `C_stray`. The supply itself is an ideal DC source in v1.

### 3.4 Stage D — Output

| Variant | Model | Default values | Teaching point |
|---|---|---|---|
| **Transformer** (Raven) | Driver buffer (ideal unity-gain VCVS with output resistance R_drv, standing in for the emitter/source follower real transformer boards have) → coupling cap C_out → primary (L_p, R_p) ; secondary (L_s = L_p / n², R_s) with winding capacitance C_w across secondary; ideal coupling k | R_drv 100 Ω (option "none — drive straight from the FET drain", which uses R_d ≈ 4.7 kΩ as the source impedance), C_out 10 µF, n = 7:1 (options 5:1, 7:1, 10:1), L_p 20 H, R_p 400 Ω, R_s 30 Ω, C_w 200 pF, k 0.999 | Ratio sets level (÷n) and impedance (÷n²); L_p with the *source* impedance sets the LF corner — 20 H driven from 100 Ω gives 0.8 Hz, driven straight from a 4.7 kΩ drain gives 37 Hz, which is exactly why transformer boards have a driver stage; leakage/C_w set the HF corner |
| **Transformerless balanced** (Blue Jay) | Phase splitter modelled as two ideal opposite-polarity dependent sources driving C_out+ / C_out− and R_out+ / R_out− | C_out 47 µF, R_out 47 Ω each | Balanced output from an unbalanced signal; the output caps + preamp load form the last high-pass |
| **Unbalanced / plug-in-power** (for the electret lesson) | Single C_out and R_out | C_out 10 µF, R_out 1 kΩ | Contrast case only |

Always present after the output stage — the **load**: `R_preamp` (1.5 kΩ / 2.4 kΩ / 10 kΩ / custom), `C_cable` (cable capacitance, 100 pF/m × length 1–50 m). Output of the whole simulation is the differential voltage across R_preamp.

Why the phase splitter is idealised: the real Blue Jay output uses a transistor pair whose linear behaviour is close enough to "two unity-gain buffers with opposite polarity". Modelling it transistor-by-transistor adds a second operating-point solve and teaches nothing new in v1. Phase 4 (saturation) will need the real thing.

### 3.5 Real-world fault panel (Lesson 13, and available in free build)

Faults are **extra netlist elements**, not sound effects. Each one is switched in by adding components to the same netlist the solver already handles, so hum and buzz come out of the same solve as the signal.

| Fault | Netlist change | What you hear | Explanation shown |
|---|---|---|---|
| Capsule body / grille floating | Backplate node coupled to a 50 Hz mains-voltage source (230 V) through 2 pF; body-to-ground path replaced by 10 MΩ | Low hum, worse when you approach the mic | The grille is your shield; without a ground path, mains fields capacitively couple straight into the highest-impedance node in the mic |
| Leaky charger / ground loop on the preamp side | 50 Hz current source (with 3rd, 5th, 7th harmonics) injected into the cable shield node through the shield resistance | Buzz (harmonic-rich) | Current flowing in the shield creates a voltage that the preamp can't fully reject |
| Missing RF caps at the XLR | Removes the 100 pF caps from pins 2/3 to shield; injects a GSM-like burst envelope on a 217 Hz-modulated carrier (synthesised, since RF itself is outside the audio band — the *demodulated* result is what's audible) | "dit-dit-dit" phone buzz | RF rides in on the cable and the FET rectifies it |
| Cold solder on the shield | Shield resistance 0.1 Ω → 500 Ω, plus random contact modulation | Crackle, intermittent hum | Same as ground loop, but variable |
| Too much stray capacitance | C_stray 5 pF → 40 pF | Quieter and slightly duller | Capacitive divider against the capsule |
| Low polarisation resistor (leaky, dirty PCB) | R_pol 1 GΩ → 50 MΩ (dirty board modelled as parallel leakage) | Thin bass, more hiss | Flux residue and humidity are resistors too |

---

## 4. The solver

Pure TypeScript, no dependencies beyond a small complex-number helper. Runs in a **Web Worker** so the UI never stalls. Must be developed **first** and tested against known answers before any UI exists (Phase 0).

### 4.1 Netlist representation

```ts
type NodeId = number;            // 0 is always ground
interface Element { id: string; kind: ElementKind; nodes: NodeId[]; params: Record<string, number>; stage?: StageId; label?: string }
type ElementKind =
  | 'R' | 'C' | 'L'                       // passive
  | 'K'                                   // coupled inductors (transformer): params { L1, L2, k } referencing two 'L' ids
  | 'V' | 'I'                             // independent DC sources
  | 'VAC' | 'IAC'                         // independent AC sources (signal, hum), params { amplitude, phase, freq? }
  | 'E_BEHAV'                             // behavioural AC voltage source: value = fn(f) supplied by the capsule model
  | 'VCVS' | 'VCCS'                       // dependent sources (ideal phase splitter, buffers)
  | 'JFET';                               // nonlinear; params from §4.3
interface Netlist { elements: Element[]; nodeCount: number; probes: { outPlus: NodeId; outMinus: NodeId } }
```

The four stage variants each produce a fragment with named ports (`in`, `out`, `gnd`, `vdd`); the builder concatenates fragments by renumbering nodes. Every element remembers its `stage` so the UI can highlight and the explanation engine can attribute.

### 4.2 Modified Nodal Analysis, in plain words

Kirchhoff's current law says the currents into any node sum to zero. For every non-ground node write that equation with the unknown node voltages; that's a system of linear equations `G · v = i`. "Modified" means voltage sources and inductors, which don't fit the "current = admittance × voltage" pattern, get an extra unknown (their branch current) and an extra row. Standard stamps:

- Resistor R between a, b: add `1/R` to G[a][a], G[b][b]; subtract from G[a][b], G[b][a].
- Capacitor C in AC analysis: same stamp with admittance `jωC`.
- Inductor L in AC analysis: extra branch current unknown; stamps for `v_a − v_b − jωL·i = 0`. Coupled pair adds `±jωM` between the two branch rows, `M = k·√(L1·L2)`.
- Voltage source: extra unknown current; row `v_a − v_b = V`.
- VCCS (gm): add `gm` at [out+][ctrl+], [out−][ctrl−]; subtract at the cross terms.
- JFET small-signal (AC): VCCS `gm` from gate-source to drain-source, conductance `gds` drain-source, capacitors `Cgs`, `Cgd`.

Solve with LU decomposition with partial pivoting. Matrices are ≤ ~40×40; performance is not a concern in v1.

### 4.3 JFET model (Shichman–Hodges)

Two regions, for `V_gs > V_p` (else `I_d = 0`):

- Saturation (`V_ds ≥ V_gs − V_p`): `I_d = β · (V_gs − V_p)² · (1 + λ·V_ds)`
- Triode (`V_ds < V_gs − V_p`): `I_d = β · [2(V_gs − V_p)·V_ds − V_ds²] · (1 + λ·V_ds)`

with `β = I_dss / V_p²`. Small-signal in saturation: `gm = 2·β·(V_gs − V_p)·(1+λV_ds)`, `gds = β·(V_gs − V_p)²·λ`. Gate capacitances `Cgs`, `Cgd` treated as fixed values from the table (junction-voltage dependence is a Phase 4 nicety). Gate leakage `I_gss` included as a tiny current source at the gate — it matters, because it flows through R_gate = 1 GΩ and shifts the bias (1 nA × 1 GΩ = 1 V; a real effect and a real lesson).

| Device | I_dss (mA) | V_p (V) | λ (1/V) | Cgs (pF) | Cgd (pF) | I_gss (pA) | Noise: e_n at 1 kHz | Notes |
|---|---|---|---|---|---|---|---|---|
| 2SK170 (BL) | 8 | −0.5 | 0.005 | 30 | 6 | 10 | ~1 nV/√Hz | Classic low-noise audio JFET; high Cgs is a stray-capacitance lesson in itself |
| 2SK209 (GR) | 4 | −0.6 | 0.01 | 13 | 3 | 10 | ~1.2 nV/√Hz | SMD successor |
| 2N3819 | 6 | −2.5 | 0.02 | 4 | 1.5 | 20 | ~4 nV/√Hz | Cheap general-purpose; noisier, lower Cgs |
| J305 | 5 | −2.0 | 0.015 | 3 | 1 | 15 | ~3 nV/√Hz | Common in DIY mic kits |

Values are datasheet-typical, not measured; each JFET also gets a `spread` slider (±50 % on I_dss) so the "why does every unit sound a bit different / why do people match FETs" lesson is available.

### 4.4 Operating point (DC)

1. Replace capacitors by open circuits, inductors by shorts, AC sources by zero.
2. Start from a guess (`V_gs = V_p / 2`).
3. Newton–Raphson: linearise the JFET at the current guess (companion model: current source + conductance), solve the linear MNA system, update, repeat until the largest node-voltage change is < 1 µV or 100 iterations.
4. If it fails to converge, retry with **source stepping** (ramp V_dd from 0 to full in 10 steps, each starting from the previous solution). Fixed v1 topologies converge trivially, but implement source stepping anyway — it's ten lines and Phase 3 will need it.
5. Store the operating point (`V_gs`, `V_ds`, `I_d`, `gm`, `gds`) — the UI shows it, because "where is the FET biased" is Lesson 6.

### 4.5 AC analysis

For each frequency in a **log-spaced grid of 512 points, 5 Hz – 40 kHz**: build the complex MNA matrix with the linearised JFET, set the capsule's behavioural source to its value at that frequency with `P_in = 1 Pa`, solve, read `H(f) = v(outPlus) − v(outMinus)` in volts-per-pascal. This *is* the mic's sensitivity curve; `20·log10(|H(f)| / |H(1 kHz)|)` is the normalised response graph and `20·log10(|H(1 kHz)| / 1 V)` is the sensitivity in dBV/Pa (also shown as mV/Pa — the number on a datasheet).

Per-stage attribution for the graph and explanation: also solve with the same netlist but each stage in turn replaced by its "ideal" version (e.g. polarisation stage with R_pol = ∞, C_couple = ∞). The difference between that curve and the full curve is "what this stage contributes". Cheap (4 extra solves) and exactly what the explanation panel needs.

### 4.6 Noise analysis

Same machinery, one source at a time:

- Every resistor R: current noise source `i_n² = 4kT/R` (A²/Hz) across it, T = 300 K.
- JFET: channel noise `i_d² = 4kT·(2/3)·gm` at the drain; flicker term `i_d² += KF·I_d / f` (choose KF per device so the 1/f corner lands near 100–300 Hz for the 2SK170, higher for the 2N3819); gate shot noise `i_g² = 2·q·I_gss` at the gate (this one flows through the gigaohm network — it's why gate leakage matters for noise).
- Capsule acoustic noise: a pressure-noise term on the behavioural source, flat-ish in Pa²/Hz, scaled so that on its own it integrates to the capsule's `N_ac` dB-A. It goes through the same `H(f)` as the signal.
- For each source at each frequency: solve with only that source active, take `|v_out|²`. Sum all contributions (they are uncorrelated) → output noise density `N(f)` in V²/Hz.

Expected magnitudes (hand-checked while writing this spec, using a 55 pF capsule, 20 mV/Pa, a 2SK170): the polarisation/gate resistors at 1 GΩ contribute about 4 dB-A on their own; the FET alone under −5 dB-A; the capsule's acoustic noise ~8 dB-A. So a healthy build lands around 9–10 dB-A and the *capsule* dominates — the surprise for Lesson 9 is that the FET, which everyone worries about, is nowhere near the top. Drop R_pol to 100 MΩ and the resistor jumps to ~14 dB-A and takes over; that's the Listen demo for Lessons 4 and 9.

Then:

- **Equivalent input noise** `N(f) / |H(f)|²` in Pa²/Hz — the noise "as if it were sound".
- **Self-noise in dB-A**: apply the A-weighting curve, integrate 20 Hz–20 kHz, take √, convert to SPL: `L = 20·log10(p_rms / 20 µPa)`. Datasheet number; must come out in the right ballpark (TLM 103: 7 dB-A; a good DIY U87-style: 10–14 dB-A; a cheap electret SDC: 18–24 dB-A). This is a **verification target** in Phase 0.
- **Noise breakdown pie**: which source dominates (capsule / R_pol / R_gate / FET channel / FET flicker / gate leakage / output stage).

### 4.7 Hum and fault analysis

The fault panel adds AC sources at 50 Hz and harmonics (§3.5). Solve at exactly those frequencies (50, 150, 250, 350 Hz) with the signal source off; the resulting output amplitudes drive oscillators in the audio engine (§5.4). Also shown as a number: hum in dB below 1 Pa sensitivity, so it can be compared with the self-noise.

### 4.8 Verification (Phase 0 exit criteria)

Written as unit tests in `solver/__tests__`:

1. Single RC high-pass: |H| at the corner = −3.01 dB ± 0.01, slope 6 dB/octave below.
2. RC low-pass, LC resonance (Q check), transformer ratio (n:1 gives 1/n in level, n² in impedance seen from the primary).
3. JFET operating point for a textbook common-source stage matches a hand calculation within 1 %.
4. Full "reference build" (K67 + diaphragm-polarised + U87-style + transformerless + 1.5 kΩ) response matches an **ngspice** run of the equivalent netlist within 0.1 dB across 20 Hz–20 kHz. Claude Code: generate the ngspice netlist from the same fragments, run it once in the dev environment, commit the resulting CSV as the golden file.
5. Self-noise of the reference build lands between 8 and 14 dB-A, and with the capsule's `N_ac` set to 0 the electronics alone land between 2 and 6 dB-A (this catches a missing or mis-scaled noise source either way).
6. Solve time for one full AC sweep + noise analysis < 100 ms in the worker (informational, not blocking).

---

## 5. Audio engine (Web Audio)

### 5.1 Principle

In v1 the circuit is linear, so "hearing the file through the mic" means **convolving the file with the mic's impulse response**. The impulse response is derived from the complex `H(f)` the solver already produced. Phase 4 replaces this block with sample-by-sample transient simulation; everything around it stays.

### 5.2 Signal chain

```
AudioBufferSource (uploaded file, mono-summed)
  → GainNode "input SPL"  (user sets what SPL the file represents: 74 / 94 / 114 dB; scales the pascals)
  → ConvolverNode "mic"    (IR from solver; normalised so 94 dB SPL @ 1 kHz → the build's actual sensitivity)
  → GainNode "preamp"      (fixed 40 dB, plus user trim; makes the level differences between builds audible but keeps loud builds from clipping)
  + NoiseSource → ConvolverNode "noise shaping" → same preamp gain   (§5.3)
  + Hum oscillators → same preamp gain                              (§5.4)
  → A/B switch → Reference-curve ConvolverNode (bypassed when not comparing)
  → Master limiter (DynamicsCompressorNode as safety) → destination
```

Levels are **absolute**, deliberately: a build with a 7:1 transformer *is* 17 dB quieter than a transformerless one, and the user should hear that, then turn up the preamp trim — exactly as in real life. The explanation panel says so the first time it happens.

### 5.3 Impulse response from H(f)

1. Interpolate the 512-point log-grid `H(f)` (complex, magnitude and phase separately, phase unwrapped) onto a linear grid of `N/2 + 1` bins for `N = 65536` at the AudioContext sample rate. Below 5 Hz extrapolate with the lowest-bin slope; above 40 kHz hold.
2. Inverse real FFT → 65536-sample impulse response (~1.4 s at 48 kHz). That length is needed because a ~3 Hz corner has a long tail; anything shorter smears the bass lesson.
3. Apply a half-Hann taper over the last 10 % to remove wrap-around.
4. Load into the ConvolverNode with `normalize = false` (we want the absolute level).

The solver already returns a causal, physically realisable `H(f)` (it came from a real circuit), so the IFFT yields a causal IR without needing minimum-phase tricks. Test: an IR from a single RC high-pass, re-analysed by FFT, must match the analytic curve within 0.2 dB down to 10 Hz.

Rebuild latency target: value change → new IR audible within 150 ms. Crossfade between the old and new ConvolverNode over 50 ms to avoid clicks.

### 5.4 Noise and hum

- **Noise**: a looping white-noise AudioBuffer (10 s, generated once) into a second ConvolverNode whose IR is derived from the output-noise density `N(f)` (as a magnitude-only, zero-phase 4096-tap FIR — noise has no meaningful phase). Level calibrated so the A-weighted result equals the computed self-noise. Toggle "Noise" on the transport bar; default on, because the point is to hear it.
- **Hum/faults**: OscillatorNodes at 50/150/250/350 Hz with amplitudes from §4.7. The GSM burst is a pre-rendered buffer gated by an envelope. Toggle per fault.

### 5.5 Reference mics (A/B)

TLM 103 and Sphere are **magnitude curves only** (from published frequency-response plots, digitised into 64-point tables in `data/references/*.json`, marked "approximate"). They are applied as a minimum-phase FIR (cepstral method — one small function) so they can be compared against a build at matched 1 kHz level. Self-noise for references is a fixed number (TLM 103: 7 dB-A) used to add shaped noise for a fair A/B.

The A/B is level-matched at 1 kHz by default, with an "absolute level" option that turns matching off (so you can hear that a K67 through a 10:1 transformer needs more gain than a TLM 103).

### 5.6 File handling

Accept WAV/AIFF/MP3/FLAC/M4A via `decodeAudioData`. Files stay in memory only; nothing uploaded anywhere. Ship three built-in demo files (speech, acoustic guitar, drum loop — royalty-free, ≤ 10 s each) so the lessons work without an upload. Loop playback by default.

---

## 6. UI

Desktop-first (this is a studio-desk tool), usable on a tablet. Single-page app, three panes plus a transport bar. Visual identity: keep the Synthwise family look (Sadon's other education app) so the two feel like siblings — same type, same spacing scale, a distinct accent colour (suggest a warm copper, as in PCB traces, vs. Synthwise's accent).

```
┌──────────────────────────────────────────────────────────────────────┐
│  Mic Lab   [Lessons ▾]  [Free build]  Preset: Blue Jay ▾   [Save] [A/B]│
├─────────────────────────┬────────────────────────────────────────────┤
│ SCHEMATIC               │ RESPONSE                                   │
│ (SVG, whole mic, the    │ 20 Hz–20 kHz log axis, ±20 dB              │
│  active stage bright,   │ full curve + per-stage contribution shading │
│  others dimmed; click   │ + capsule-only dotted + reference curve     │
│  a component to select) │ tabs: Response | Noise | Operating point    │
├─────────────────────────┼────────────────────────────────────────────┤
│ STAGE STRIP             │ EXPLANATION                                 │
│ Capsule › Polarisation ›│ "You raised R_pol from 100 MΩ to 1 GΩ.      │
│ Converter › Output      │  The polarisation high-pass moved from 29 Hz │
│ [variant selector]      │  to 2.9 Hz. Bass below 30 Hz is back, and    │
│ [component sliders]     │  hiss dropped 4 dB because ..."              │
├─────────────────────────┴────────────────────────────────────────────┤
│ ▶ ■  demo: guitar ▾  [upload]  SPL: 94 ▾  preamp: +40 dB  [Noise ✓] [Faults ▾]  │
└──────────────────────────────────────────────────────────────────────┘
```

Component sliders: log scale for R, C, L; show the value with the engineering prefix and, next to it, the **derived quantity** the lesson cares about (e.g. next to R_pol: "corner 2.9 Hz"; next to the transformer ratio: "−16.9 dB"). Typing a value directly is allowed.

Schematic: hand-drawn SVG per variant fragment (not auto-routed — auto layout looks bad and the fragments are few). Each component's SVG group carries `data-element-id` so selection, highlight and hover explanations work from one lookup.

Lesson mode wraps the same screen: a side drawer with the lesson text; components outside the lesson are visible but locked (greyed, with "unlocked in lesson N" on hover).

Explanation panel is the heart of the teaching. It is driven by an **explanation engine**, not free text:

- Each stage variant declares *derived quantities* with formulas over its components (`f_hp_pol = 1/(2π·R_pol·C_caps)`, `gain_cs = gm·R_d`, `loss_stray = 20·log10(C_caps/(C_caps+C_stray))`, …) and a template sentence per quantity.
- On every change the engine diffs the derived quantities and the solver's per-stage curves, and renders the 1–3 templates whose quantity changed most, with old → new values, plus one sentence from the solver's data ("Overall: +0.4 dB at 40 Hz, −0.1 dB at 10 kHz, self-noise 12.3 → 11.1 dB-A").
- Every template ends with a "Why?" expander holding the longer explanation (the Concept text of the relevant lesson).

State: URL-encodable build (query string of variant ids + values) so a build can be shared or bookmarked; localStorage for lesson progress and saved builds; export/import as JSON.

---

## 7. Presets

`data/presets/*.json`. A preset = one variant per stage + component values + metadata (`name`, `description`, `verified: boolean`, per-component `verified` flags so the UI can show "(assumed)").

- `raven.json` — K67-type, backplate-polarised, common-source without de-emphasis, transformer 7:1 *(all values to be filled in by Sadon from the U247 board; ship with defaults marked unverified)*
- `bluejay.json` — K67-type, diaphragm-polarised, common-source with de-emphasis, transformerless *(same)*
- `sdc-electret.json` — SDC electret, electret polarisation, source follower, unbalanced/plug-in-power
- `textbook-u87.json` — the reference build from §4.8, all values verified against ngspice
- `textbook-schoeps.json` — SDC-style: source follower + transformerless
- `blank.json` — ideal flat capsule, all stages at their most transparent values; the "hear only the electronics" starting point

A "Tune to reference" helper (Phase 2, nice-to-have): show the TLM 103 curve behind the current build and let the user chase it by hand. No auto-fit — the fitting is the learning.

---

## 8. Phases

Each phase ends with something Sadon can open and use. Do not start a phase's UI polish before its exit criteria pass.

### Phase 0 — Solver core (no UI)
- Netlist types, MNA stamps, LU solve, complex helper.
- JFET model, operating point with Newton + source stepping.
- AC sweep, per-stage attribution, noise analysis, hum analysis.
- Stage fragments for all variants in §3 (as code producing netlists).
- All §4.8 tests green, including the ngspice golden file.
- A tiny dev page: choose preset, see the response curve as a bare SVG polyline and the numbers (sensitivity, self-noise, operating point). This is the first thing Sadon looks at.

### Phase 1 — Free build with sound
- Three-pane UI from §6, schematic SVGs for every variant, sliders, variant selectors.
- Audio engine §5.2–5.4 (file, IR convolution, noise, absolute levels, crossfade).
- Presets §7 loadable; URL state; save/load.
- Explanation engine with derived quantities and templates for every component.
- Exit: Sadon can load "Blue Jay", play his guitar file, change R_pol and hear/see/read what happened.

### Phase 2 — Learning
- Lesson track (13 lessons, §2.2) with locks, Listen presets and quizzes; progress in localStorage.
- Fault panel §3.5 with all six faults.
- Noise view (breakdown pie, EIN curve) and operating-point view.
- Reference curves and A/B.
- Exit: Sadon completes lessons 1–13 end to end and the quizzes behave.

### Phase 3 — Free-form schematic
- Add/remove/rewire components on the schematic (drag from a parts bin, click to wire).
- Solver robustness: gmin stepping in addition to source stepping; detection and plain-language reporting of floating nodes, shorted sources, non-converging bias ("the FET is pinched off: V_gs = −3.1 V is below V_p").
- Phantom-power supply modelled (48 V → voltage doubler → regulator) as a fifth, optional stage.
- Omni / figure-8 with the rear diaphragm modelled.

### Phase 4 — Nonlinear
- Port the solver core to Rust → WebAssembly; transient analysis (trapezoidal integration, Newton per sample) inside an AudioWorklet; the ConvolverNode path becomes the "linear preview".
- Transformer core saturation (Jiles–Atherton or a simpler tanh-flux model), JFET clipping, FET input-stage overload → **max SPL** lesson and "pad" switch lesson.
- Real transistor-level phase splitter for the transformerless output.

---

## 9. Project structure

```
miclab/
  src/
    solver/            # Phase 0. Pure TS, no DOM. Runs in a worker.
      netlist.ts       # types, node renumbering, fragment concatenation
      stamps.ts        # MNA stamps per element kind
      lu.ts            # complex LU with pivoting
      jfet.ts          # Shichman–Hodges + small-signal + noise params
      op.ts            # operating point (Newton, source stepping)
      ac.ts            # sweep, per-stage attribution
      noise.ts         # noise analysis, A-weighting, dB-A
      hum.ts           # fault-frequency analysis
      worker.ts        # message API: { build } → { H, stages, noise, op, hum }
      __tests__/       # incl. golden/ngspice-reference.csv
    stages/            # one folder per stage; each variant = fragment + schematic SVG + derived quantities + templates
      capsule/  polarisation/  converter/  output/  load/  faults/
    audio/             # engine, IR builder, noise shaping, references
    ui/                # React components, three panes, transport, lesson drawer
    lessons/           # markdown-ish lesson content, quiz definitions
    data/              # presets/*.json, references/*.json, jfets.json, demo audio
  docs/
    SPEC.md            # this file
    THEORY.md          # the long-form explanations, one section per lesson (Claude Code writes these from §2.2 and §3, Sadon reviews)
```

Tooling: Vite, Vitest, ESLint/Prettier, `ngspice` only as a dev-time reference (not a runtime dependency). Deploy as a static site (same hosting as Synthwise). No backend, no accounts.

---

## 10. Non-goals for v1 (so nobody builds them by accident)

- Polar-pattern switching, multi-pattern capsules, proximity effect (acoustics, not electronics — could be a Phase 3+ "acoustic front end").
- Tube (valve) mics. The framework allows it (a triode model is the same shape as the JFET one), but the heater/HT supply and the transformer coupling need Phase 4 nonlinearity to be interesting.
- Auto-fitting a build to a reference curve.
- Any server, login, or sharing beyond URL encoding.
- Exact reproduction of commercial mics' circuits. Presets are Sadon's own DIY mics and textbook topologies.

---

## 11. Open questions for Sadon (answer whenever; defaults are stated)

1. Board values for Raven and Blue Jay (§1.3 checklist). *Default: textbook values, marked unverified.*
2. Which JFET is on each board? *Default: 2SK170 for both.*
3. Does the Raven's transformer have a known type/ratio (e.g. a BV107-style 7:1)? *Default: 7:1.*
4. Preamp input impedance to default to — what do the studio preamps present? *Default: 1.5 kΩ (a common console figure), with 10 kΩ one click away.*
5. Should the K67 presence bump be a separate editable "capsule character" knob, or locked to the capsule variant? *Default: editable, so Sadon can hear what "K67-ness" is.*

---

*Companion to this document: the Synthwise handoff, whose lesson-loop and UI conventions this app inherits.*
