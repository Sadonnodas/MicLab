import type { AnalysisResult } from '../solver/analysis'
import type { BuildSpec } from '../stages/build'
import type { SolveRequest, SolveResponse } from '../solver/worker'

/**
 * Thin client for the solver worker.
 *
 * Dragging a slider fires a solve per frame; only the newest answer is useful,
 * so requests carry a sequence number and stale replies are dropped.
 */
export interface SolveOptions {
  /** Assembly walkthrough: only these elements are fitted so far. */
  only?: Set<string>
  probe?: [string, string]
}

export class SolverClient {
  private worker: Worker
  private seq = 0
  private pending = new Map<number, (r: AnalysisResult) => void>()
  private onError: (m: string) => void

  constructor(onError: (m: string) => void) {
    this.worker = new Worker(new URL('../solver/worker.ts', import.meta.url), { type: 'module' })
    this.onError = onError
    this.worker.onmessage = (e: MessageEvent<SolveResponse>) => {
      const { seq, result, error } = e.data
      const cb = this.pending.get(seq)
      this.pending.delete(seq)
      // Anything older than what we just answered is now irrelevant.
      for (const k of [...this.pending.keys()]) if (k < seq) this.pending.delete(k)
      if (error) {
        this.onError(error)
        return
      }
      cb?.(result)
    }
  }

  solve(build: BuildSpec, opts: SolveOptions = {}): Promise<AnalysisResult> {
    const seq = ++this.seq
    return new Promise((resolve) => {
      this.pending.set(seq, resolve)
      const msg: SolveRequest = {
        type: 'solve',
        seq,
        build,
        only: opts.only ? [...opts.only] : undefined,
        probe: opts.probe,
      }
      this.worker.postMessage(msg)
    })
  }
}
