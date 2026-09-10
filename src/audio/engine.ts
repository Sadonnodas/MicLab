import type { AnalysisResult } from '../solver/analysis'
import { impulseResponse, magnitudeFir } from './ir'
import { DEMOS, renderDemo, type DemoClip } from './demo'
import type { ReferenceMic } from '../data/references'

/**
 * The audio engine.
 *
 * Because the circuit is linear in v1, "hearing the file through the microphone"
 * means convolving it with the microphone's impulse response — which is just
 * H(f) from the solver, inverse-transformed. Noise and hum are added as separate
 * sources at the same point, at their real levels.
 *
 * Levels are absolute on purpose. A 7:1 transformer really is 17 dB quieter than
 * a transformerless output, and you should have to reach for the preamp trim,
 * exactly as you would in the room.
 */

/** Digital full scale, in volts. +24 dBu, like a studio interface. */
const FULL_SCALE_VOLTS = 12.3

/** 0 dB SPL in pascals. */
const P_REF = 20e-6

export type SplChoice = 74 | 94 | 114

export interface EngineState {
  playing: boolean
  clipName: string
  noiseOn: boolean
  humOn: boolean
  splDb: SplChoice
  trimDb: number
  compareRef: string | null
  levelMatch: boolean
  clipping: boolean
}

interface HumVoice {
  osc: OscillatorNode
  gain: GainNode
}

export class MicEngine {
  readonly ctx: AudioContext
  private buffer: AudioBuffer | null = null
  private source: AudioBufferSourceNode | null = null

  private inputGain: GainNode
  private micConv: ConvolverNode
  private micGain: GainNode
  private refConv: ConvolverNode
  private refGain: GainNode
  private dry: GainNode
  private preamp: GainNode
  private limiter: DynamicsCompressorNode
  private analyser: AnalyserNode

  private noiseConv: ConvolverNode
  private noiseGain: GainNode

  private humBus: GainNode
  private humVoices: HumVoice[] = []
  private faultTimer: number | null = null

  private state: EngineState = {
    playing: false,
    clipName: DEMOS[1].name,
    noiseOn: true,
    humOn: true,
    splDb: 94,
    trimDb: 30,
    compareRef: null,
    levelMatch: true,
    clipping: false,
  }

  private latest: AnalysisResult | null = null
  private sensitivity = 1
  private peak = 0

  constructor() {
    this.ctx = new AudioContext()
    const c = this.ctx

    this.inputGain = c.createGain()
    this.micConv = c.createConvolver()
    this.micConv.normalize = false
    this.micGain = c.createGain()
    this.refConv = c.createConvolver()
    this.refConv.normalize = false
    this.refGain = c.createGain()
    this.refGain.gain.value = 0
    this.dry = c.createGain()
    this.dry.gain.value = 0
    this.preamp = c.createGain()
    this.limiter = c.createDynamicsCompressor()
    this.limiter.threshold.value = -1
    this.limiter.knee.value = 0
    this.limiter.ratio.value = 20
    this.limiter.attack.value = 0.001
    this.limiter.release.value = 0.1
    this.analyser = c.createAnalyser()
    this.analyser.fftSize = 2048

    this.noiseConv = c.createConvolver()
    this.noiseConv.normalize = false
    this.noiseGain = c.createGain()
    this.humBus = c.createGain()

    this.inputGain.connect(this.micConv)
    this.micConv.connect(this.micGain)
    this.micGain.connect(this.preamp)
    this.inputGain.connect(this.refConv)
    this.refConv.connect(this.refGain)
    this.refGain.connect(this.preamp)
    this.inputGain.connect(this.dry)
    this.dry.connect(this.preamp)
    this.noiseConv.connect(this.noiseGain)
    this.noiseGain.connect(this.preamp)
    this.humBus.connect(this.preamp)
    this.preamp.connect(this.limiter)
    this.limiter.connect(this.analyser)
    this.analyser.connect(c.destination)

    this.applyLevels()
    this.startNoise()
  }

  getState(): EngineState {
    return { ...this.state }
  }

  async resume(): Promise<void> {
    if (this.ctx.state !== 'running') await this.ctx.resume()
  }

  // ---------------------------------------------------------------- material

  loadDemo(clip: DemoClip): void {
    this.buffer = renderDemo(this.ctx, clip)
    this.state.clipName = clip.name
    if (this.state.playing) this.restart()
  }

  async loadFile(file: File): Promise<void> {
    const data = await file.arrayBuffer()
    const decoded = await this.ctx.decodeAudioData(data)
    // Mono-sum: a microphone has one diaphragm.
    const n = decoded.length
    const mono = this.ctx.createBuffer(1, n, decoded.sampleRate)
    const out = mono.getChannelData(0)
    for (let ch = 0; ch < decoded.numberOfChannels; ch++) {
      const src = decoded.getChannelData(ch)
      for (let i = 0; i < n; i++) out[i] += src[i] / decoded.numberOfChannels
    }
    this.buffer = mono
    this.state.clipName = file.name
    if (this.state.playing) this.restart()
  }

  // ---------------------------------------------------------------- transport

  play(): void {
    if (!this.buffer) this.loadDemo(DEMOS[1])
    this.restart()
    this.state.playing = true
  }

  stop(): void {
    this.source?.stop()
    this.source = null
    this.state.playing = false
  }

  private restart(): void {
    this.source?.stop()
    if (!this.buffer) return
    const s = this.ctx.createBufferSource()
    s.buffer = this.buffer
    s.loop = true
    s.connect(this.inputGain)
    s.start()
    this.source = s
  }

  // ------------------------------------------------------------------- solver

  /** Feed the engine a fresh solve: new IR, new noise shaping, new hum. */
  update(result: AnalysisResult, faults: string[]): void {
    this.latest = result
    this.sensitivity = result.sensitivity
    const sr = this.ctx.sampleRate

    const ir = impulseResponse(result.freqs, result.hRe, result.hIm, { sampleRate: sr })
    const buf = this.ctx.createBuffer(1, ir.length, sr)
    buf.copyToChannel(ir, 0)
    // Crossfade rather than swap, or every slider move is a click.
    this.crossfadeConvolver(buf)

    this.updateNoise(result)
    this.updateHum(result, faults)
    this.applyLevels()
  }

  private crossfadeConvolver(buf: AudioBuffer): void {
    const c = this.ctx
    const now = c.currentTime
    const fade = 0.05
    const next = c.createConvolver()
    next.normalize = false
    next.buffer = buf
    const nextGain = c.createGain()
    nextGain.gain.setValueAtTime(0, now)
    nextGain.gain.linearRampToValueAtTime(1, now + fade)
    this.inputGain.connect(next)
    next.connect(nextGain)
    nextGain.connect(this.preamp)

    const oldConv = this.micConv
    const oldGain = this.micGain
    oldGain.gain.setValueAtTime(oldGain.gain.value, now)
    oldGain.gain.linearRampToValueAtTime(0, now + fade)
    window.setTimeout(() => {
      try {
        this.inputGain.disconnect(oldConv)
        oldConv.disconnect()
        oldGain.disconnect()
      } catch {
        /* already gone */
      }
    }, (fade + 0.05) * 1000)

    this.micConv = next
    this.micGain = nextGain
  }

  private startNoise(): void {
    const sr = this.ctx.sampleRate
    const n = Math.round(sr * 10)
    const buf = this.ctx.createBuffer(1, n, sr)
    const d = buf.getChannelData(0)
    // Gaussian white noise, unit variance, via Box–Muller.
    for (let i = 0; i < n; i += 2) {
      const u = Math.max(Math.random(), 1e-12)
      const v = Math.random()
      const r = Math.sqrt(-2 * Math.log(u))
      d[i] = r * Math.cos(2 * Math.PI * v)
      if (i + 1 < n) d[i + 1] = r * Math.sin(2 * Math.PI * v)
    }
    const s = this.ctx.createBufferSource()
    s.buffer = buf
    s.loop = true
    s.connect(this.noiseConv)
    s.start()
  }

  private updateNoise(result: AnalysisResult): void {
    const sr = this.ctx.sampleRate
    // White noise of unit variance has a one-sided PSD of 2/sr. To end up with
    // the solver's output noise density N(f), the filter magnitude must be
    // √(N(f)·sr/2) volts per root hertz.
    const mag = new Float64Array(result.freqs.length)
    for (let i = 0; i < mag.length; i++) mag[i] = Math.sqrt((result.noisePsd[i] * sr) / 2)
    const fir = magnitudeFir(result.freqs, mag, sr, 4096)
    const buf = this.ctx.createBuffer(1, fir.length, sr)
    buf.copyToChannel(fir, 0)
    this.noiseConv.buffer = buf
  }

  private updateHum(result: AnalysisResult, faults: string[]): void {
    for (const v of this.humVoices) {
      try {
        v.osc.stop()
        v.osc.disconnect()
        v.gain.disconnect()
      } catch {
        /* already stopped */
      }
    }
    this.humVoices = []
    if (this.faultTimer !== null) {
      window.clearInterval(this.faultTimer)
      this.faultTimer = null
    }

    const gsm = faults.includes('no-rf-caps')
    const crackle = faults.includes('cold-solder')

    for (const line of result.hum) {
      if (line.volts <= 0) continue
      const osc = this.ctx.createOscillator()
      osc.frequency.value = line.freq
      const gain = this.ctx.createGain()
      // Amplitude here is an RMS-ish figure from the AC solve; an oscillator's
      // value is a peak, so scale by √2.
      gain.gain.value = line.volts * Math.SQRT2
      osc.connect(gain)
      gain.connect(this.humBus)
      osc.start()
      this.humVoices.push({ osc, gain })
    }

    if (gsm) this.startGsmBursts()
    else if (crackle) this.startCrackle()
  }

  /**
   * A GSM handset transmits in bursts. The audio-band tones are already in the
   * solve; what makes them recognisable is the on/off pattern on top.
   */
  private startGsmBursts(): void {
    const isGsm = (f: number) => f % 217 < 1 || Math.abs(f / 217 - Math.round(f / 217)) < 0.01
    const voices = this.humVoices.filter((v) => isGsm(v.osc.frequency.value))
    if (voices.length === 0) return
    const base = voices.map((v) => v.gain.gain.value)
    for (const v of voices) v.gain.gain.value = 0
    let phase = 0
    this.faultTimer = window.setInterval(() => {
      const t = this.ctx.currentTime
      phase = (phase + 1) % 12
      // Three quick bursts, then a pause: the pattern everyone recognises.
      const on = phase < 6 && phase % 2 === 0
      voices.forEach((v, i) => {
        v.gain.gain.cancelScheduledValues(t)
        v.gain.gain.setTargetAtTime(on ? base[i] : 0, t, 0.008)
      })
    }, 120)
  }

  /** A bad joint is a resistance that changes as the cable moves. */
  private startCrackle(): void {
    const voices = this.humVoices
    if (voices.length === 0) return
    const base = voices.map((v) => v.gain.gain.value)
    this.faultTimer = window.setInterval(() => {
      const t = this.ctx.currentTime
      const jump = Math.random() < 0.25 ? Math.random() * 8 : 0.4 + Math.random() * 1.2
      voices.forEach((v, i) => {
        v.gain.gain.cancelScheduledValues(t)
        v.gain.gain.setTargetAtTime(base[i] * jump, t, 0.004)
      })
    }, 90)
  }

  // ------------------------------------------------------------------ levels

  setSpl(db: SplChoice): void {
    this.state.splDb = db
    this.applyLevels()
  }

  setTrim(db: number): void {
    this.state.trimDb = db
    this.applyLevels()
  }

  setNoise(on: boolean): void {
    this.state.noiseOn = on
    this.applyLevels()
  }

  setHum(on: boolean): void {
    this.state.humOn = on
    this.applyLevels()
  }

  setLevelMatch(on: boolean): void {
    this.state.levelMatch = on
    this.applyLevels()
  }

  /** Switch the A/B to a reference microphone, or back to the build. */
  setReference(ref: ReferenceMic | null): void {
    this.state.compareRef = ref?.id ?? null
    if (ref) {
      const sr = this.ctx.sampleRate
      const freqs = Float64Array.from(ref.freqs)
      const mag = Float64Array.from(ref.db, (d) => Math.pow(10, d / 20))
      const fir = magnitudeFir(freqs, mag, sr, 4096)
      const buf = this.ctx.createBuffer(1, fir.length, sr)
      buf.copyToChannel(fir, 0)
      this.refConv.buffer = buf
    }
    this.applyLevels()
  }

  private applyLevels(): void {
    const t = this.ctx.currentTime
    const ramp = (p: AudioParam, v: number) => {
      p.cancelScheduledValues(t)
      p.setTargetAtTime(v, t, 0.02)
    }

    // Peak pascals a full-scale sample represents at the chosen SPL.
    const pascalsPerUnit = Math.SQRT2 * P_REF * Math.pow(10, this.state.splDb / 20)
    ramp(this.inputGain.gain, pascalsPerUnit)

    const preampLinear = Math.pow(10, this.state.trimDb / 20) / FULL_SCALE_VOLTS
    ramp(this.preamp.gain, preampLinear)

    const comparing = this.state.compareRef !== null
    // The reference curves are normalised at 1 kHz, so to put them on the same
    // footing as the build we hand them the build's own 1 kHz sensitivity —
    // unless the user has turned level matching off, in which case they get a
    // real microphone's 20 mV/Pa and the difference is audible.
    const refSens = this.state.levelMatch ? this.sensitivity : 0.02
    ramp(this.refGain.gain, comparing ? refSens : 0)
    ramp(this.micGain.gain, comparing ? 0 : 1)
    ramp(this.noiseGain.gain, this.state.noiseOn && !comparing ? 1 : 0)
    ramp(this.humBus.gain, this.state.humOn && !comparing ? 1 : 0)
  }

  /** Peak level since the last call, in dBFS. Drives the meter. */
  meter(): number {
    const buf = new Float32Array(this.analyser.fftSize)
    this.analyser.getFloatTimeDomainData(buf)
    let p = 0
    for (let i = 0; i < buf.length; i++) p = Math.max(p, Math.abs(buf[i]))
    this.peak = Math.max(p, this.peak * 0.88)
    this.state.clipping = this.peak > 0.99
    return 20 * Math.log10(Math.max(this.peak, 1e-6))
  }

  /** What SPL the current input level corresponds to — shown next to the meter. */
  splOf(): number {
    return this.state.splDb
  }

  get analysis(): AnalysisResult | null {
    return this.latest
  }
}
