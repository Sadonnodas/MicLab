import type { Complex } from './complex'
import { cDiv, cMul } from './complex'

/**
 * The capsule's electro-mechanical behaviour.
 *
 * The capsule appears in the netlist as a capacitance C_caps in series with a
 * behavioural voltage source. This module supplies that source's value at a
 * given frequency:
 *
 *   E_caps(f) = S0 · (V_pol / V_ref) · H_mech(f) · H_presence(f) · P_in
 *
 * H_mech is the diaphragm's fundamental resonance (a second-order low-pass
 * whose peak is the "air" at the top of a large-diaphragm mic), and
 * H_presence is the gentler, broader bump the K67 hole pattern adds.
 */
export interface CapsuleSpec {
  /** Static diaphragm-to-backplate capacitance, farads. */
  Ccaps: number
  /** Open-circuit sensitivity at V_ref, volts per pascal. */
  S0: number
  /** Polarisation voltage the sensitivity figure was quoted at. */
  Vref: number
  /** Diaphragm resonance, Hz. 0 disables the term. */
  fres: number
  Qres: number
  /** Presence bump: gain in dB at fpres with quality Qpres. 0 dB disables it. */
  presenceDb: number
  presenceF: number
  presenceQ: number
  /** Acoustic self-noise of the capsule itself, dB-A equivalent SPL. */
  Nac: number
  /** Electrets carry their own charge: the polarisation voltage is fixed. */
  fixedVpol?: number
}

/** Second-order resonance: flat below f_res, peaked at it, 12 dB/oct above. */
function mechanical(spec: CapsuleSpec, f: number): Complex {
  if (!spec.fres) return { re: 1, im: 0 }
  const x = f / spec.fres
  // 1 / (1 − x² + jx/Q)
  return cDiv({ re: 1, im: 0 }, { re: 1 - x * x, im: x / Math.max(spec.Qres, 0.05) })
}

/** Analogue peaking ("bell") response, +presenceDb at presenceF. */
function presence(spec: CapsuleSpec, f: number): Complex {
  if (!spec.presenceDb) return { re: 1, im: 0 }
  const G = Math.pow(10, spec.presenceDb / 20)
  const x = f / spec.presenceF
  const q = Math.max(spec.presenceQ, 0.05)
  // (1 − x² + jxG/Q) / (1 − x² + jx/Q)
  return cDiv({ re: 1 - x * x, im: (x * G) / q }, { re: 1 - x * x, im: x / q })
}

/**
 * The capsule's open-circuit voltage per pascal at frequency f.
 * `Vpol` is the *actual* DC voltage across the capsule, read from the operating
 * point — so a leaky board, which pulls that voltage down, really does make the
 * mic less sensitive.
 */
export function capsuleE(spec: CapsuleSpec, Vpol: number, f: number, flat = false): Complex {
  const scale = spec.S0 * ((spec.fixedVpol ?? Vpol) / spec.Vref)
  if (flat) return { re: scale, im: 0 }
  return cMul({ re: scale, im: 0 }, cMul(mechanical(spec, f), presence(spec, f)))
}
