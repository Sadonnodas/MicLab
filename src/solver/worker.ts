/// <reference lib="webworker" />
import { analyse, type AnalysisResult } from './analysis'
import type { BuildSpec } from '../stages/build'

/**
 * The solver runs here so a slider drag never stalls the UI.
 *
 * Requests carry a sequence number and the worker only ever answers the most
 * recent one it has finished — dragging a slider queues dozens of solves and
 * only the last matters.
 */
export interface SolveRequest {
  type: 'solve'
  seq: number
  build: BuildSpec
  /** Assembly walkthrough: only these element ids are on the board yet. */
  only?: string[]
  /** Where to measure. Defaults to the microphone's output. */
  probe?: [string, string]
}

export interface SolveResponse {
  type: 'result'
  seq: number
  result: AnalysisResult
  error?: string
}

self.onmessage = (e: MessageEvent<SolveRequest>) => {
  const { seq, build, only, probe } = e.data
  try {
    const result = analyse(build, { only: only ? new Set(only) : undefined, probe })
    const msg: SolveResponse = { type: 'result', seq, result }
    self.postMessage(msg)
  } catch (err) {
    self.postMessage({
      type: 'result',
      seq,
      error: err instanceof Error ? err.message : String(err),
    })
  }
}
