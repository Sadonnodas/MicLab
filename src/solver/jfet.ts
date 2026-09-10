/**
 * N-channel JFET, Shichman–Hodges level-1 model.
 *
 * IMPORTANT: every number in the table below is a datasheet *typical*, not a
 * measurement of any particular device. Real JFETs vary enormously — a 2N3819's
 * Idss is specified anywhere from 2 to 20 mA — so the bias point this model
 * predicts is the bias point of an average device, and yours will differ. Use
 * the spread slider to see how much. Never design a real board around one
 * number here without measuring the part you actually have.
 *
 * Two regions (for V_gs > V_p, else the channel is pinched off and I_d = 0):
 *   saturation  V_ds ≥ V_gs − V_p :  I_d = β·(V_gs − V_p)²·(1 + λ·V_ds)
 *   triode      V_ds < V_gs − V_p :  I_d = β·[2(V_gs − V_p)·V_ds − V_ds²]·(1 + λ·V_ds)
 * with β = I_dss / V_p².
 */

export interface JfetModel {
  id: string
  name: string
  /** Drain current at V_gs = 0, in amps. */
  Idss: number
  /** Pinch-off voltage, negative for an n-channel JFET. */
  Vp: number
  /** Channel-length modulation, 1/V. */
  lambda: number
  /**
   * Gate–source capacitance, derived as Ciss − Crss.
   *
   * Datasheets quote Ciss (input capacitance, drain shorted to source for AC)
   * and Crss (reverse transfer). The solver stamps a gate–source and a
   * gate–drain capacitor separately, and Ciss = Cgs + Cgd — so using the
   * datasheet's Ciss figure directly as Cgs would over-state how much the FET
   * loads the capsule by the whole of Crss.
   */
  Cgs: number
  /** Gate–drain capacitance = the datasheet's Crss. Multiplied by (1 + gain)
   *  at the gate by the Miller effect, which usually makes it the larger term. */
  Cgd: number
  /** The datasheet figures the two above come from. */
  Ciss: number
  Crss: number
  /** Datasheet spread, for the "why do people match FETs" conversation. */
  IdssRange: [number, number]
  VpRange: [number, number]
  /** Gate leakage current, amps. */
  Igss: number
  /** Equivalent input noise voltage at 1 kHz, V/√Hz (informational; the solver
   *  derives channel noise from gm and adds the flicker term below). */
  en1k: number
  /** Flicker-noise coefficient: i_f² = KF·I_d/f  (A²/Hz). */
  KF: number
  note: string
}

export const JFET_MODELS: JfetModel[] = [
  {
    id: '2SK170',
    name: '2SK170 (BL)',
    Idss: 8e-3,
    Vp: -0.5,
    lambda: 0.005,
    Ciss: 30e-12,
    Crss: 6e-12,
    Cgs: 24e-12,
    Cgd: 6e-12,
    Igss: 10e-12,
    en1k: 1.0e-9,
    KF: 3.2e-16,
    IdssRange: [6e-3, 12e-3],
    VpRange: [-0.2, -1.5],
    note: 'The classic low-noise audio JFET (BL grade). The lowest voltage noise here — and by far the highest input capacitance, 30 pF of Ciss against a 55 pF capsule. Quietest transistor does not mean quietest microphone.',
  },
  {
    id: '2SK209',
    name: '2SK209 (GR)',
    Idss: 4e-3,
    Vp: -0.6,
    lambda: 0.01,
    Ciss: 13e-12,
    Crss: 3e-12,
    Cgs: 10e-12,
    Cgd: 3e-12,
    Igss: 10e-12,
    en1k: 1.2e-9,
    KF: 4.6e-16,
    IdssRange: [2.6e-3, 6.5e-3],
    VpRange: [-0.2, -1.5],
    note: 'The SMD successor to the 2SK170 (GR grade). Almost as quiet, much smaller, and less than half the input capacitance — which on a small capsule can make it the better choice.',
  },
  {
    id: '2N3819',
    name: '2N3819',
    Idss: 6e-3,
    Vp: -2.5,
    lambda: 0.02,
    Ciss: 4.5e-12,
    Crss: 1.5e-12,
    Cgs: 3e-12,
    Cgd: 1.5e-12,
    Igss: 20e-12,
    en1k: 4.0e-9,
    KF: 8.0e-15,
    IdssRange: [2e-3, 20e-3],
    VpRange: [-1, -7.5],
    note: 'Cheap general-purpose JFET, and a huge datasheet spread — Idss anywhere from 2 to 20 mA. Noticeably noisier than the Toshibas, but its low gate capacitance loads the capsule far less.',
  },
  {
    id: 'J305',
    name: 'J305',
    Idss: 5e-3,
    Vp: -2.0,
    lambda: 0.015,
    Ciss: 4e-12,
    Crss: 1e-12,
    Cgs: 3e-12,
    Cgd: 1e-12,
    Igss: 15e-12,
    en1k: 3.0e-9,
    KF: 5.0e-15,
    IdssRange: [4e-3, 20e-3],
    VpRange: [-1, -6],
    note: 'Common in DIY microphone kits — the part most Chinese boards ship with. Wide spread, so two boards from the same batch will not bias identically.',
  },
]

export const jfetById = (id: string): JfetModel =>
  JFET_MODELS.find((m) => m.id === id) ?? JFET_MODELS[0]

/** The small-signal operating point the AC and noise analyses need. */
export interface JfetOp {
  Vgs: number
  Vds: number
  Id: number
  gm: number
  gds: number
  /** 'sat' | 'triode' | 'off' — shown in the UI, because "where is the FET
   *  biased" is the whole point of lesson 6. */
  region: 'sat' | 'triode' | 'off'
}

export interface JfetParams {
  beta: number
  Vp: number
  lambda: number
}

export const jfetParams = (m: JfetModel, spread = 1): JfetParams => ({
  beta: (m.Idss * spread) / (m.Vp * m.Vp),
  Vp: m.Vp,
  lambda: m.lambda,
})

/** Evaluate I_d and its derivatives at a bias point. */
export function jfetEval(p: JfetParams, Vgs: number, Vds: number): JfetOp {
  const vov = Vgs - p.Vp
  if (vov <= 0) {
    // Pinched off. A tiny conductance keeps the matrix non-singular and makes
    // Newton converge back out of the off region instead of getting stuck.
    return { Vgs, Vds, Id: 0, gm: 0, gds: 1e-12, region: 'off' }
  }
  if (Vds < 0) {
    // Reverse operation: swap the roles of drain and source. Not a normal
    // operating region for these circuits, but Newton can visit it mid-iteration.
    const o = jfetEval(p, Vgs - Vds, -Vds)
    return { Vgs, Vds, Id: -o.Id, gm: o.gm, gds: o.gm + o.gds, region: o.region }
  }
  const lam = 1 + p.lambda * Vds
  if (Vds >= vov) {
    const Id = p.beta * vov * vov * lam
    return {
      Vgs,
      Vds,
      Id,
      gm: 2 * p.beta * vov * lam,
      gds: p.beta * vov * vov * p.lambda,
      region: 'sat',
    }
  }
  const Id = p.beta * (2 * vov * Vds - Vds * Vds) * lam
  return {
    Vgs,
    Vds,
    Id,
    gm: 2 * p.beta * Vds * lam,
    gds: p.beta * (2 * vov - 2 * Vds) * lam + p.beta * (2 * vov * Vds - Vds * Vds) * p.lambda,
    region: 'triode',
  }
}
