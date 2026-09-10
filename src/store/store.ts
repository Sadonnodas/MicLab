import { create } from 'zustand'
import type { AnalysisResult } from '../solver/analysis'
import {
  defaultBuild,
  variantFor,
  withDefaults,
  type BuildSpec,
} from '../stages/build'
import type { BuildStage } from '../solver/netlist'
import { SolverClient } from './solverClient'
import { explain, type Explanation } from '../explain/engine'
import { decodeBuild, encodeBuild } from '../lib/url'
import { presetById, PRESETS } from '../data/presets'
import { LESSONS, applyMutation, lessonByNumber, type Mutation } from '../lessons/lessons'
import { assemblySteps, type AssemblyStep } from '../lessons/assembly'
import { FAULTS } from '../stages/faults'

export type GraphTab = 'response' | 'noise' | 'op'
export type LessonStep = 'concept' | 'listen' | 'explore' | 'quiz'

export interface SavedBuild {
  name: string
  query: string
  savedAt: number
}

interface State {
  build: BuildSpec
  result: AnalysisResult | null
  prevResult: AnalysisResult | null
  explanation: Explanation | null
  solving: boolean
  error: string | null

  selectedStage: BuildStage
  selectedElement: string | null
  graphTab: GraphTab
  compareRef: string | null

  mode: 'free' | 'lesson' | 'assembly'
  /** Assembly walkthrough: the ordered steps, and how far along we are. */
  assembly: AssemblyStep[]
  assemblyIndex: number
  /**
   * The board as it stood one part ago. Solved explicitly rather than reusing
   * the last result, so "what fitting it did" is right even when you skip
   * several steps with the progress bar.
   */
  stepBaseline: AnalysisResult | null
  lesson: number | null
  lessonStep: LessonStep
  quizAnswers: Record<string, number>
  progress: Record<number, boolean>
  /** Which Listen variant is currently loaded, if any. */
  listenSide: 'a' | 'b' | null

  presetId: string | null
  saved: SavedBuild[]

  setParam: (stage: BuildStage, key: string, value: number | string) => void
  setVariant: (stage: BuildStage, variant: string) => void
  setFaultParam: (id: string, key: string, value: number) => void
  toggleFault: (id: string) => void
  selectStage: (stage: BuildStage) => void
  selectElement: (id: string | null) => void
  setGraphTab: (tab: GraphTab) => void
  setCompareRef: (id: string | null) => void
  loadPreset: (id: string) => void
  loadBuild: (build: BuildSpec, presetId?: string | null) => void
  startLesson: (n: number) => void
  exitLesson: () => void
  startAssembly: (presetId?: string) => void
  assemblyGoto: (index: number) => void
  setLessonStep: (s: LessonStep) => void
  loadListen: (side: 'a' | 'b' | null) => void
  loadClip: (m: Partial<Mutation>) => void
  answerQuiz: (id: string, choice: number) => void
  completeLesson: (n: number) => void
  saveBuild: (name: string) => void
  deleteSaved: (name: string) => void
  clearError: () => void
}

const PROGRESS_KEY = 'miclab.progress'
const SAVED_KEY = 'miclab.saved'

const loadJson = <T,>(key: string, fallback: T): T => {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

const storeJson = (key: string, value: unknown) => {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* private browsing, quota — not worth interrupting the user for */
  }
}

/** Read a build out of the URL if there is one, else the default. */
function initialBuild(): { build: BuildSpec; presetId: string | null } {
  const q = window.location.search.slice(1)
  if (q) {
    try {
      const build = decodeBuild(q, defaultBuild())
      return { build, presetId: matchPreset(build) }
    } catch {
      /* fall through to the default */
    }
  }
  const p = presetById('bluejay')
  return p ? { build: structuredClone(p.build), presetId: p.id } : { build: defaultBuild(), presetId: null }
}

/** A shared link that happens to be a preset should still say which one. */
function matchPreset(build: BuildSpec): string | null {
  const q = encodeBuild(build)
  return PRESETS.find((p) => encodeBuild(p.build) === q)?.id ?? null
}

let client: SolverClient | null = null
let solveToken = 0

export const useStore = create<State>((set, get) => {
  const init = initialBuild()

  /** Run the solver and fold the answer (plus a fresh explanation) into state. */
  const solve = (nextBuild: BuildSpec, prevBuild: BuildSpec | null) => {
    if (!client) client = new SolverClient((m) => set({ error: m, solving: false }))
    const token = ++solveToken
    set({ solving: true })
    // In the assembly walkthrough only the parts fitted so far are on the board,
    // and the probe sits wherever a scope could usefully be clipped.
    const { mode, assembly, assemblyIndex } = get()
    const step = mode === 'assembly' ? assembly[assemblyIndex] : undefined
    client
      .solve(nextBuild, step ? { only: step.enabled, probe: step.probe } : {})
      .then((result) => {
        if (token !== solveToken) return
        const prevResult = get().result
        let explanation: Explanation | null = null
        try {
          explanation = explain({ prevBuild, nextBuild, prevResult, nextResult: result })
        } catch {
          /* an explanation is a nicety; never let it break the app */
        }
        set({ result, prevResult, explanation, solving: false, error: null })
      })
      .catch((e: unknown) => set({ error: String(e), solving: false }))
  }

  /** Every mutation funnels through here so the URL and the solver stay in step. */
  const commit = (next: BuildSpec, opts: { presetId?: string | null } = {}) => {
    const prev = get().build
    const patch: Partial<State> = { build: next }
    if (opts.presetId !== undefined) patch.presetId = opts.presetId
    set(patch)
    const query = encodeBuild(next)
    window.history.replaceState(null, '', `?${query}`)
    solve(next, prev)
  }

  queueMicrotask(() => solve(init.build, null))

  const firstVisit = (() => {
    try {
      return localStorage.getItem('miclab.visited') !== '1'
    } catch {
      return false
    }
  })()
  try {
    localStorage.setItem('miclab.visited', '1')
  } catch {
    /* private browsing — they simply get the walkthrough again */
  }
  // A shared link is a build somebody wants to see, so it opens the builder.
  const startInAssembly = firstVisit && !window.location.search

  return {
    build: init.build,
    result: null,
    prevResult: null,
    explanation: null,
    solving: true,
    error: null,

    selectedStage: 'polarisation',
    selectedElement: null,
    graphTab: 'response',
    compareRef: null,

    mode: startInAssembly ? 'assembly' : 'free',
    assembly: startInAssembly ? assemblySteps(init.build) : [],
    assemblyIndex: 0,
    stepBaseline: null,
    lesson: null,
    lessonStep: 'concept',
    quizAnswers: {},
    progress: loadJson<Record<number, boolean>>(PROGRESS_KEY, {}),
    listenSide: null,

    presetId: init.presetId,
    saved: loadJson<SavedBuild[]>(SAVED_KEY, []),

    setParam(stage, key, value) {
      const b = get().build
      const next: BuildSpec = {
        ...b,
        [stage]: { ...b[stage], values: { ...b[stage].values, [key]: value } },
      }
      commit(next, { presetId: matchPreset(next) })
    },

    setVariant(stage, variant) {
      const b = get().build
      if (b[stage].variant === variant) return
      const next: BuildSpec = { ...b, [stage]: withDefaults(stage, { variant, values: {} }) }
      commit(next, { presetId: matchPreset(next) })
      set({ selectedStage: stage, selectedElement: null })
    },

    setFaultParam(id, key, value) {
      const b = get().build
      const next: BuildSpec = {
        ...b,
        faults: b.faults.map((f) => (f.id === id ? { ...f, values: { ...f.values, [key]: value } } : f)),
      }
      commit(next)
    },

    toggleFault(id) {
      const b = get().build
      const on = b.faults.some((f) => f.id === id)
      const fault = FAULTS.find((f) => f.id === id)
      const values: Record<string, number> = {}
      for (const p of fault?.params ?? []) values[p.key] = p.default
      const next: BuildSpec = {
        ...b,
        faults: on ? b.faults.filter((f) => f.id !== id) : [...b.faults, { id, values }],
      }
      commit(next)
    },

    selectStage: (selectedStage) => set({ selectedStage, selectedElement: null }),
    selectElement: (selectedElement) => {
      if (!selectedElement) return set({ selectedElement: null })
      const stage = selectedElement.split('.')[0]
      const map: Record<string, BuildStage> = {
        capsule: 'capsule',
        pol: 'polarisation',
        conv: 'converter',
        out: 'output',
        load: 'load',
      }
      set({ selectedElement, selectedStage: map[stage] ?? get().selectedStage })
    },
    setGraphTab: (graphTab) => set({ graphTab }),
    setCompareRef: (compareRef) => set({ compareRef }),

    loadPreset(id) {
      const p = presetById(id)
      if (!p) return
      commit(structuredClone(p.build), { presetId: id })
    },

    loadBuild(build, presetId) {
      commit(build, { presetId: presetId ?? matchPreset(build) })
    },

    startLesson(n) {
      const lesson = lessonByNumber(n)
      if (!lesson) return
      set({ mode: 'lesson', lesson: n, lessonStep: 'concept', quizAnswers: {}, listenSide: null })
      if (lesson.preset) {
        const p = presetById(lesson.preset)
        if (p) commit(structuredClone(p.build), { presetId: p.id })
      }
      const stage = lesson.explore.stage
      set({ selectedStage: stage })
    },

    exitLesson: () => {
      set({ mode: 'free', lesson: null, listenSide: null })
      solve(get().build, null)
    },

    startAssembly(presetId) {
      const preset = presetId ? presetById(presetId) : undefined
      const build = preset ? structuredClone(preset.build) : get().build
      const steps = assemblySteps(build)
      set({
        mode: 'assembly',
        assembly: steps,
        assemblyIndex: 0,
        stepBaseline: null,
        build,
        presetId: preset?.id ?? get().presetId,
        prevResult: null,
        explanation: null,
      })
      window.history.replaceState(null, '', `?${encodeBuild(build)}`)
      solve(build, null)
    },

    async assemblyGoto(index) {
      const { assembly, build } = get()
      const next = Math.max(0, Math.min(index, assembly.length - 1))
      set({ assemblyIndex: next, solving: true })
      if (!client) client = new SolverClient((m) => set({ error: m, solving: false }))

      // Solve the board one part ago first, so the comparison is against the
      // step before this one rather than against wherever the user came from.
      const before = assembly[next - 1]
      const baseline = before
        ? await client.solve(build, { only: before.enabled, probe: before.probe })
        : null
      if (get().assemblyIndex !== next) return
      set({ stepBaseline: baseline })
      solve(build, build)
    },
    setLessonStep: (lessonStep) => set({ lessonStep }),

    loadListen(side) {
      const lesson = lessonByNumber(get().lesson ?? 0)
      if (!lesson || side === null) return set({ listenSide: null })
      commit(applyMutation(get().build, side === 'a' ? lesson.listen.a : lesson.listen.b))
      set({ listenSide: side })
    },

    loadClip(m) {
      commit(applyMutation(get().build, m))
    },

    answerQuiz(id, choice) {
      set({ quizAnswers: { ...get().quizAnswers, [id]: choice } })
    },

    completeLesson(n) {
      const progress = { ...get().progress, [n]: true }
      storeJson(PROGRESS_KEY, progress)
      set({ progress })
    },

    saveBuild(name) {
      const entry: SavedBuild = { name, query: encodeBuild(get().build), savedAt: Date.now() }
      const saved = [entry, ...get().saved.filter((s) => s.name !== name)].slice(0, 40)
      storeJson(SAVED_KEY, saved)
      set({ saved })
    },

    deleteSaved(name) {
      const saved = get().saved.filter((s) => s.name !== name)
      storeJson(SAVED_KEY, saved)
      set({ saved })
    },

    clearError: () => set({ error: null }),
  }
})

export { PRESETS, LESSONS, variantFor }
